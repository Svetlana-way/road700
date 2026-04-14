from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.application.services.visibility import get_repair_visibility_clause
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus
from app.models.imports import ImportJob
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.application.documents.repair_relations import ensure_repair_vehicle_relation, get_repair_source_document
from app.application.documents.document_versions import get_latest_parsed_payload
from app.application.imports.document_jobs import enqueue_document_processing_job


def get_visible_repair(
    db: Session,
    current_user: User,
    repair_id: int,
) -> Repair | None:
    stmt = select(Repair).where(Repair.id == repair_id)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(get_repair_visibility_clause(current_user))
    return db.scalar(stmt)


def load_document_with_relations(db: Session, document_id: int) -> Document | None:
    stmt = (
        select(Document)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).joinedload(Repair.service),
            joinedload(Document.repair).selectinload(Repair.documents),
            joinedload(Document.versions),
            joinedload(Document.import_jobs),
        )
        .where(Document.id == document_id)
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def ensure_vehicle_is_operational(vehicle: Vehicle) -> None:
    if vehicle.status == VehicleStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived vehicles cannot be used in operational actions")


def ensure_document_visible_to_user(db: Session, current_user: User, document: Document) -> None:
    if document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if current_user.role == UserRole.ADMIN:
        return

    visible_repair = get_visible_repair(db, current_user, document.repair.id)
    if visible_repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if (
        document.status == DocumentStatus.ARCHIVED
        or document.repair.status == RepairStatus.ARCHIVED
        or document.repair.vehicle is None
        or document.repair.vehicle.status == VehicleStatus.ARCHIVED
        or (document.repair.service is not None and document.repair.service.status == ServiceStatus.ARCHIVED)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


def ensure_document_vehicle_relation(document: Document) -> None:
    if document.repair is None or document.repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


def ensure_repair_is_operational(repair: Repair) -> None:
    ensure_repair_vehicle_relation(repair)
    if repair.status == RepairStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived repairs cannot be modified")
    ensure_vehicle_is_operational(repair.vehicle)
    if repair.service is not None and repair.service.status == ServiceStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repairs for archived services cannot be modified",
        )


def ensure_document_is_operational(document: Document) -> None:
    if document.status == DocumentStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archived documents cannot be modified")
    ensure_document_vehicle_relation(document)
    ensure_repair_is_operational(document.repair)


def get_payload_mapping(payload: dict, key: str) -> dict:
    value = payload.get(key)
    if isinstance(value, dict):
        return value
    return {}


def build_document_snapshot(document: Document) -> dict:
    latest_payload = get_latest_parsed_payload(document)
    extracted_fields = get_payload_mapping(latest_payload, "extracted_fields")
    source_document = get_repair_source_document(document.repair) if document.repair is not None else None
    return {
        "document_id": document.id,
        "repair_id": document.repair_id,
        "original_filename": document.original_filename,
        "kind": document.kind.value,
        "status": document.status.value,
        "repair_status": document.repair.status.value if document.repair is not None else None,
        "is_preliminary": bool(document.repair.is_preliminary) if document.repair is not None else None,
        "is_primary": source_document is not None and source_document.id == document.id,
        "review_queue_priority": document.review_queue_priority,
        "ocr_confidence": document.ocr_confidence,
        "order_number": extracted_fields.get("order_number"),
    }


def log_document_processing_queued_event(
    db: Session,
    current_user: User,
    *,
    document_id: int,
    old_snapshot: dict,
) -> Document:
    refreshed_document = load_document_with_relations(db, document_id)
    if refreshed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить документ")

    new_snapshot = build_document_snapshot(refreshed_document)
    if old_snapshot != new_snapshot:
        db.add(
            AuditLog(
                user_id=current_user.id,
                entity_type="document",
                entity_id=str(refreshed_document.id),
                action_type="document_processing_queued",
                old_value=old_snapshot,
                new_value=new_snapshot,
            )
        )
    return refreshed_document


def reopen_repair_review_workflow(repair: Repair) -> None:
    if repair.status in {RepairStatus.CONFIRMED, RepairStatus.EMPLOYEE_CONFIRMED}:
        repair.status = RepairStatus.IN_REVIEW
        repair.is_preliminary = True


def mark_document_for_reprocessing(db: Session, document_id: int, *, current_user: User | None = None) -> Document:
    document = load_document_with_relations(db, document_id)
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_document_is_operational(document)

    reopen_repair_review_workflow(document.repair)
    document.status = DocumentStatus.UPLOADED
    document.review_queue_priority = 100
    document.ocr_confidence = None
    next_version_number = max((item.version_number for item in document.versions), default=0) + 1
    parsed_payload = {
        "pipeline": "reprocessing",
        "document_kind": document.kind.value,
        "ocr_status": "queued",
        "repair_id": document.repair.id,
    }
    if current_user is not None:
        parsed_payload["queued_by_user_id"] = current_user.id

    db.add(
        DocumentVersion(
            document_id=document.id,
            version_number=next_version_number,
            storage_key=document.storage_key,
            parsed_payload=parsed_payload,
            field_confidence_map={},
            change_summary="Queued for reprocessing",
        )
    )
    db.flush()

    refreshed_document = load_document_with_relations(db, document_id)
    if refreshed_document is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить документ")
    return refreshed_document


def document_displays_queued_ocr_state(document: Document) -> bool:
    if document.status != DocumentStatus.UPLOADED or document.ocr_confidence is not None:
        return False
    return get_latest_parsed_payload(document).get("ocr_status") == "queued"


@dataclass(frozen=True)
class QueueDocumentProcessingResult:
    job_id: int
    job_status: str
    queued: bool


def queue_document_processing_result(
    db: Session,
    document_id: int,
    *,
    retry_failed: bool = False,
    recheck: bool = False,
) -> QueueDocumentProcessingResult:
    document = load_document_with_relations(db, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_document_is_operational(document)
    job, created = enqueue_document_processing_job(db, document, retry_failed=retry_failed)
    refreshed_document_state = False
    if recheck and (created or not document_displays_queued_ocr_state(document)):
        mark_document_for_reprocessing(db, document_id)
        refreshed_document_state = True
    return QueueDocumentProcessingResult(
        job_id=job.id,
        job_status=job.status.value,
        queued=created or refreshed_document_state,
    )


def queue_document_processing(
    db: Session,
    document_id: int,
    *,
    retry_failed: bool = False,
    recheck: bool = False,
) -> ImportJob:
    result = queue_document_processing_result(
        db,
        document_id,
        retry_failed=retry_failed,
        recheck=recheck,
    )
    job = db.get(ImportJob, result.job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document processing job not found")
    return job
