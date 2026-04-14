from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.application.documents.actions import (
    build_document_snapshot,
    ensure_document_is_operational,
    log_document_processing_queued_event,
    queue_document_processing,
)
from app.application.imports.serializers import serialize_import_job
from app.application.services.visibility import get_repair_visibility_clause
from app.models.document import Document
from app.models.enums import DocumentStatus, ImportStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus
from app.models.imports import ImportJob
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.imports import ImportJobRead, ImportJobRetryResponse
router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_visible_job(db: Session, current_user: User, job_id: int) -> ImportJob:
    stmt = select(ImportJob).where(ImportJob.id == job_id)
    if current_user.role != UserRole.ADMIN:
        stmt = (
            stmt.join(Document, Document.id == ImportJob.document_id)
            .join(Repair, Repair.id == Document.repair_id)
            .join(Vehicle, Vehicle.id == Repair.vehicle_id)
            .outerjoin(Service, Service.id == Repair.service_id)
            .where(
                get_repair_visibility_clause(current_user),
                Document.status != DocumentStatus.ARCHIVED,
                Repair.status != RepairStatus.ARCHIVED,
                Vehicle.status != VehicleStatus.ARCHIVED,
                or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            )
        )
    job = db.execute(stmt).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.get("/{job_id}", response_model=ImportJobRead)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ImportJobRead:
    return serialize_import_job(get_visible_job(db, current_user, job_id))


@router.post("/{job_id}/retry", response_model=ImportJobRetryResponse)
def retry_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ImportJobRetryResponse:
    job = db.get(ImportJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.import_type != "document_ocr" or job.document_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retry is supported only for document OCR jobs")
    if job.status not in {ImportStatus.FAILED, ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_CONFLICTS}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job is already queued or being processed")

    document = db.scalar(
        select(Document)
        .options(joinedload(Document.repair).joinedload(Repair.vehicle))
        .where(Document.id == job.document_id)
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_document_is_operational(document)
    old_snapshot = build_document_snapshot(document)

    try:
        retried_job = queue_document_processing(db, document.id, retry_failed=True, recheck=True)
        log_document_processing_queued_event(
            db,
            current_admin,
            document_id=document.id,
            old_snapshot=old_snapshot,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(retried_job)
    return ImportJobRetryResponse(
        message="Задача поставлена в очередь повторно",
        job=serialize_import_job(retried_job),
    )
