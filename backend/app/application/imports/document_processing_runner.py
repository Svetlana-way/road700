from __future__ import annotations

from app.application.documents import context_access
from app.application.documents.processing import process_document
from app.models.imports import ImportJob

from .document_jobs import start_document_processing_job


def start_and_run_document_processing(
    db,
    document_id: int,
    *,
    retry_failed: bool = True,
    commit: bool = True,
):
    document = context_access.load_document_for_processing(db, document_id)
    if document is None or document.repair is None:
        raise ValueError("Document not found or repair relation is incomplete")

    job, _ = start_document_processing_job(db, document, retry_failed=retry_failed, commit=commit)
    return process_document(db, document_id, job_id=job.id)


def run_document_processing_job(db, job: ImportJob):
    if job.document_id is None:
        raise ValueError("Document OCR job does not have a document_id")
    return process_document(db, job.document_id, job_id=job.id)
