from __future__ import annotations

from app.application.documents import context_access
from app.application.documents.results import ProcessingResult
from app.application.documents.processing_lifecycle import (
    finalize_processing_failure,
    handle_non_operational_document,
    process_storage_only_document,
)
from app.models.enums import DocumentKind
from app.models.imports import ImportJob
from app.application.documents.processing_steps import process_ocr_document


def process_document(db, document_id: int, *, job_id: int | None = None) -> ProcessingResult:
    initial_document = context_access.load_document_for_processing(db, document_id)
    if initial_document is None or initial_document.repair is None:
        raise ValueError("Document not found or repair relation is incomplete")

    storage_path = context_access.get_storage_path(initial_document.storage_key)
    if storage_path is None:
        raise ValueError("Invalid document storage path")
    if job_id is None:
        raise ValueError("job_id is required for application.documents.processing.process_document")

    job = db.get(ImportJob, job_id)
    if job is None:
        raise ValueError(f"Import job {job_id} not found")

    try:
        document = context_access.load_document_for_processing(db, document_id)
        job = db.get(ImportJob, job_id)
        if document is None or document.repair is None or job is None:
            raise ValueError("Document processing context could not be reloaded")

        context_access.logger.info("document_processing_started", extra={"document_id": document.id, "job_id": job.id})

        block_reason = context_access.get_document_processing_block_reason(document)
        if block_reason is not None:
            message = handle_non_operational_document(db, document=document, job=job, block_reason=block_reason)
        else:
            if not storage_path.exists():
                raise FileNotFoundError(f"Source document file not found: {storage_path}")

            if document.kind in {DocumentKind.ATTACHMENT, DocumentKind.CONFIRMATION}:
                message = process_storage_only_document(db, document=document, job=job)
            else:
                message = process_ocr_document(db, document=document, job=job, storage_path=storage_path)
    except Exception as exc:
        message = finalize_processing_failure(db, document_id=document_id, job_id=job_id, exc=exc)

    refreshed_document = context_access.load_document_for_processing(db, document_id)
    refreshed_job = db.get(ImportJob, job_id)
    if refreshed_document is None or refreshed_job is None:
        raise ValueError("Processed document could not be reloaded")
    return context_access.create_processing_result(document=refreshed_document, job=refreshed_job, message=message)
