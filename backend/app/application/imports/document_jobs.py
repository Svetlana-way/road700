from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased, joinedload

from app.application.documents.guards import get_document_processing_block_reason
from app.models.document import Document
from app.models.enums import ImportStatus
from app.models.imports import ImportJob
from app.models.repair import Repair


DOCUMENT_OCR_IMPORT_TYPE = "document_ocr"
ACTIVE_IMPORT_JOB_STATUSES = (ImportStatus.QUEUED, ImportStatus.RETRY, ImportStatus.PROCESSING)
QUEUEABLE_IMPORT_JOB_STATUSES = (ImportStatus.QUEUED, ImportStatus.RETRY)


def _merge_summary(job: ImportJob, **updates: object) -> dict[str, object]:
    summary = dict(job.summary) if isinstance(job.summary, dict) else {}
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


def get_active_import_jobs(db: Session, *, document_id: int, import_type: str) -> list[ImportJob]:
    return list(
        db.scalars(
            select(ImportJob)
            .where(
                ImportJob.document_id == document_id,
                ImportJob.import_type == import_type,
                ImportJob.status.in_(ACTIVE_IMPORT_JOB_STATUSES),
            )
            .order_by(ImportJob.created_at.asc(), ImportJob.id.asc())
        )
    )


def choose_canonical_active_job(active_jobs: list[ImportJob]) -> ImportJob | None:
    if not active_jobs:
        return None

    processing_jobs = [job for job in active_jobs if job.status == ImportStatus.PROCESSING]
    if processing_jobs:
        return max(
            processing_jobs,
            key=lambda job: (
                job.started_at or job.updated_at or job.created_at,
                job.id,
            ),
        )

    return active_jobs[0]


def get_canonical_active_import_job(
    db: Session,
    *,
    document_id: int,
    import_type: str,
) -> ImportJob | None:
    active_jobs = get_active_import_jobs(db, document_id=document_id, import_type=import_type)
    return choose_canonical_active_job(active_jobs)


def get_document_display_import_job(document: Document | None) -> ImportJob | None:
    if document is None:
        return None

    active_job = choose_canonical_active_job(list(document.import_jobs))
    if active_job is not None:
        return active_job
    return max(document.import_jobs, key=lambda item: item.id, default=None)


def fail_superseded_active_jobs(
    db: Session,
    *,
    canonical_job: ImportJob,
    active_jobs: list[ImportJob],
    reason: str,
) -> None:
    for job in active_jobs:
        if job.id == canonical_job.id:
            continue
        if job.status not in ACTIVE_IMPORT_JOB_STATUSES:
            continue
        mark_job_failed(
            db,
            job,
            error_message=reason,
            summary={
                "superseded_by_job_id": canonical_job.id,
            },
        )


def mark_job_processing(db: Session, job: ImportJob, *, commit: bool = False) -> ImportJob:
    savepoint = db.begin_nested()
    try:
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
        db.flush()
        savepoint.commit()
    except IntegrityError:
        savepoint.rollback()
        if job.document_id is not None:
            canonical_job = get_canonical_active_import_job(
                db,
                document_id=job.document_id,
                import_type=job.import_type,
            )
            if canonical_job is not None:
                if commit:
                    db.flush()
                return canonical_job
        raise

    if commit:
        db.commit()
        db.refresh(job)
    return job


def enqueue_document_processing_job(
    db: Session,
    document: Document,
    *,
    retry_failed: bool = False,
) -> tuple[ImportJob, bool]:
    canonical_active_job = get_canonical_active_import_job(
        db,
        document_id=document.id,
        import_type=DOCUMENT_OCR_IMPORT_TYPE,
    )
    if canonical_active_job is not None:
        return canonical_active_job, False

    latest_job = get_latest_import_job(db, document_id=document.id, import_type=DOCUMENT_OCR_IMPORT_TYPE)

    if retry_failed and latest_job is not None and latest_job.status == ImportStatus.FAILED:
        savepoint = db.begin_nested()
        try:
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
            savepoint.commit()
            return latest_job, True
        except IntegrityError:
            savepoint.rollback()
            canonical_active_job = get_canonical_active_import_job(
                db,
                document_id=document.id,
                import_type=DOCUMENT_OCR_IMPORT_TYPE,
            )
            if canonical_active_job is not None:
                return canonical_active_job, False
            raise

    savepoint = db.begin_nested()
    try:
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
        savepoint.commit()
        return job, True
    except IntegrityError:
        savepoint.rollback()
        canonical_active_job = get_canonical_active_import_job(
            db,
            document_id=document.id,
            import_type=DOCUMENT_OCR_IMPORT_TYPE,
        )
        if canonical_active_job is not None:
            return canonical_active_job, False
        raise


def start_document_processing_job(
    db: Session,
    document: Document,
    *,
    retry_failed: bool = False,
    commit: bool = False,
) -> tuple[ImportJob, bool]:
    job, created = enqueue_document_processing_job(db, document, retry_failed=retry_failed)
    if job.status in QUEUEABLE_IMPORT_JOB_STATUSES:
        processing_job = mark_job_processing(db, job, commit=commit)
        return processing_job, processing_job.id == job.id
    if commit:
        db.flush()
    return job, created


def load_job_document_context(db: Session, *, document_id: int) -> Document | None:
    return db.scalar(
        select(Document)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).joinedload(Repair.service),
        )
        .where(Document.id == document_id)
    )


def get_non_operational_job_error(document: Document | None) -> str | None:
    if document is None:
        return "Document not found"

    return get_document_processing_block_reason(document)


def claim_next_document_processing_job(db: Session) -> ImportJob | None:
    processing_job = aliased(ImportJob)
    bind = db.get_bind()

    while True:
        stmt = (
            select(ImportJob)
            .where(
                ImportJob.import_type == DOCUMENT_OCR_IMPORT_TYPE,
                ImportJob.status.in_(QUEUEABLE_IMPORT_JOB_STATUSES),
                ~exists(
                    select(processing_job.id)
                    .where(
                        processing_job.document_id == ImportJob.document_id,
                        processing_job.import_type == ImportJob.import_type,
                        processing_job.status == ImportStatus.PROCESSING,
                        processing_job.id != ImportJob.id,
                    )
                ),
            )
            .order_by(ImportJob.created_at.asc(), ImportJob.id.asc())
            .limit(1)
        )

        if bind is not None and bind.dialect.name != "sqlite":
            stmt = stmt.with_for_update(skip_locked=True)

        job = db.execute(stmt).scalars().first()
        if job is None:
            return None

        if job.document_id is None:
            mark_job_failed(
                db,
                job,
                error_message="Document OCR job does not have a document_id",
                summary={"failed_during_claim": True},
            )
            db.commit()
            continue

        claim_document = load_job_document_context(db, document_id=job.document_id)
        non_operational_error = get_non_operational_job_error(claim_document)
        if non_operational_error is not None:
            mark_job_failed(
                db,
                job,
                error_message=non_operational_error,
                summary={"failed_during_claim": True},
            )
            db.commit()
            continue

        active_jobs = get_active_import_jobs(db, document_id=job.document_id, import_type=job.import_type)
        canonical_job = choose_canonical_active_job(active_jobs)
        if canonical_job is None:
            return None
        fail_superseded_active_jobs(
            db,
            canonical_job=canonical_job,
            active_jobs=active_jobs,
            reason="Superseded by canonical OCR job during worker claim",
        )
        job = canonical_job

        processing_job = mark_job_processing(db, job, commit=True)
        if processing_job.id != job.id:
            return None
        return processing_job


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
    from app.application.imports.document_processing_runner import run_document_processing_job as _run_document_processing_job

    return _run_document_processing_job(db, job)
