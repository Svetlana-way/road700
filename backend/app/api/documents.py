import shutil
from datetime import date
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query, get_repair_visibility_clause
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.api.upload_validation import validate_document_upload
from app.core.paths import STORAGE_ROOT
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.document import (
    DocumentBatchProcessResponse,
    DocumentComparisonFieldRead,
    DocumentComparisonReviewRequest,
    DocumentComparisonReviewResponse,
    DocumentCreateVehicleRequest,
    DocumentCreateVehicleResponse,
    DocumentComparisonResponse,
    DocumentImportJobRead,
    DocumentLinkVehicleRequest,
    DocumentListResponse,
    DocumentProcessResponse,
    DocumentRead,
    DocumentRepairRead,
    DocumentUpdateRequest,
    DocumentUploadResponse,
    DocumentVehicleRead,
)
from app.services.import_jobs import enqueue_document_processing_job

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
PLACEHOLDER_EXTERNAL_ID = "__batch_import_placeholder__"
IDENTIFIER_CHAR_TRANSLATION = str.maketrans(
    {
        "О": "O",
        "о": "O",
        "А": "A",
        "а": "A",
        "В": "B",
        "в": "B",
        "Е": "E",
        "е": "E",
        "К": "K",
        "к": "K",
        "М": "M",
        "м": "M",
        "Н": "H",
        "н": "H",
        "Р": "P",
        "р": "P",
        "С": "C",
        "с": "C",
        "Т": "T",
        "т": "T",
        "У": "Y",
        "у": "Y",
        "Х": "X",
        "х": "X",
    }
)


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
        stmt = stmt.where(get_repair_visibility_clause(current_user))
    return db.scalar(stmt)


def serialize_document(document: Document) -> DocumentRead:
    if document.repair is None or document.repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document relation is incomplete")

    latest_version = None
    if document.versions:
        latest_version = max(document.versions, key=lambda version: version.version_number)
    latest_import_job = None
    if document.import_jobs:
        latest_import_job = max(document.import_jobs, key=lambda item: item.id)

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
        latest_import_job=DocumentImportJobRead.model_validate(latest_import_job) if latest_import_job is not None else None,
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
            joinedload(Document.import_jobs),
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
        visible_repair = get_visible_repair(db, current_user, document.repair.id)
        if visible_repair is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return document


def get_or_create_placeholder_vehicle(db: Session) -> Vehicle:
    placeholder_vehicle = db.scalar(select(Vehicle).where(Vehicle.external_id == PLACEHOLDER_EXTERNAL_ID))
    if placeholder_vehicle is not None:
        return placeholder_vehicle

    placeholder_vehicle = Vehicle(
        external_id=PLACEHOLDER_EXTERNAL_ID,
        vehicle_type=VehicleType.TRUCK,
        brand="Черновик OCR",
        model="Требует определения техники",
        comment="Техническая placeholder-карточка для загрузок до распознавания техники",
        status=VehicleStatus.ACTIVE,
        source_payload={"kind": "placeholder_upload_vehicle"},
    )
    db.add(placeholder_vehicle)
    db.flush()
    return placeholder_vehicle


def normalize_identifier(value: str | None) -> str | None:
    if not value:
        return None
    normalized = "".join(ch for ch in value.translate(IDENTIFIER_CHAR_TRANSLATION).upper() if ch.isalnum())
    return normalized or None


def normalize_text_field(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def build_vehicle_snapshot(vehicle: Vehicle | None) -> dict | None:
    if vehicle is None:
        return None
    return {
        "id": vehicle.id,
        "external_id": vehicle.external_id,
        "vehicle_type": vehicle.vehicle_type.value,
        "plate_number": vehicle.plate_number,
        "vin": vehicle.vin,
        "brand": vehicle.brand,
        "model": vehicle.model,
        "year": vehicle.year,
        "status": vehicle.status.value,
    }


def find_existing_vehicle_match(
    db: Session,
    *,
    vin: str | None,
    plate_number: str | None,
) -> Vehicle | None:
    normalized_vin = normalize_identifier(vin)
    normalized_plate = normalize_identifier(plate_number)
    if not normalized_vin and not normalized_plate:
        return None

    vehicles = db.scalars(
        select(Vehicle).where(or_(Vehicle.external_id.is_(None), Vehicle.external_id != PLACEHOLDER_EXTERNAL_ID))
    ).all()
    matches: dict[int, Vehicle] = {}
    for vehicle in vehicles:
        if normalized_vin and normalize_identifier(vehicle.vin) == normalized_vin:
            matches[vehicle.id] = vehicle
        if normalized_plate and normalize_identifier(vehicle.plate_number) == normalized_plate:
            matches[vehicle.id] = vehicle

    if len(matches) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По VIN или госномеру найдено несколько карточек техники. Нужна ручная проверка.",
        )
    return next(iter(matches.values()), None)


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


def build_document_snapshot(document: Document) -> dict:
    latest_payload = get_latest_parsed_payload(document)
    extracted_fields = get_payload_mapping(latest_payload, "extracted_fields")
    return {
        "document_id": document.id,
        "repair_id": document.repair_id,
        "original_filename": document.original_filename,
        "kind": document.kind.value,
        "status": document.status.value,
        "is_primary": document.is_primary,
        "review_queue_priority": document.review_queue_priority,
        "ocr_confidence": document.ocr_confidence,
        "order_number": extracted_fields.get("order_number"),
    }


def set_primary_document_for_repair(target_document: Document, documents: list[Document]) -> None:
    for item in documents:
        item.is_primary = item.id == target_document.id
    target_document.repair.source_document_id = target_document.id


def pick_replacement_primary_document(repair: Repair, archived_document_id: int) -> Document | None:
    candidates = [
        item
        for item in repair.documents
        if item.id != archived_document_id
        and item.kind in {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}
        and item.status != DocumentStatus.ARCHIVED
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: (item.created_at, item.id))


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


def create_or_link_vehicle_from_document(
    db: Session,
    *,
    document: Document,
    payload: DocumentCreateVehicleRequest,
    current_admin: User,
) -> tuple[Document, bool]:
    if document.repair is None or document.repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Документ не связан с ремонтом")

    if document.repair.vehicle.external_id != PLACEHOLDER_EXTERNAL_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Документ уже привязан к карточке техники. Создание новой записи не требуется.",
        )

    normalized_plate = normalize_text_field(payload.plate_number)
    normalized_vin = normalize_text_field(payload.vin)
    if not normalized_plate and not normalized_vin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите хотя бы госномер или VIN для создания карточки техники.",
        )

    existing_vehicle = find_existing_vehicle_match(
        db,
        vin=normalized_vin,
        plate_number=normalized_plate,
    )

    old_vehicle = document.repair.vehicle
    created_new_vehicle = existing_vehicle is None
    target_vehicle = existing_vehicle

    if target_vehicle is None:
        target_vehicle = Vehicle(
            external_id=None,
            vehicle_type=payload.vehicle_type,
            vin=normalized_vin,
            plate_number=normalized_plate,
            brand=normalize_text_field(payload.brand),
            model=normalize_text_field(payload.model),
            year=payload.year,
            comment=normalize_text_field(payload.comment),
            status=VehicleStatus.ACTIVE,
            source_payload={
                "created_from_document_id": document.id,
                "created_from_repair_id": document.repair.id,
                "created_by_user_id": current_admin.id,
            },
        )
        db.add(target_vehicle)
        db.flush()

        db.add(
            AuditLog(
                user_id=current_admin.id,
                entity_type="vehicle",
                entity_id=str(target_vehicle.id),
                action_type="vehicle_created_from_document",
                old_value=None,
                new_value={
                    "vehicle": build_vehicle_snapshot(target_vehicle),
                    "document_id": document.id,
                    "repair_id": document.repair.id,
                },
            )
        )

    document.repair.vehicle_id = target_vehicle.id
    db.add(document.repair)
    db.flush()

    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="repair",
            entity_id=str(document.repair.id),
            action_type="repair_vehicle_relinked",
            old_value={"vehicle": build_vehicle_snapshot(old_vehicle)},
            new_value={
                "vehicle": build_vehicle_snapshot(target_vehicle),
                "document_id": document.id,
                "created_new_vehicle": created_new_vehicle,
            },
        )
    )
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type="document_vehicle_linked",
            old_value={"vehicle": build_vehicle_snapshot(old_vehicle)},
            new_value={
                "vehicle": build_vehicle_snapshot(target_vehicle),
                "repair_id": document.repair.id,
                "created_new_vehicle": created_new_vehicle,
            },
        )
    )
    db.commit()
    refreshed_document = load_document_with_relations(db, document.id)
    if refreshed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить документ")
    return refreshed_document, created_new_vehicle


def link_existing_vehicle_to_document(
    db: Session,
    *,
    document: Document,
    vehicle: Vehicle,
    current_user: User,
) -> Document:
    if document.repair is None or document.repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Документ не связан с ремонтом")

    if document.repair.vehicle.external_id != PLACEHOLDER_EXTERNAL_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ремонт уже привязан к карточке техники. Ручная перепривязка здесь не требуется.",
        )

    if vehicle.external_id == PLACEHOLDER_EXTERNAL_ID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя привязать placeholder-технику")

    old_vehicle = document.repair.vehicle
    document.repair.vehicle_id = vehicle.id
    db.add(document.repair)
    db.flush()

    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="repair",
            entity_id=str(document.repair.id),
            action_type="repair_vehicle_relinked",
            old_value={"vehicle": build_vehicle_snapshot(old_vehicle)},
            new_value={
                "vehicle": build_vehicle_snapshot(vehicle),
                "document_id": document.id,
                "created_new_vehicle": False,
            },
        )
    )
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type="document_vehicle_linked",
            old_value={"vehicle": build_vehicle_snapshot(old_vehicle)},
            new_value={
                "vehicle": build_vehicle_snapshot(vehicle),
                "repair_id": document.repair.id,
                "created_new_vehicle": False,
            },
        )
    )
    db.commit()
    refreshed_document = load_document_with_relations(db, document.id)
    if refreshed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить документ")
    return refreshed_document


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


def mark_document_for_reprocessing(db: Session, document_id: int) -> Document:
    document = load_document_with_relations(db, document_id)
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    document.status = DocumentStatus.UPLOADED
    document.review_queue_priority = 100
    document.ocr_confidence = None
    db.commit()

    refreshed_document = load_document_with_relations(db, document_id)
    if refreshed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить документ")
    return refreshed_document


def queue_document_processing(db: Session, document_id: int, *, retry_failed: bool = False):
    document = load_document_with_relations(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    job, _ = enqueue_document_processing_job(db, document, retry_failed=retry_failed)
    return job


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
            joinedload(Document.import_jobs),
        )
    )
    count_stmt = select(func.count(Document.id)).join(Document.repair)

    if current_user.role != UserRole.ADMIN:
        visibility_clause = get_repair_visibility_clause(current_user)
        stmt = stmt.where(visibility_clause)
        count_stmt = count_stmt.where(visibility_clause)

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


@router.patch("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: int,
    payload: DocumentUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentRead:
    document = db.execute(
        select(Document)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).joinedload(Repair.documents),
            joinedload(Document.versions),
            joinedload(Document.import_jobs),
        )
        .where(Document.id == document_id)
    ).unique().scalar_one_or_none()
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return serialize_document(document)

    old_snapshot = build_document_snapshot(document)
    old_primary_snapshot = build_primary_document_snapshot(document.repair, list(document.repair.documents))
    primary_changed = False

    if "status" in update_data:
        old_status = document.status
        new_status = update_data["status"]
        if old_status != new_status:
            document.status = new_status
            if new_status == DocumentStatus.ARCHIVED:
                document.review_queue_priority = 0
                if document.is_primary or document.repair.source_document_id == document.id:
                    replacement = pick_replacement_primary_document(document.repair, document.id)
                    if replacement is not None:
                        set_primary_document_for_repair(replacement, list(document.repair.documents))
                        primary_changed = True
                    else:
                        document.is_primary = True
                        document.repair.source_document_id = document.id
            elif old_status == DocumentStatus.ARCHIVED and document.review_queue_priority == 0:
                document.review_queue_priority = 20

    db.flush()
    new_snapshot = build_document_snapshot(document)

    if old_snapshot != new_snapshot:
        action_type = "document_archived" if new_snapshot["status"] == DocumentStatus.ARCHIVED.value else "document_status_updated"
        db.add(
            AuditLog(
                user_id=current_admin.id,
                entity_type="document",
                entity_id=str(document.id),
                action_type=action_type,
                old_value=old_snapshot,
                new_value=new_snapshot,
            )
        )

    if primary_changed:
        new_primary_snapshot = build_primary_document_snapshot(document.repair, list(document.repair.documents))
        db.add(
            AuditLog(
                user_id=current_admin.id,
                entity_type="repair",
                entity_id=str(document.repair.id),
                action_type="primary_document_changed",
                old_value=old_primary_snapshot,
                new_value=new_primary_snapshot,
            )
        )

    db.commit()

    refreshed_document = get_visible_document(db, current_admin, document_id)
    return serialize_document(refreshed_document)


@router.post("/upload", response_model=DocumentUploadResponse)
def upload_document(
    vehicle_id: Optional[int] = Form(default=None),
    repair_date: Optional[date] = Form(default=None),
    mileage: Optional[int] = Form(default=None),
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

    if vehicle_id is not None:
        vehicle = get_visible_vehicle(db, current_user, vehicle_id)
        if vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    else:
        vehicle = get_or_create_placeholder_vehicle(db)

    source_type = validate_document_upload(file)
    storage_key = build_storage_key(file.filename or "document")
    destination = STORAGE_ROOT / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)

    created_document_id = None
    try:
        with destination.open("wb") as target:
            shutil.copyfileobj(file.file, target)

        repair = Repair(
            order_number=order_number,
            repair_date=repair_date or date.today(),
            vehicle_id=vehicle.id,
            created_by_user_id=current_user.id,
            mileage=max(0, mileage or 0),
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
                    "uploaded_with_placeholder_vehicle": vehicle.external_id == PLACEHOLDER_EXTERNAL_ID,
                    "uploaded_repair_date": repair_date.isoformat() if repair_date else None,
                    "uploaded_mileage": mileage,
                    "uploaded_vehicle_id": vehicle_id,
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

    created_document = load_document_with_relations(db, created_document_id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")
    log_document_upload_event(db, current_user, created_document, action_type="document_uploaded")
    job = queue_document_processing(db, created_document_id)
    db.commit()

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message="Документ загружен и поставлен в очередь на обработку",
        job_id=job.id,
        import_status=job.status.value,
    )


@router.post("/{document_id}/create-vehicle", response_model=DocumentCreateVehicleResponse)
def create_vehicle_from_document(
    document_id: int,
    payload: DocumentCreateVehicleRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentCreateVehicleResponse:
    document = get_visible_document(db, current_admin, document_id)

    normalized_payload = DocumentCreateVehicleRequest(
        vehicle_type=payload.vehicle_type,
        plate_number=normalize_text_field(payload.plate_number),
        vin=normalize_text_field(payload.vin),
        brand=normalize_text_field(payload.brand),
        model=normalize_text_field(payload.model),
        year=payload.year,
        comment=normalize_text_field(payload.comment),
    )

    updated_document, created_new_vehicle = create_or_link_vehicle_from_document(
        db,
        document=document,
        payload=normalized_payload,
        current_admin=current_admin,
    )
    updated_document = mark_document_for_reprocessing(db, updated_document.id)
    job = queue_document_processing(db, updated_document.id)
    db.commit()
    message = (
        "Карточка техники создана и документ поставлен в очередь на перепроверку"
        if created_new_vehicle
        else "Ремонт перепривязан к существующей карточке техники и поставлен в очередь на перепроверку"
    )
    return DocumentCreateVehicleResponse(
        message=message,
        document=serialize_document(updated_document),
        repair_id=updated_document.repair.id,
        created_new_vehicle=created_new_vehicle,
        job_id=job.id,
        import_status=job.status.value,
    )


@router.post("/{document_id}/link-vehicle", response_model=DocumentCreateVehicleResponse)
def link_vehicle_to_document(
    document_id: int,
    payload: DocumentLinkVehicleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentCreateVehicleResponse:
    document = get_visible_document(db, current_user, document_id)
    vehicle = get_visible_vehicle(db, current_user, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Техника не найдена")

    updated_document = link_existing_vehicle_to_document(
        db,
        document=document,
        vehicle=vehicle,
        current_user=current_user,
    )
    updated_document = mark_document_for_reprocessing(db, updated_document.id)
    job = queue_document_processing(db, updated_document.id)
    db.commit()
    return DocumentCreateVehicleResponse(
        message="Ремонт перепривязан к выбранной карточке техники и поставлен в очередь на перепроверку",
        document=serialize_document(updated_document),
        repair_id=updated_document.repair.id,
        created_new_vehicle=False,
        job_id=job.id,
        import_status=job.status.value,
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

    source_type = validate_document_upload(file)
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

    created_document = load_document_with_relations(db, created_document_id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")
    log_document_upload_event(db, current_user, created_document, action_type="document_attached")
    job = queue_document_processing(db, created_document_id)
    db.commit()

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message="Документ прикреплён и поставлен в очередь на обработку",
        job_id=job.id,
        import_status=job.status.value,
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

    job = queue_document_processing(db, document_id, retry_failed=True)
    db.commit()
    processed_document = load_document_with_relations(db, document_id)
    if processed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not processed")

    return DocumentProcessResponse(
        document=serialize_document(processed_document),
        job_id=job.id,
        import_status=job.status.value,
        message="Документ поставлен в очередь на обработку",
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
            joinedload(Document.import_jobs),
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
            joinedload(Document.import_jobs),
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
    job_ids: list[int] = []
    for document_id in pending_documents:
        job = queue_document_processing(db, document_id, retry_failed=True)
        processed_ids.append(document_id)
        job_ids.append(job.id)
    db.commit()

    return DocumentBatchProcessResponse(
        processed_count=len(processed_ids),
        document_ids=processed_ids,
        job_ids=job_ids,
        status_counts={},
        message="Pending documents queued for processing",
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
    job_ids: list[int] = []
    status_counts: dict[str, int] = {}
    for document_id in document_ids:
        result = queue_document_processing(db, document_id, retry_failed=True)
        processed_ids.append(document_id)
        job_ids.append(result.id)
        status_key = result.status.value
        status_counts[status_key] = status_counts.get(status_key, 0) + 1
    db.commit()

    return DocumentBatchProcessResponse(
        processed_count=len(processed_ids),
        document_ids=processed_ids,
        job_ids=job_ids,
        status_counts=status_counts,
        message="Existing documents queued for reprocessing",
    )
