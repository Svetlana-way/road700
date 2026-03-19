from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.enums import ImportStatus
from app.models.imports import ImportJob


DOCUMENT_OCR_IMPORT_TYPE = "document_ocr"
ACTIVE_IMPORT_JOB_STATUSES = (ImportStatus.QUEUED, ImportStatus.RETRY, ImportStatus.PROCESSING)
QUEUEABLE_IMPORT_JOB_STATUSES = (ImportStatus.QUEUED, ImportStatus.RETRY)


def _merge_summary(job: ImportJob, **updates: object) -> dict[str, object]:
    summary = dict(job.summary or {})
    summary.update({key: value for key, value in updates.items() if value is not None})
    return summary


def get_latest_import_job(db: Session, *, document_id: int, import_type: str) -> ImportJob | None:
    return db.scalar(
        select(ImportJob)
        .where(
            ImportJob.document_id == document_id,
            ImportJob.import_type == import_type,
        )
        .order_by(ImportJob.id.desc())
        .limit(1)
    )


def enqueue_document_processing_job(
    db: Session,
    document: Document,
    *,
    retry_failed: bool = False,
) -> tuple[ImportJob, bool]:
    latest_job = get_latest_import_job(db, document_id=document.id, import_type=DOCUMENT_OCR_IMPORT_TYPE)
    if latest_job is not None and latest_job.status in ACTIVE_IMPORT_JOB_STATUSES:
        return latest_job, False

    if retry_failed and latest_job is not None and latest_job.status == ImportStatus.FAILED:
        latest_job.status = ImportStatus.RETRY
        latest_job.error_message = None
        latest_job.finished_at = None
        latest_job.summary = _merge_summary(
            latest_job,
            stage="queued_for_retry",
            queued_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(latest_job)
        db.flush()
        return latest_job, True

    job = ImportJob(
        document_id=document.id,
        import_type=DOCUMENT_OCR_IMPORT_TYPE,
        source_filename=document.original_filename,
        status=ImportStatus.QUEUED,
        summary={
            "document_id": document.id,
            "stage": "queued",
            "queued_at": datetime.now(timezone.utc).isoformat(),
        },
        error_message=None,
        attempts=0,
        started_at=None,
        finished_at=None,
    )
    db.add(job)
    db.flush()
    return job, True


def claim_next_document_processing_job(db: Session) -> ImportJob | None:
    stmt = (
        select(ImportJob)
        .where(
            ImportJob.import_type == DOCUMENT_OCR_IMPORT_TYPE,
            ImportJob.status.in_(QUEUEABLE_IMPORT_JOB_STATUSES),
        )
        .order_by(ImportJob.created_at.asc(), ImportJob.id.asc())
        .limit(1)
    )

    bind = db.get_bind()
    if bind is not None and bind.dialect.name != "sqlite":
        stmt = stmt.with_for_update(skip_locked=True)

    job = db.execute(stmt).scalars().first()
    if job is None:
        return None

    now = datetime.now(timezone.utc)
    job.status = ImportStatus.PROCESSING
    job.started_at = now
    job.finished_at = None
    job.attempts = int(job.attempts or 0) + 1
    job.error_message = None
    job.summary = _merge_summary(
        job,
        stage="processing",
        started_at=now.isoformat(),
        attempts=job.attempts,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def mark_job_completed(
    db: Session,
    job: ImportJob,
    *,
    status: ImportStatus,
    summary: dict[str, object] | None = None,
) -> ImportJob:
    job.status = status
    job.finished_at = datetime.now(timezone.utc)
    job.error_message = None
    job.summary = _merge_summary(
        job,
        stage="completed",
        finished_at=job.finished_at.isoformat(),
        **(summary or {}),
    )
    db.add(job)
    return job


def mark_job_failed(
    db: Session,
    job: ImportJob,
    *,
    error_message: str,
    summary: dict[str, object] | None = None,
) -> ImportJob:
    job.status = ImportStatus.FAILED
    job.finished_at = datetime.now(timezone.utc)
    job.error_message = error_message
    job.summary = _merge_summary(
        job,
        stage="failed",
        finished_at=job.finished_at.isoformat(),
        **(summary or {}),
    )
    db.add(job)
    return job


def run_document_processing_job(db: Session, job: ImportJob):
    from app.services.document_processing import process_document

    if job.document_id is None:
        raise ValueError("Document OCR job does not have a document_id")
    return process_document(db, job.document_id, job_id=job.id)
