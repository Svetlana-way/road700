from __future__ import annotations

from app.application.documents import context_access, ocr_runtime_access
from app.models.document import DocumentVersion
from app.models.enums import (
    CheckSeverity,
    DocumentStatus,
    ImportStatus,
    RepairStatus,
)


def finalize_ocr_processing_result(
    db,
    *,
    document,
    job,
    checks: list[dict],
    confidence_map: dict,
    extracted_fields: dict,
    extracted_items: dict,
    extracted_from: str | None,
    manual_review_reasons: list,
    normalization_notes: list,
    text: str,
    parsed: dict,
    profile_selection,
    labor_norm_applicability,
    labor_norm_summary,
) -> str:
    from app.application.imports.document_jobs import mark_job_completed

    recognized_fields_count = len(confidence_map)
    repair = document.repair
    repair.is_preliminary = True
    repair.is_partially_recognized = recognized_fields_count < 4
    has_blocking_checks = any(item["severity"] in {CheckSeverity.SUSPICIOUS, CheckSeverity.ERROR} for item in checks)
    if not recognized_fields_count:
        repair.status = RepairStatus.OCR_ERROR
    elif has_blocking_checks:
        repair.status = RepairStatus.SUSPICIOUS
    else:
        repair.status = RepairStatus.IN_REVIEW

    if recognized_fields_count >= 4:
        document.status = DocumentStatus.RECOGNIZED
        message = "Document processed automatically"
    elif recognized_fields_count > 0:
        document.status = DocumentStatus.PARTIALLY_RECOGNIZED
        message = "Document processed partially and sent for review"
    elif document.source_type == "pdf":
        document.status = DocumentStatus.OCR_ERROR
        message = "Document processing did not extract text"
    else:
        document.status = DocumentStatus.NEEDS_REVIEW
        message = "Image uploaded; manual review is required"

    document.ocr_confidence = ocr_runtime_access.average_confidence(confidence_map)
    document.review_queue_priority = 100 if document.status != DocumentStatus.RECOGNIZED else 20

    version_number = max([version.version_number for version in document.versions], default=0) + 1
    text_excerpt = ocr_runtime_access.normalize_text(text.replace("\n", " "))[:500] if text else None
    parsed_payload = {
        "processor": "hybrid_document_ocr_v2",
        "ocr_profile_scope": profile_selection.profile_scope,
        "ocr_profile_source": profile_selection.source,
        "ocr_profile_reason": profile_selection.reason,
        "document_kind": document.kind.value,
        "extracted_from": extracted_from,
        "text_length": len(text),
        "text_excerpt": text_excerpt,
        "extracted_fields": extracted_fields,
        "extracted_items": extracted_items,
        "manual_review_reasons": manual_review_reasons,
        "normalization_notes": normalization_notes,
        "service_not_done": parsed.get("service_not_done", []),
        "labor_norm_applicability": {
            "eligible": labor_norm_applicability.eligible,
            "scope": labor_norm_applicability.scope,
            "reason_code": labor_norm_applicability.reason_code,
            "reason": labor_norm_applicability.reason,
            "brand_family": labor_norm_applicability.brand_family,
            "catalog_name": labor_norm_applicability.catalog_name,
            "matched_count": labor_norm_summary.matched_count,
            "unmatched_count": labor_norm_summary.unmatched_count,
        },
    }
    db.add(
        DocumentVersion(
            document_id=document.id,
            version_number=version_number,
            storage_key=document.storage_key,
            parsed_payload=parsed_payload,
            field_confidence_map=confidence_map,
            change_summary=message,
        )
    )

    final_job_status = (
        ImportStatus.COMPLETED if document.status == DocumentStatus.RECOGNIZED else ImportStatus.COMPLETED_WITH_CONFLICTS
    )
    mark_job_completed(
        db,
        job,
        status=final_job_status,
        summary={
            "document_id": document.id,
            "document_status": document.status.value,
            "recognized_fields_count": recognized_fields_count,
            "works_count": len(extracted_items["works"]),
            "parts_count": len(extracted_items["parts"]),
            "manual_review_reasons": manual_review_reasons,
            "normalization_notes": normalization_notes,
            "confidence": document.ocr_confidence,
        },
    )
    context_access.logger.info(
        "document_processing_completed",
        extra={"document_id": document.id, "job_id": job.id, "document_status": document.status.value},
    )
    db.commit()
    return message
