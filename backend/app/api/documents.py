import shutil
from datetime import date
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.document import (
    DocumentListResponse,
    DocumentRead,
    DocumentRepairRead,
    DocumentUploadResponse,
    DocumentVehicleRead,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_STORAGE_ROOT = PROJECT_ROOT / "storage"

router = APIRouter(prefix="/documents", tags=["documents"])


def get_visible_vehicle(
    db: Session,
    current_user: User,
    vehicle_id: int,
) -> Optional[Vehicle]:
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Vehicle.id.in_(get_allowed_vehicle_ids_query(current_user)))
    return db.scalar(stmt)


def serialize_document(document: Document) -> DocumentRead:
    if document.repair is None or document.repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document relation is incomplete")

    return DocumentRead(
        id=document.id,
        original_filename=document.original_filename,
        source_type=document.source_type,
        mime_type=document.mime_type,
        status=document.status,
        is_primary=document.is_primary,
        ocr_confidence=document.ocr_confidence,
        review_queue_priority=document.review_queue_priority,
        notes=document.notes,
        created_at=document.created_at,
        repair=DocumentRepairRead.model_validate(document.repair),
        vehicle=DocumentVehicleRead.model_validate(document.repair.vehicle),
    )


def detect_source_type(upload: UploadFile) -> str:
    content_type = upload.content_type or ""
    if content_type == "application/pdf":
        return "pdf"
    if content_type.startswith("image/"):
        return "image"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Only PDF files and images are supported",
    )


def build_storage_key(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    today = date.today()
    return f"documents/{today.year}/{today.month:02d}/{uuid4().hex}{suffix}"


def load_document_with_relations(db: Session, document_id: int) -> Optional[Document]:
    stmt = (
        select(Document)
        .options(joinedload(Document.repair).joinedload(Repair.vehicle))
        .where(Document.id == document_id)
    )
    return db.execute(stmt).unique().scalar_one_or_none()


@router.get("", response_model=DocumentListResponse)
def list_documents(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: Optional[DocumentStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentListResponse:
    stmt = (
        select(Document)
        .join(Document.repair)
        .options(joinedload(Document.repair).joinedload(Repair.vehicle))
    )
    count_stmt = select(func.count(Document.id)).join(Document.repair)

    if current_user.role != UserRole.ADMIN:
        visible_ids = get_allowed_vehicle_ids_query(current_user)
        stmt = stmt.where(Repair.vehicle_id.in_(visible_ids))
        count_stmt = count_stmt.where(Repair.vehicle_id.in_(visible_ids))

    if status_filter is not None:
        stmt = stmt.where(Document.status == status_filter)
        count_stmt = count_stmt.where(Document.status == status_filter)

    stmt = stmt.order_by(Document.created_at.desc(), Document.id.desc()).offset(offset).limit(limit)

    items = db.execute(stmt).unique().scalars().all()
    total = db.scalar(count_stmt) or 0

    return DocumentListResponse(
        items=[serialize_document(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/upload", response_model=DocumentUploadResponse)
def upload_document(
    vehicle_id: int = Form(...),
    repair_date: date = Form(...),
    mileage: int = Form(...),
    order_number: Optional[str] = Form(default=None),
    reason: Optional[str] = Form(default=None),
    employee_comment: Optional[str] = Form(default=None),
    notes: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentUploadResponse:
    vehicle = get_visible_vehicle(db, current_user, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    source_type = detect_source_type(file)
    storage_key = build_storage_key(file.filename or "document")
    destination = LOCAL_STORAGE_ROOT / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)

    try:
        with destination.open("wb") as target:
            shutil.copyfileobj(file.file, target)

        repair = Repair(
            order_number=order_number,
            repair_date=repair_date,
            vehicle_id=vehicle.id,
            created_by_user_id=current_user.id,
            mileage=mileage,
            reason=reason,
            employee_comment=employee_comment,
            status=RepairStatus.DRAFT,
            is_preliminary=True,
        )
        db.add(repair)
        db.flush()

        document = Document(
            repair_id=repair.id,
            uploaded_by_user_id=current_user.id,
            original_filename=file.filename or "document",
            storage_key=storage_key,
            mime_type=file.content_type,
            source_type=source_type,
            status=DocumentStatus.UPLOADED,
            is_primary=True,
            review_queue_priority=100,
            notes=notes,
        )
        db.add(document)
        db.flush()

        repair.source_document_id = document.id
        db.add(
            DocumentVersion(
                document_id=document.id,
                version_number=1,
                storage_key=storage_key,
                parsed_payload={
                    "pipeline": "uploaded",
                    "ocr_status": "queued",
                    "uploaded_by_user_id": current_user.id,
                },
                field_confidence_map={},
                change_summary="Initial upload",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        if destination.exists():
            destination.unlink()
        raise
    finally:
        file.file.close()

    created_document = load_document_with_relations(db, document.id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message="Document uploaded and repair draft created",
    )
