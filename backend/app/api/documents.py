from io import BytesIO
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.application.documents.actions import (
    build_document_snapshot,
    document_displays_queued_ocr_state,
    ensure_document_is_operational,
    ensure_document_vehicle_relation,
    ensure_document_visible_to_user,
    ensure_repair_is_operational,
    ensure_vehicle_is_operational,
    get_payload_mapping,
    get_visible_repair,
    load_document_with_relations,
    log_document_processing_queued_event,
    mark_document_for_reprocessing,
    queue_document_processing,
    queue_document_processing_result,
    reopen_repair_review_workflow,
)
from app.application.imports.document_jobs import get_document_display_import_job
from app.application.reports.repair_reports import (
    MANUAL_REVIEW_REASON_LABELS,
    build_repair_executive_report,
    build_repair_export_workbook,
    build_repair_pdf_sections,
    build_report_status_summary,
    build_report_workflow_summary,
    get_report_source_payload,
    resolve_report_document,
)
from app.application.services.visibility import (
    get_allowed_vehicle_ids_query,
    get_non_placeholder_vehicle_clause,
    get_repair_visibility_clause,
)
from app.constants.vehicles import PLACEHOLDER_EXTERNAL_ID
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.api.upload_validation import validate_document_upload
from app.core.config import settings
from app.core.paths import resolve_storage_path
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.service import Service
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
    DocumentReportRead,
    DocumentRepairRead,
    DocumentUpdateRequest,
    DocumentUploadResponse,
    DocumentVehicleRead,
)
from app.services.document_repair_relations import (
    PRIMARY_DOCUMENT_KINDS,
    assign_primary_document,
    build_canonical_source_document_id_expr,
    get_repair_source_document,
    is_document_primary_eligible,
    normalize_repair_primary_document,
)
from app.services.document_versions import get_latest_document_version, get_latest_parsed_payload
from app.services.document_parsers.field_extractors import normalize_compare_token, normalize_plate_compare_token
from app.services.exporting import safe_filename
from app.services.pdf_tools import merge_images_to_pdf, render_text_report_pdf

router = APIRouter(prefix="/documents", tags=["documents"])
COMPARISON_REVIEW_ACTIONS = {"keep_current_primary", "make_document_primary", "mark_reviewed"}
REPROCESSABLE_DOCUMENT_KINDS = frozenset(PRIMARY_DOCUMENT_KINDS)
REPROCESSABLE_DOCUMENT_STATUSES = {
    DocumentStatus.UPLOADED,
    DocumentStatus.RECOGNIZED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.CONFIRMED,
    DocumentStatus.OCR_ERROR,
}
VEHICLE_MANUAL_REVIEW_REASON_CODES = {"vehicle_missing", "vehicle_not_found"}
VEHICLE_CHECK_TYPES = {"ocr_vehicle_missing", "ocr_vehicle_not_found"}


def coerce_json_object(value: object) -> dict:
    return dict(value) if isinstance(value, dict) else {}

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    latest_version = get_latest_document_version(document)
    latest_import_job = get_document_display_import_job(document)
    source_document = get_repair_source_document(document.repair)

    return DocumentRead(
        id=document.id,
        original_filename=document.original_filename,
        source_type=document.source_type,
        kind=document.kind,
        mime_type=document.mime_type,
        status=document.status,
        is_primary=source_document is not None and source_document.id == document.id,
        ocr_confidence=document.ocr_confidence,
        review_queue_priority=document.review_queue_priority,
        notes=document.notes,
        created_at=document.created_at,
        parsed_payload=coerce_json_object(latest_version.parsed_payload) if latest_version and latest_version.parsed_payload is not None else None,
        repair=DocumentRepairRead.model_validate(document.repair),
        vehicle=DocumentVehicleRead.model_validate(document.repair.vehicle),
        latest_import_job=DocumentImportJobRead.model_validate(latest_import_job) if latest_import_job is not None else None,
    )


def serialize_document_report(
    document: Document,
    *,
    include_archived_fallback: bool = False,
) -> DocumentReportRead:
    ensure_document_vehicle_relation(document)
    repair = document.repair
    assert repair is not None
    source_document = get_repair_source_document(repair, include_archived_fallback=include_archived_fallback)
    report_document = resolve_report_document(
        repair,
        include_archived_fallback=include_archived_fallback,
        report_document=document,
    )
    workflow_status, workflow_comment = build_report_workflow_summary(repair)
    report_status, report_status_comment = build_report_status_summary(
        repair,
        include_archived_fallback=include_archived_fallback,
        report_document=report_document,
    )
    executive_report = build_repair_executive_report(
        repair,
        source_payload=get_report_source_payload(
            repair,
            include_archived_fallback=include_archived_fallback,
            report_document=report_document,
        ),
        manual_review_reason_labels=MANUAL_REVIEW_REASON_LABELS,
        source_document=report_document,
    )
    return DocumentReportRead(
        document_id=document.id,
        repair_id=repair.id,
        source_document_id=source_document.id if source_document is not None else None,
        report_document_id=report_document.id if report_document is not None else None,
        source_document_filename=source_document.original_filename if source_document is not None else None,
        report_document_filename=report_document.original_filename if report_document is not None else None,
        is_primary_document=source_document is not None and source_document.id == document.id,
        workflow_status=workflow_status,
        workflow_comment=workflow_comment,
        report_status=report_status,
        report_status_comment=report_status_comment,
        executive_report=executive_report,
    )


def build_storage_key(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    today = date.today()
    return f"documents/{today.year}/{today.month:02d}/{uuid4().hex}{suffix}"


def read_uploaded_file_bytes(upload: UploadFile) -> bytes:
    upload.file.seek(0)
    return upload.file.read()


def get_uploaded_file_size(upload: UploadFile) -> int:
    current_position = upload.file.tell()
    try:
        upload.file.seek(0, 2)
        return int(upload.file.tell())
    finally:
        upload.file.seek(current_position)


def close_uploaded_files(uploads: list[UploadFile]) -> None:
    for upload in uploads:
        upload.file.close()


def collect_document_uploads(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> list[UploadFile]:
    uploads = [item for item in (files or []) if item is not None]
    if file is not None:
        uploads.append(file)
    if not uploads:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сначала выберите файл")
    return uploads


def build_merged_upload_filename(uploads: list[UploadFile]) -> str:
    first_filename = (uploads[0].filename or "").strip()
    first_stem = Path(first_filename).stem.strip() if first_filename else ""
    base_name = first_stem or "document"
    return f"{base_name}_merged_{len(uploads)}_images.pdf"


def build_document_upload_artifact(
    file: UploadFile | None,
    files: list[UploadFile] | None,
) -> dict[str, object]:
    uploads = collect_document_uploads(file, files)
    if len(uploads) == 1:
        upload = uploads[0]
        source_type = validate_document_upload(upload)
        return {
            "content": read_uploaded_file_bytes(upload),
            "original_filename": upload.filename or "document",
            "mime_type": upload.content_type,
            "source_type": source_type,
            "uploaded_files": [upload.filename or "document"],
            "upload_mode": "single_file",
        }

    source_types = [validate_document_upload(upload) for upload in uploads]
    if any(source_type != "image" for source_type in source_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="При загрузке нескольких файлов поддерживаются только изображения: сервер объединит их в один PDF.",
        )

    total_upload_size = sum(get_uploaded_file_size(upload) for upload in uploads)
    if total_upload_size > settings.max_document_upload_size_bytes:
        max_size_mb = round(settings.max_document_upload_size_bytes / (1024 * 1024), 1)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Совокупный размер набора фотографий превышает лимит {max_size_mb} MB",
        )

    uploaded_files = [upload.filename or f"image_{index + 1}" for index, upload in enumerate(uploads)]
    try:
        merged_content = merge_images_to_pdf(
            [(uploaded_files[index], read_uploaded_file_bytes(upload)) for index, upload in enumerate(uploads)]
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return {
        "content": merged_content,
        "original_filename": build_merged_upload_filename(uploads),
        "mime_type": "application/pdf",
        "source_type": "pdf",
        "uploaded_files": uploaded_files,
        "upload_mode": "merged_images",
    }


def get_visible_document(
    db: Session,
    current_user: User,
    document_id: int,
) -> Document:
    document = load_document_with_relations(db, document_id)
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_document_visible_to_user(db, current_user, document)
    return document


def get_or_create_placeholder_vehicle(db: Session) -> Vehicle:
    placeholder_vehicle = db.scalar(select(Vehicle).where(Vehicle.external_id == PLACEHOLDER_EXTERNAL_ID))
    if placeholder_vehicle is not None:
        ensure_vehicle_is_operational(placeholder_vehicle)
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


def normalize_text_field(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def sync_vehicle_manual_review_state(document: Document, *, current_user: User) -> None:
    latest_version = get_latest_document_version(document)
    if latest_version is not None and isinstance(latest_version.parsed_payload, dict):
        parsed_payload = dict(latest_version.parsed_payload)
        raw_reasons = parsed_payload.get("manual_review_reasons")
        manual_review_reasons = [str(item) for item in raw_reasons] if isinstance(raw_reasons, list) else []
        filtered_reasons = [item for item in manual_review_reasons if item not in VEHICLE_MANUAL_REVIEW_REASON_CODES]
        if filtered_reasons != manual_review_reasons:
            parsed_payload["manual_review_reasons"] = filtered_reasons
            latest_version.parsed_payload = parsed_payload

    for check in document.repair.checks:
        if check.check_type not in VEHICLE_CHECK_TYPES:
            continue
        payload = coerce_json_object(check.calculation_payload)
        payload["resolution"] = {
            "is_resolved": True,
            "comment": "Техника привязана вручную, warning снят до повторной OCR-проверки",
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }
        check.is_resolved = True
        check.calculation_payload = payload


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
    normalized_vin = normalize_compare_token(vin)
    normalized_plate = normalize_plate_compare_token(plate_number)
    if not normalized_vin and not normalized_plate:
        return None

    vehicles = db.scalars(
        select(Vehicle).where(
            Vehicle.status != VehicleStatus.ARCHIVED,
            get_non_placeholder_vehicle_clause(),
        )
    ).all()
    matches: dict[int, Vehicle] = {}
    for vehicle in vehicles:
        if normalized_vin and normalize_compare_token(vehicle.vin) == normalized_vin:
            matches[vehicle.id] = vehicle
        if normalized_plate and normalize_plate_compare_token(vehicle.plate_number) == normalized_plate:
            matches[vehicle.id] = vehicle

    if len(matches) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По VIN или госномеру найдено несколько карточек техники. Нужна ручная проверка.",
        )
    return next(iter(matches.values()), None)


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
    source_document = get_repair_source_document(repair)
    source_document_id = source_document.id if source_document is not None else None
    return {
        "repair_id": repair.id,
        "source_document_id": source_document_id,
        "documents": [
            {
                "id": item.id,
                "kind": item.kind.value,
                "is_primary": source_document_id == item.id,
                "status": item.status.value,
            }
            for item in sorted(documents, key=lambda item: item.id)
        ],
    }


def ensure_document_can_be_primary(document: Document) -> None:
    if document.status == DocumentStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived documents cannot be primary",
        )


def archive_document_state(document: Document) -> bool:
    if document.repair is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document repair relation is incomplete")
    if document.status == DocumentStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document is already archived")

    source_document = get_repair_source_document(document.repair, include_archived_fallback=True)
    primary_changed = document.is_primary or (source_document is not None and source_document.id == document.id)
    document.status = DocumentStatus.ARCHIVED
    document.review_queue_priority = 0
    reopen_repair_review_workflow(document.repair)
    if primary_changed:
        normalize_repair_primary_document(document.repair)
    return primary_changed


def restore_document_state(document: Document) -> None:
    if document.repair is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document repair relation is incomplete")
    if document.repair.status == RepairStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restore a document while its repair is archived",
        )
    if document.repair.vehicle is not None and document.repair.vehicle.status == VehicleStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restore a document while its vehicle is archived",
        )
    if document.repair.service is not None and document.repair.service.status == ServiceStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restore a document while its service is archived",
        )
    if document.status != DocumentStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document is not archived")

    document.status = DocumentStatus.NEEDS_REVIEW
    if document.review_queue_priority == 0:
        document.review_queue_priority = 20
    normalize_repair_primary_document(document.repair)
    reopen_repair_review_workflow(document.repair)


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
    else:
        ensure_vehicle_is_operational(target_vehicle)

    document.repair.vehicle_id = target_vehicle.id
    db.add(document.repair)
    sync_vehicle_manual_review_state(document, current_user=current_admin)
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
    db.flush()
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
    sync_vehicle_manual_review_state(document, current_user=current_user)
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
    db.flush()
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
    snapshot = build_document_snapshot(document)
    snapshot["notes"] = document.notes
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type=action_type,
            old_value=None,
            new_value=snapshot,
        )
    )


def build_operational_document_id_query():
    return (
        select(Document.id)
        .join(Repair, Repair.id == Document.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
            Vehicle.status != VehicleStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
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
            joinedload(Document.repair).joinedload(Repair.service),
            joinedload(Document.repair).selectinload(Repair.documents),
            joinedload(Document.versions),
            joinedload(Document.import_jobs),
        )
    )
    count_stmt = select(func.count(Document.id)).join(Document.repair)

    operational_document_ids = build_operational_document_id_query()
    stmt = stmt.where(Document.id.in_(operational_document_ids))
    count_stmt = count_stmt.where(Document.id.in_(operational_document_ids))

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
    ensure_document_vehicle_relation(document)

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return serialize_document(document)

    old_snapshot = build_document_snapshot(document)

    if "status" in update_data:
        old_status = document.status
        new_status = update_data["status"]
        if old_status != new_status and (
            old_status == DocumentStatus.ARCHIVED or new_status == DocumentStatus.ARCHIVED
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Use explicit archive/restore endpoints for document archive changes",
            )
        if old_status != new_status:
            document.status = new_status

    db.flush()
    new_snapshot = build_document_snapshot(document)

    if old_snapshot != new_snapshot:
        db.add(
            AuditLog(
                user_id=current_admin.id,
                entity_type="document",
                entity_id=str(document.id),
                action_type="document_status_updated",
                old_value=old_snapshot,
                new_value=new_snapshot,
            )
        )

    db.commit()

    refreshed_document = get_visible_document(db, current_admin, document_id)
    return serialize_document(refreshed_document)


@router.post("/{document_id}/archive", response_model=DocumentRead)
def archive_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentRead:
    document = get_visible_document(db, current_admin, document_id)
    ensure_repair_is_operational(document.repair)

    old_snapshot = build_document_snapshot(document)
    old_primary_snapshot = build_primary_document_snapshot(document.repair, list(document.repair.documents))
    primary_changed = archive_document_state(document)

    db.flush()
    new_snapshot = build_document_snapshot(document)
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type="document_archived",
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


@router.post("/{document_id}/restore", response_model=DocumentRead)
def restore_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentRead:
    document = get_visible_document(db, current_admin, document_id)
    ensure_document_vehicle_relation(document)
    old_snapshot = build_document_snapshot(document)
    old_primary_snapshot = build_primary_document_snapshot(document.repair, list(document.repair.documents))
    restore_document_state(document)
    db.flush()
    new_snapshot = build_document_snapshot(document)
    new_primary_snapshot = build_primary_document_snapshot(document.repair, list(document.repair.documents))
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type="document_restored",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    if old_primary_snapshot != new_primary_snapshot:
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
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentUploadResponse:
    if kind not in PRIMARY_DOCUMENT_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only order documents and repeat scans can create a new repair",
        )

    if vehicle_id is not None:
        vehicle = get_visible_vehicle(db, current_user, vehicle_id)
        if vehicle is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        ensure_vehicle_is_operational(vehicle)
    else:
        vehicle = get_or_create_placeholder_vehicle(db)

    uploads = collect_document_uploads(file, files)
    upload_artifact = build_document_upload_artifact(file, files)
    storage_key = build_storage_key(str(upload_artifact["original_filename"]))
    destination = resolve_storage_path(storage_key)
    if destination is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid document storage path")
    destination.parent.mkdir(parents=True, exist_ok=True)

    created_document_id = None
    queued_job = None
    try:
        destination.write_bytes(upload_artifact["content"])

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
            original_filename=str(upload_artifact["original_filename"]),
            storage_key=storage_key,
            mime_type=str(upload_artifact["mime_type"]) if upload_artifact["mime_type"] is not None else None,
            source_type=str(upload_artifact["source_type"]),
            kind=kind,
            status=DocumentStatus.UPLOADED,
            is_primary=False,
            review_queue_priority=100,
            notes=notes,
        )
        db.add(document)
        db.flush()

        normalize_repair_primary_document(repair)
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
                    "upload_mode": upload_artifact["upload_mode"],
                    "uploaded_files": upload_artifact["uploaded_files"],
                },
                field_confidence_map={},
                change_summary="Initial upload",
            )
        )
        created_document_id = document.id
        created_document = load_document_with_relations(db, created_document_id)
        if created_document is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")
        log_document_upload_event(db, current_user, created_document, action_type="document_uploaded")
        queued_job = queue_document_processing(db, created_document_id)
        db.commit()
    except Exception:
        db.rollback()
        if destination.exists():
            destination.unlink()
        raise
    finally:
        close_uploaded_files(uploads)

    if created_document_id is None or queued_job is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    created_document = load_document_with_relations(db, created_document_id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message="Документ загружен и поставлен в очередь на обработку",
        job_id=queued_job.id,
        import_status=queued_job.status.value,
    )


@router.post("/{document_id}/create-vehicle", response_model=DocumentCreateVehicleResponse)
def create_vehicle_from_document(
    document_id: int,
    payload: DocumentCreateVehicleRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentCreateVehicleResponse:
    document = get_visible_document(db, current_admin, document_id)
    ensure_document_is_operational(document)

    normalized_payload = DocumentCreateVehicleRequest(
        vehicle_type=payload.vehicle_type,
        plate_number=normalize_text_field(payload.plate_number),
        vin=normalize_text_field(payload.vin),
        brand=normalize_text_field(payload.brand),
        model=normalize_text_field(payload.model),
        year=payload.year,
        comment=normalize_text_field(payload.comment),
    )

    try:
        old_snapshot = build_document_snapshot(document)
        updated_document, created_new_vehicle = create_or_link_vehicle_from_document(
            db,
            document=document,
            payload=normalized_payload,
            current_admin=current_admin,
        )
        job = queue_document_processing(db, updated_document.id, recheck=True)
        log_document_processing_queued_event(
            db,
            current_admin,
            document_id=updated_document.id,
            old_snapshot=old_snapshot,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    refreshed_document = get_visible_document(db, current_admin, document_id)
    message = (
        "Карточка техники создана и документ поставлен в очередь на перепроверку"
        if created_new_vehicle
        else "Ремонт перепривязан к существующей карточке техники и поставлен в очередь на перепроверку"
    )
    return DocumentCreateVehicleResponse(
        message=message,
        document=serialize_document(refreshed_document),
        repair_id=refreshed_document.repair.id,
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
    ensure_document_is_operational(document)
    vehicle = get_visible_vehicle(db, current_user, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Техника не найдена")
    ensure_vehicle_is_operational(vehicle)

    try:
        old_snapshot = build_document_snapshot(document)
        updated_document = link_existing_vehicle_to_document(
            db,
            document=document,
            vehicle=vehicle,
            current_user=current_user,
        )
        job = queue_document_processing(db, updated_document.id, recheck=True)
        log_document_processing_queued_event(
            db,
            current_user,
            document_id=updated_document.id,
            old_snapshot=old_snapshot,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    refreshed_document = get_visible_document(db, current_user, document_id)
    return DocumentCreateVehicleResponse(
        message="Ремонт перепривязан к выбранной карточке техники и поставлен в очередь на перепроверку",
        document=serialize_document(refreshed_document),
        repair_id=refreshed_document.repair.id,
        created_new_vehicle=False,
        job_id=job.id,
        import_status=job.status.value,
    )


@router.post("/upload-to-repair", response_model=DocumentUploadResponse)
def upload_document_to_repair(
    repair_id: int = Form(...),
    kind: DocumentKind = Form(default=DocumentKind.REPEAT_SCAN),
    notes: Optional[str] = Form(default=None),
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentUploadResponse:
    repair = get_visible_repair(db, current_user, repair_id)
    if repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair not found")
    ensure_repair_is_operational(repair)
    reopen_repair_review_workflow(repair)

    uploads = collect_document_uploads(file, files)
    upload_artifact = build_document_upload_artifact(file, files)
    storage_key = build_storage_key(str(upload_artifact["original_filename"]))
    destination = resolve_storage_path(storage_key)
    if destination is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid document storage path")
    destination.parent.mkdir(parents=True, exist_ok=True)

    created_document_id = None
    queued_job = None
    try:
        destination.write_bytes(upload_artifact["content"])

        document = Document(
            repair_id=repair.id,
            uploaded_by_user_id=current_user.id,
            original_filename=str(upload_artifact["original_filename"]),
            storage_key=storage_key,
            mime_type=str(upload_artifact["mime_type"]) if upload_artifact["mime_type"] is not None else None,
            source_type=str(upload_artifact["source_type"]),
            kind=kind,
            status=DocumentStatus.UPLOADED,
            is_primary=False,
            review_queue_priority=100,
            notes=notes,
        )
        db.add(document)
        db.flush()

        normalize_repair_primary_document(repair)

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
                    "upload_mode": upload_artifact["upload_mode"],
                    "uploaded_files": upload_artifact["uploaded_files"],
                },
                field_confidence_map={},
                change_summary="Attached to existing repair",
            )
        )
        created_document_id = document.id
        created_document = load_document_with_relations(db, created_document_id)
        if created_document is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")
        log_document_upload_event(db, current_user, created_document, action_type="document_attached")
        queued_job = queue_document_processing(db, created_document_id)
        db.commit()
    except Exception:
        db.rollback()
        if destination.exists():
            destination.unlink()
        raise
    finally:
        close_uploaded_files(uploads)

    if created_document_id is None or queued_job is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    created_document = load_document_with_relations(db, created_document_id)
    if created_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document was not created")

    return DocumentUploadResponse(
        document=serialize_document(created_document),
        message="Документ прикреплён и поставлен в очередь на обработку",
        job_id=queued_job.id,
        import_status=queued_job.status.value,
    )


@router.post("/{document_id}/process", response_model=DocumentProcessResponse)
def process_single_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentProcessResponse:
    document = get_visible_document(db, current_user, document_id)
    ensure_document_is_operational(document)
    old_snapshot = build_document_snapshot(document)
    job = queue_document_processing(db, document_id, retry_failed=True, recheck=True)
    processed_document = log_document_processing_queued_event(
        db,
        current_user,
        document_id=document_id,
        old_snapshot=old_snapshot,
    )
    db.commit()

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
    storage_path = resolve_storage_path(document.storage_key)
    if storage_path is None or not storage_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found")

    return FileResponse(
        path=storage_path,
        media_type=document.mime_type or "application/octet-stream",
        filename=document.original_filename,
    )


@router.get("/{document_id}/report", response_model=DocumentReportRead)
def get_document_report(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentReportRead:
    document = get_visible_document(db, current_user, document_id)
    return serialize_document_report(
        document,
        include_archived_fallback=current_user.role == UserRole.ADMIN,
    )


@router.get("/{document_id}/export")
def export_document_report(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StreamingResponse:
    document = get_visible_document(db, current_user, document_id)
    ensure_document_vehicle_relation(document)
    repair = document.repair
    assert repair is not None
    workbook = build_repair_export_workbook(
        repair,
        include_archived_documents=current_user.role == UserRole.ADMIN,
        report_document=document,
    )
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = safe_filename(
        f"document_{document.id}_{Path(document.original_filename).stem or repair.order_number or repair.vehicle.plate_number or 'report'}",
        f"document_{document.id}",
    )
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
    )


@router.get("/{document_id}/export.pdf")
def export_document_report_pdf(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StreamingResponse:
    document = get_visible_document(db, current_user, document_id)
    ensure_document_vehicle_relation(document)
    repair = document.repair
    assert repair is not None
    filename = safe_filename(
        f"document_{document.id}_{Path(document.original_filename).stem or repair.order_number or repair.vehicle.plate_number or 'report'}",
        f"document_{document.id}",
    )
    pdf_bytes = render_text_report_pdf(
        "Отчёт по документу",
        build_repair_pdf_sections(
            repair,
            include_archived_documents=current_user.role == UserRole.ADMIN,
            report_document=document,
        ),
        subtitle=f"Документ #{document.id} · {document.original_filename}",
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
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
    ensure_document_is_operational(left_document)
    ensure_document_is_operational(right_document)

    if left_document.id == right_document.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot compare a document with itself",
        )

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
    ensure_document_vehicle_relation(document)
    if document.kind not in PRIMARY_DOCUMENT_KINDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only order documents and repeat scans can be primary",
        )
    ensure_document_can_be_primary(document)
    ensure_repair_is_operational(document.repair)

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

    assign_primary_document(document.repair, document)
    new_snapshot = build_primary_document_snapshot(document.repair, sibling_documents)
    primary_changed = old_snapshot != new_snapshot

    if primary_changed:
        reopen_repair_review_workflow(document.repair)

    db.commit()

    refreshed_document = get_visible_document(db, current_admin, document_id)
    if primary_changed:
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
    ensure_document_vehicle_relation(compared_document)
    ensure_document_vehicle_relation(primary_document)
    if compared_document.id == primary_document.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot compare a document with itself")
    if compared_document.repair_id != primary_document.repair_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documents must belong to the same repair")
    canonical_source_document = get_repair_source_document(primary_document.repair)
    if canonical_source_document is None or canonical_source_document.id != primary_document.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reference document must be primary")
    ensure_document_can_be_primary(compared_document)
    ensure_document_can_be_primary(primary_document)
    ensure_repair_is_operational(compared_document.repair)
    ensure_repair_is_operational(primary_document.repair)

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
        if compared_document.kind not in PRIMARY_DOCUMENT_KINDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only order documents and repeat scans can be primary",
            )
        assign_primary_document(compared_document.repair, compared_document)
        reopen_repair_review_workflow(compared_document.repair)
        message = "Сравниваемый документ назначен основным"
    elif action == "keep_current_primary":
        assign_primary_document(compared_document.repair, primary_document)
        message = "Текущий основной документ сохранён"
    else:
        assign_primary_document(compared_document.repair, primary_document)
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

    refreshed_source_document = get_repair_source_document(refreshed_compared.repair)
    return DocumentComparisonReviewResponse(
        message=message,
        action=action,
        document_id=refreshed_compared.id,
        repair_id=refreshed_compared.repair.id,
        source_document_id=refreshed_source_document.id if refreshed_source_document is not None else None,
    )


@router.post("/process-pending", response_model=DocumentBatchProcessResponse)
def process_pending_documents(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> DocumentBatchProcessResponse:
    pending_documents = db.execute(
        build_operational_document_id_query()
        .where(Document.status.in_([DocumentStatus.UPLOADED, DocumentStatus.OCR_ERROR, DocumentStatus.NEEDS_REVIEW]))
        .order_by(Document.created_at.asc(), Document.id.asc())
        .limit(limit)
    ).scalars().all()

    processed_ids = []
    job_ids: list[int] = []
    batch_savepoint = db.begin_nested()
    try:
        for document_id in pending_documents:
            document = load_document_with_relations(db, document_id)
            if document is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
            old_snapshot = build_document_snapshot(document)
            result = queue_document_processing_result(db, document_id, retry_failed=True, recheck=True)
            if not result.queued:
                continue
            log_document_processing_queued_event(
                db,
                current_admin,
                document_id=document_id,
                old_snapshot=old_snapshot,
            )
            processed_ids.append(document_id)
            job_ids.append(result.job_id)
        batch_savepoint.commit()
        db.commit()
    except Exception:
        batch_savepoint.rollback()
        db.rollback()
        raise

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
    current_admin: User = Depends(get_current_admin),
) -> DocumentBatchProcessResponse:
    stmt = build_operational_document_id_query().where(
        Document.kind.in_(REPROCESSABLE_DOCUMENT_KINDS),
    )

    if status_filter is not None:
        stmt = stmt.where(Document.status == status_filter)
    else:
        stmt = stmt.where(Document.status.in_(REPROCESSABLE_DOCUMENT_STATUSES))

    if only_primary:
        stmt = stmt.where(Document.id == build_canonical_source_document_id_expr())

    document_ids = db.execute(
        stmt.order_by(Document.created_at.asc(), Document.id.asc()).limit(limit)
    ).scalars().all()

    processed_ids: list[int] = []
    job_ids: list[int] = []
    status_counts: dict[str, int] = {}
    batch_savepoint = db.begin_nested()
    try:
        for document_id in document_ids:
            document = load_document_with_relations(db, document_id)
            if document is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
            old_snapshot = build_document_snapshot(document)
            result = queue_document_processing_result(db, document_id, retry_failed=True, recheck=True)
            if not result.queued:
                continue
            log_document_processing_queued_event(
                db,
                current_admin,
                document_id=document_id,
                old_snapshot=old_snapshot,
            )
            processed_ids.append(document_id)
            job_ids.append(result.job_id)
            status_key = result.job_status
            status_counts[status_key] = status_counts.get(status_key, 0) + 1
        batch_savepoint.commit()
        db.commit()
    except Exception:
        batch_savepoint.rollback()
        db.rollback()
        raise

    return DocumentBatchProcessResponse(
        processed_count=len(processed_ids),
        document_ids=processed_ids,
        job_ids=job_ids,
        status_counts=status_counts,
        message="Existing documents queued for reprocessing",
    )
