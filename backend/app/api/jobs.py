from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.access import get_repair_visibility_clause
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.document import Document
from app.models.enums import ImportStatus, UserRole
from app.models.imports import ImportJob
from app.models.repair import Repair
from app.models.user import User
from app.schemas.imports import ImportJobRead, ImportJobRetryResponse
from app.services.import_jobs import enqueue_document_processing_job


router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_visible_job(db: Session, current_user: User, job_id: int) -> ImportJob:
    stmt = select(ImportJob).where(ImportJob.id == job_id)
    if current_user.role != UserRole.ADMIN:
        stmt = (
            stmt.join(Document, Document.id == ImportJob.document_id)
            .join(Repair, Repair.id == Document.repair_id)
            .where(get_repair_visibility_clause(current_user))
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
    return ImportJobRead.model_validate(get_visible_job(db, current_user, job_id))


@router.post("/{job_id}/retry", response_model=ImportJobRetryResponse)
def retry_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ImportJobRetryResponse:
    job = db.get(ImportJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.import_type != "document_ocr" or job.document_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retry is supported only for document OCR jobs")
    if job.status not in {ImportStatus.FAILED, ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_CONFLICTS}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job is already queued or being processed")

    document = db.scalar(select(Document).where(Document.id == job.document_id))
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    retried_job, _ = enqueue_document_processing_job(db, document, retry_failed=True)
    db.commit()
    db.refresh(retried_job)
    return ImportJobRetryResponse(
        message="Задача поставлена в очередь повторно",
        job=ImportJobRead.model_validate(retried_job),
    )
