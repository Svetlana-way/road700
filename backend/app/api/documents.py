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
from app.core.paths import STORAGE_ROOT
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.document import (
    DocumentBatchProcessResponse,
    DocumentComparisonFieldRead,
    DocumentComparisonReviewRequest,
    DocumentComparisonReviewResponse,
    DocumentComparisonResponse,
    DocumentListResponse,
    DocumentProcessResponse,
    DocumentRead,
    DocumentRepairRead,
    DocumentUploadResponse,
    DocumentVehicleRead,
)
from app.services.document_processing import process_document

router = APIRouter(prefix="/documents", tags=["documents"])
COMPARISON_REVIEW_ACTIONS = {"keep_current_primary", "make_document_primary", "mark_reviewed"}
REPROCESSABLE_DOCUMENT_KINDS = {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}
REPROCESSABLE_DOCUMENT_STATUSES = {
    DocumentStatus.UPLOADED,
    DocumentStatus.RECOGNIZED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.CONFIRMED,
    DocumentStatus.OCR_ERROR,
}


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


def get_latest_parsed_payload(document: Document) -> dict:
    if not document.versions:
        return {}
    latest_version = max(document.versions, key=lambda version: version.version_number)
    if latest_version.parsed_payload and isinstance(latest_version.parsed_payload, dict):
        return latest_version.parsed_payload
    return {}


def get_payload_mapping(payload: dict, key: str) -> dict:
    value = payload.get(key)
    if isinstance(value, dict):
        return value
    return {}


def stringify_comparison_value(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def build_comparison_field(
    field_name: str,
    label: str,
    left_value: object,
    right_value: object,
) -> DocumentComparisonFieldRead:
    left_string = stringify_comparison_value(left_value)
    right_string = stringify_comparison_value(right_value)
    return DocumentComparisonFieldRead(
        field_name=field_name,
        label=label,
        left_value=left_string,
        right_value=right_string,
        is_different=left_string != right_string,
    )


def build_primary_document_snapshot(repair: Repair, documents: list[Document]) -> dict:
    return {
        "repair_id": repair.id,
        "source_document_id": repair.source_document_id,
        "documents": [
            {
                "id": item.id,
                "kind": item.kind.value,
                "is_primary": item.is_primary,
                "status": item.status.value,
            }
            for item in sorted(documents, key=lambda item: item.id)
        ],
    }


def set_primary_document_for_repair(target_document: Document, documents: list[Document]) -> None:
    for item in documents:
        item.is_primary = item.id == target_document.id
    target_document.repair.source_document_id = target_document.id


def append_comparison_review_note(
    existing: Optional[str],
    action: str,
    current_admin: User,
    counterpart: Document,
    comment: Optional[str],
) -> str:
    action_labels = {
        "keep_current_primary": "Оставлен текущий основной документ",
        "make_document_primary": "Документ выбран основным после сравнения",
        "mark_reviewed": "Сравнение документов проверено",
    }
    normalized_comment = (comment or "").strip()
    note = (
        f"[Сравнение документов] {action_labels[action]} "
        f"({counterpart.original_filename}) · {current_admin.full_name}"
    )
    if normalized_comment:
        note = f"{note}: {normalized_comment}"
    if existing:
        return f"{existing}\n{note}"
    return note


def log_document_upload_event(
    db: Session,
    current_user: User,
    document: Document,
    action_type: str,
) -> None:
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type=action_type,
            old_value=None,
            new_value={
                "document_id": document.id,
                "repair_id": document.repair_id,
                "original_filename": document.original_filename,
                "kind": document.kind.value,
                "status": document.status.value,
                "is_primary": document.is_primary,
                "notes": document.notes,
            },
        )
    )


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
    destination = STORAGE_ROOT / storage_key
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
    log_document_upload_event(db, current_user, created_document, action_type="document_uploaded")
    db.commit()

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
    destination = STORAGE_ROOT / storage_key
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
    log_document_upload_event(db, current_user, created_document, action_type="document_attached")
    db.commit()

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
    storage_path = STORAGE_ROOT / document.storage_key
    if not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found")

    return FileResponse(
        path=storage_path,
        media_type=document.mime_type or "application/octet-stream",
        filename=document.original_filename,
    )


@router.get("/{document_id}/compare", response_model=DocumentComparisonResponse)
def compare_documents(
    document_id: int,
    with_document_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentComparisonResponse:
    left_document = get_visible_document(db, current_user, document_id)
    right_document = get_visible_document(db, current_user, with_document_id)

    if left_document.repair_id != right_document.repair_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documents must belong to the same repair",
        )

    left_payload = get_latest_parsed_payload(left_document)
    right_payload = get_latest_parsed_payload(right_document)
    left_fields = get_payload_mapping(left_payload, "extracted_fields")
    right_fields = get_payload_mapping(right_payload, "extracted_fields")
    left_items = get_payload_mapping(left_payload, "extracted_items")
    right_items = get_payload_mapping(right_payload, "extracted_items")

    compared_fields = [
        build_comparison_field("order_number", "Номер заказ-наряда", left_fields.get("order_number"), right_fields.get("order_number")),
        build_comparison_field("repair_date", "Дата ремонта", left_fields.get("repair_date"), right_fields.get("repair_date")),
        build_comparison_field("mileage", "Пробег", left_fields.get("mileage"), right_fields.get("mileage")),
        build_comparison_field("service_name", "Сервис", left_fields.get("service_name"), right_fields.get("service_name")),
        build_comparison_field("work_total", "Сумма работ", left_fields.get("work_total"), right_fields.get("work_total")),
        build_comparison_field("parts_total", "Сумма запчастей", left_fields.get("parts_total"), right_fields.get("parts_total")),
        build_comparison_field("vat_total", "НДС", left_fields.get("vat_total"), right_fields.get("vat_total")),
        build_comparison_field("grand_total", "Итого", left_fields.get("grand_total"), right_fields.get("grand_total")),
    ]

    left_works = left_items.get("works") if isinstance(left_items, dict) and isinstance(left_items.get("works"), list) else []
    right_works = right_items.get("works") if isinstance(right_items, dict) and isinstance(right_items.get("works"), list) else []
    left_parts = left_items.get("parts") if isinstance(left_items, dict) and isinstance(left_items.get("parts"), list) else []
    right_parts = right_items.get("parts") if isinstance(right_items, dict) and isinstance(right_items.get("parts"), list) else []

    return DocumentComparisonResponse(
        left_document=serialize_document(left_document),
        right_document=serialize_document(right_document),
        compared_fields=compared_fields,
        works_count_left=len(left_works),
        works_count_right=len(right_works),
        parts_count_left=len(left_parts),
        parts_count_right=len(right_parts),
    )


@router.post("/{document_id}/set-primary", response_model=DocumentRead)
def set_primary_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentRead:
    document = get_visible_document(db, current_admin, document_id)
    if document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document repair relation is incomplete")
    if document.kind not in {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only order documents and repeat scans can be primary",
        )

    sibling_documents = db.execute(
        select(Document)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.versions),
        )
        .where(Document.repair_id == document.repair_id)
    ).unique().scalars().all()

    old_snapshot = build_primary_document_snapshot(document.repair, sibling_documents)

    set_primary_document_for_repair(document, sibling_documents)

    db.commit()

    refreshed_document = get_visible_document(db, current_admin, document_id)
    refreshed_siblings = db.execute(
        select(Document).where(Document.repair_id == refreshed_document.repair_id)
    ).scalars().all()
    new_snapshot = build_primary_document_snapshot(refreshed_document.repair, refreshed_siblings)

    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="repair",
            entity_id=str(refreshed_document.repair.id),
            action_type="primary_document_changed",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="document",
            entity_id=str(refreshed_document.id),
            action_type="set_primary",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.commit()

    return serialize_document(refreshed_document)


@router.post("/{document_id}/compare/review", response_model=DocumentComparisonReviewResponse)
def review_document_comparison(
    document_id: int,
    payload: DocumentComparisonReviewRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentComparisonReviewResponse:
    action = payload.action.strip().lower()
    if action not in COMPARISON_REVIEW_ACTIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported comparison review action")

    compared_document = get_visible_document(db, current_admin, document_id)
    primary_document = get_visible_document(db, current_admin, payload.with_document_id)
    if compared_document.repair_id != primary_document.repair_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documents must belong to the same repair")
    if not primary_document.is_primary:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reference document must be primary")

    sibling_documents = db.execute(
        select(Document)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.versions),
        )
        .where(Document.repair_id == compared_document.repair_id)
    ).unique().scalars().all()

    old_snapshot = build_primary_document_snapshot(compared_document.repair, sibling_documents)
    if action == "make_document_primary":
        if compared_document.kind not in {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only order documents and repeat scans can be primary",
            )
        set_primary_document_for_repair(compared_document, sibling_documents)
        message = "Сравниваемый документ назначен основным"
    elif action == "keep_current_primary":
        message = "Текущий основной документ сохранён"
    else:
        message = "Сравнение документов отмечено как проверенное"

    compared_document.notes = append_comparison_review_note(
        compared_document.notes,
        action=action,
        current_admin=current_admin,
        counterpart=primary_document,
        comment=payload.comment,
    )
    if action == "keep_current_primary":
        primary_document.notes = append_comparison_review_note(
            primary_document.notes,
            action=action,
            current_admin=current_admin,
            counterpart=compared_document,
            comment=payload.comment,
        )

    db.commit()

    refreshed_compared = get_visible_document(db, current_admin, compared_document.id)
    refreshed_siblings = db.execute(select(Document).where(Document.repair_id == refreshed_compared.repair_id)).scalars().all()
    new_snapshot = build_primary_document_snapshot(refreshed_compared.repair, refreshed_siblings)
    new_snapshot["comparison_review"] = {
        "action": action,
        "comment": (payload.comment or "").strip() or None,
        "compared_document_id": refreshed_compared.id,
        "with_document_id": payload.with_document_id,
    }

    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="repair",
            entity_id=str(refreshed_compared.repair.id),
            action_type="document_comparison_reviewed",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="document",
            entity_id=str(refreshed_compared.id),
            action_type=f"comparison_{action}",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.commit()

    return DocumentComparisonReviewResponse(
        message=message,
        action=action,
        document_id=refreshed_compared.id,
        repair_id=refreshed_compared.repair.id,
        source_document_id=refreshed_compared.repair.source_document_id,
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
        status_counts={},
        message="Pending documents processed",
    )


@router.post("/reprocess-existing", response_model=DocumentBatchProcessResponse)
def reprocess_existing_documents(
    limit: int = Query(default=50, ge=1, le=500),
    status_filter: Optional[DocumentStatus] = Query(default=None, alias="status"),
    only_primary: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> DocumentBatchProcessResponse:
    stmt = select(Document.id).where(
        Document.kind.in_(REPROCESSABLE_DOCUMENT_KINDS),
    )

    if status_filter is not None:
        stmt = stmt.where(Document.status == status_filter)
    else:
        stmt = stmt.where(Document.status.in_(REPROCESSABLE_DOCUMENT_STATUSES))

    if only_primary:
        stmt = stmt.where(Document.is_primary.is_(True))

    document_ids = db.execute(
        stmt.order_by(Document.created_at.asc(), Document.id.asc()).limit(limit)
    ).scalars().all()

    processed_ids: list[int] = []
    status_counts: dict[str, int] = {}
    for document_id in document_ids:
        result = process_document(db, document_id)
        processed_ids.append(document_id)
        status_key = result.document.status.value
        status_counts[status_key] = status_counts.get(status_key, 0) + 1

    return DocumentBatchProcessResponse(
        processed_count=len(processed_ids),
        document_ids=processed_ids,
        status_counts=status_counts,
        message="Existing documents reprocessed",
    )
