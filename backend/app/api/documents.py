import shutil
from datetime import date
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.document import (
    DocumentBatchProcessResponse,
    DocumentListResponse,
    DocumentProcessResponse,
    DocumentRead,
    DocumentRepairRead,
    DocumentUploadResponse,
    DocumentVehicleRead,
)
from app.services.document_processing import process_document


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


def get_visible_repair(
    db: Session,
    current_user: User,
    repair_id: int,
) -> Optional[Repair]:
    stmt = select(Repair).where(Repair.id == repair_id)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Repair.vehicle_id.in_(get_allowed_vehicle_ids_query(current_user)))
    return db.scalar(stmt)


def serialize_document(document: Document) -> DocumentRead:
    if document.repair is None or document.repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document relation is incomplete")

    latest_version = None
    if document.versions:
        latest_version = max(document.versions, key=lambda version: version.version_number)

    return DocumentRead(
        id=document.id,
        original_filename=document.original_filename,
        source_type=document.source_type,
        kind=document.kind,
        mime_type=document.mime_type,
        status=document.status,
        is_primary=document.is_primary,
        ocr_confidence=document.ocr_confidence,
        review_queue_priority=document.review_queue_priority,
        notes=document.notes,
        created_at=document.created_at,
        parsed_payload=latest_version.parsed_payload if latest_version is not None else None,
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
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.versions),
        )
        .where(Document.id == document_id)
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def get_visible_document(
    db: Session,
    current_user: User,
    document_id: int,
) -> Document:
    document = load_document_with_relations(db, document_id)
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if current_user.role != UserRole.ADMIN:
        visible_vehicle = get_visible_vehicle(db, current_user, document.repair.vehicle_id)
        if visible_vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return document


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
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.versions),
        )
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
    kind: DocumentKind = Form(default=DocumentKind.ORDER),
    order_number: Optional[str] = Form(default=None),
    reason: Optional[str] = Form(default=None),
    employee_comment: Optional[str] = Form(default=None),
    notes: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentUploadResponse:
    if kind not in {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only order documents and repeat scans can create a new repair",
        )

    vehicle = get_visible_vehicle(db, current_user, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    source_type = detect_source_type(file)
    storage_key = build_storage_key(file.filename or "document")
    destination = LOCAL_STORAGE_ROOT / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)

    created_document_id = None
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
            kind=kind,
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
                    "document_kind": kind.value,
                    "ocr_status": "queued",
                    "uploaded_by_user_id": current_user.id,
                },
                field_confidence_map={},
                change_summary="Initial upload",
            )
        )
        db.commit()
        created_document_id = document.id
    except Exception:
        db.rollback()
        if destination.exists():
            destination.unlink()
        raise
    finally:
        file.file.close()

    if created_document_id is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    processing_result = process_document(db, created_document_id)
    created_document = load_document_with_relations(db, created_document_id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message=processing_result.message,
    )


@router.post("/upload-to-repair", response_model=DocumentUploadResponse)
def upload_document_to_repair(
    repair_id: int = Form(...),
    kind: DocumentKind = Form(default=DocumentKind.REPEAT_SCAN),
    notes: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentUploadResponse:
    repair = get_visible_repair(db, current_user, repair_id)
    if repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair not found")

    source_type = detect_source_type(file)
    storage_key = build_storage_key(file.filename or "document")
    destination = LOCAL_STORAGE_ROOT / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)

    created_document_id = None
    try:
        with destination.open("wb") as target:
            shutil.copyfileobj(file.file, target)

        existing_documents_total = db.scalar(
            select(func.count(Document.id)).where(Document.repair_id == repair.id)
        ) or 0

        document = Document(
            repair_id=repair.id,
            uploaded_by_user_id=current_user.id,
            original_filename=file.filename or "document",
            storage_key=storage_key,
            mime_type=file.content_type,
            source_type=source_type,
            kind=kind,
            status=DocumentStatus.UPLOADED,
            is_primary=existing_documents_total == 0,
            review_queue_priority=100,
            notes=notes,
        )
        db.add(document)
        db.flush()

        if repair.source_document_id is None:
            repair.source_document_id = document.id

        db.add(
            DocumentVersion(
                document_id=document.id,
                version_number=1,
                storage_key=storage_key,
                parsed_payload={
                    "pipeline": "uploaded_to_repair",
                    "document_kind": kind.value,
                    "ocr_status": "queued",
                    "uploaded_by_user_id": current_user.id,
                    "repair_id": repair.id,
                },
                field_confidence_map={},
                change_summary="Attached to existing repair",
            )
        )
        db.commit()
        created_document_id = document.id
    except Exception:
        db.rollback()
        if destination.exists():
            destination.unlink()
        raise
    finally:
        file.file.close()

    if created_document_id is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    processing_result = process_document(db, created_document_id)
    created_document = load_document_with_relations(db, created_document_id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message=processing_result.message,
    )


@router.post("/{document_id}/process", response_model=DocumentProcessResponse)
def process_single_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentProcessResponse:
    document = load_document_with_relations(db, document_id)
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if current_user.role != UserRole.ADMIN:
        visible_vehicle = get_visible_vehicle(db, current_user, document.repair.vehicle_id)
        if visible_vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    result = process_document(db, document_id)
    processed_document = load_document_with_relations(db, document_id)
    if processed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not processed")

    return DocumentProcessResponse(
        document=serialize_document(processed_document),
        job_id=result.job.id,
        import_status=result.job.status.value,
        message=result.message,
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> FileResponse:
    document = get_visible_document(db, current_user, document_id)
    storage_path = LOCAL_STORAGE_ROOT / document.storage_key
    if not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found")

    return FileResponse(
        path=storage_path,
        media_type=document.mime_type or "application/octet-stream",
        filename=document.original_filename,
    )


@router.post("/process-pending", response_model=DocumentBatchProcessResponse)
def process_pending_documents(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> DocumentBatchProcessResponse:
    pending_documents = db.execute(
        select(Document.id)
        .where(Document.status.in_([DocumentStatus.UPLOADED, DocumentStatus.OCR_ERROR, DocumentStatus.NEEDS_REVIEW]))
        .order_by(Document.created_at.asc(), Document.id.asc())
        .limit(limit)
    ).scalars().all()

    processed_ids = []
    for document_id in pending_documents:
        process_document(db, document_id)
        processed_ids.append(document_id)

    return DocumentBatchProcessResponse(
        processed_count=len(processed_ids),
        document_ids=processed_ids,
        message="Pending documents processed",
    )
