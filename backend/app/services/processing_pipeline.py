from __future__ import annotations

from app.application.documents.results import ProcessingResult


def process_document(db, document_id: int, *, job_id: int | None = None) -> ProcessingResult:
    if job_id is None:
        from app.application.imports.document_processing_runner import (
            start_and_run_document_processing as _start_and_run_document_processing,
        )

        return _start_and_run_document_processing(db, document_id)

    from app.application.documents.processing import process_document as _process_document

    return _process_document(db, document_id, job_id=job_id)
