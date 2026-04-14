from __future__ import annotations

from app.models.imports import ImportJob
from app.schemas.imports import ImportJobRead


def coerce_json_object(value: object) -> dict:
    return dict(value) if isinstance(value, dict) else {}


def serialize_import_job(job: ImportJob) -> ImportJobRead:
    return ImportJobRead(
        id=job.id,
        document_id=job.document_id,
        import_type=job.import_type,
        source_filename=job.source_filename,
        status=job.status,
        summary=coerce_json_object(job.summary) if job.summary is not None else None,
        error_message=job.error_message,
        attempts=job.attempts,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )

