from __future__ import annotations

from app.application.documents import context_access, ocr_checks_access
from app.models.document import DocumentVersion
from app.models.enums import (
    CheckSeverity,
    DocumentStatus,
    ImportStatus,
    RepairStatus,
)
from app.models.imports import ImportJob


def handle_non_operational_document(db, *, document, job, block_reason: str) -> str:
    from app.application.imports.document_jobs import mark_job_failed

    context_access.logger.info(
        "document_processing_skipped_non_operational",
        extra={"document_id": document.id, "job_id": job.id, "reason": block_reason},
    )
    mark_job_failed(
        db,
        job,
        error_message=block_reason,
        summary={
            "document_id": document.id,
            "document_status": document.status.value,
            "skipped_reason": block_reason,
        },
    )
    db.commit()
    return "Document processing skipped"


def process_storage_only_document(db, *, document, job) -> str:
    from app.application.imports.document_jobs import mark_job_completed

    document.status = DocumentStatus.CONFIRMED
    document.review_queue_priority = 0
    document.ocr_confidence = None

    version_number = max([version.version_number for version in document.versions], default=0) + 1
    parsed_payload = {
        "processor": "document_storage_only_v1",
        "document_kind": document.kind.value,
        "ocr_skipped": True,
    }
    db.add(
        DocumentVersion(
            document_id=document.id,
            version_number=version_number,
            storage_key=document.storage_key,
            parsed_payload=parsed_payload,
            field_confidence_map={},
            change_summary="Stored without OCR",
        )
    )
    mark_job_completed(
        db,
        job,
        status=ImportStatus.COMPLETED,
        summary={
            "document_id": document.id,
            "document_kind": document.kind.value,
            "document_status": document.status.value,
            "ocr_skipped": True,
        },
    )
    db.commit()
    return "Document stored without OCR"


def finalize_processing_failure(db, *, document_id: int, job_id: int, exc: Exception) -> str:
    from app.application.imports.document_jobs import mark_job_failed

    context_access.logger.exception("document_processing_failed", extra={"document_id": document_id, "job_id": job_id})
    db.rollback()
    document = context_access.load_document_for_processing(db, document_id)
    job = db.get(ImportJob, job_id)
    if document is None or document.repair is None or job is None:
        raise
    document.status = DocumentStatus.OCR_ERROR
    document.review_queue_priority = 100
    document.ocr_confidence = 0
    document.repair.status = RepairStatus.OCR_ERROR
    ocr_checks_access.replace_ocr_checks(
        db,
        document.repair.id,
        [
            {
                "check_type": "ocr_processing_failed",
                "severity": CheckSeverity.ERROR,
                "title": "Ошибка автоматической обработки документа",
                "details": str(exc),
                "payload": {"error": str(exc)},
            }
        ],
    )
    mark_job_failed(
        db,
        job,
        error_message=str(exc),
        summary={"document_id": document.id, "document_status": document.status.value},
    )
    db.commit()
    return "Document processing failed"
