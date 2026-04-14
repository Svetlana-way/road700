from __future__ import annotations

from pathlib import Path

from app.application.documents import context_access, ocr_checks_access, ocr_runtime_access
from app.application.documents.ocr_check_building import build_document_ocr_checks
from app.application.documents.parsed_document_application import apply_parsed_document_state
from app.application.documents.processing_result_finalization import finalize_ocr_processing_result


def process_ocr_document(db, *, document, job, storage_path: Path) -> str:
    context_access.logger.info("document_processing_extract_text", extra={"document_id": document.id, "job_id": job.id})
    text, extracted_from, extraction_failure_reason = ocr_runtime_access.extract_document_text(
        storage_path,
        document.source_type,
    )
    profile_selection = ocr_runtime_access.select_ocr_profile_scope(db, document, text) if text else ocr_runtime_access.OcrProfileSelection(
        profile_scope="default",
        source="default",
        reason="Текст не извлечён, использован default",
    )
    context_access.logger.info(
        "document_processing_parse",
        extra={"document_id": document.id, "job_id": job.id, "profile_scope": profile_selection.profile_scope},
    )
    parsed = ocr_runtime_access.parse_document_text(text, db=db, profile_scope=profile_selection.profile_scope) if text else {
        "extracted_fields": {},
        "extracted_items": {"works": [], "parts": []},
        "confidence_map": {},
        "manual_review_reasons": [extraction_failure_reason or "text_not_found"],
        "normalization_notes": [],
    }
    if text:
        text, extracted_from, parsed = ocr_runtime_access.maybe_apply_axb_raw_tesseract_fallback(
            storage_path,
            text=text,
            extracted_from=extracted_from,
            profile_scope=profile_selection.profile_scope,
            parsed=parsed,
            db=db,
        )

    extracted_fields = parsed["extracted_fields"]
    extracted_items = parsed["extracted_items"]
    confidence_map = parsed["confidence_map"]
    manual_review_reasons = parsed["manual_review_reasons"]
    normalization_notes = parsed.get("normalization_notes", [])
    labor_norm_applicability, labor_norm_summary = apply_parsed_document_state(
        db,
        document=document,
        text=text,
        extracted_fields=extracted_fields,
        extracted_items=extracted_items,
        confidence_map=confidence_map,
        manual_review_reasons=manual_review_reasons,
        normalization_notes=normalization_notes,
    )
    repair = document.repair

    context_access.logger.info("document_processing_match_and_checks", extra={"document_id": document.id, "job_id": job.id})
    ocr_checks_access.replace_repair_lines(
        db,
        repair,
        works_payload=extracted_items["works"],
        parts_payload=extracted_items["parts"],
    )
    checks = build_document_ocr_checks(
        db,
        repair=repair,
        extracted_fields=extracted_fields,
        extracted_items=extracted_items,
        manual_review_reasons=manual_review_reasons,
    )

    ocr_checks_access.replace_ocr_checks(db, repair.id, checks)
    return finalize_ocr_processing_result(
        db,
        document=document,
        job=job,
        checks=checks,
        confidence_map=confidence_map,
        extracted_fields=extracted_fields,
        extracted_items=extracted_items,
        extracted_from=extracted_from,
        manual_review_reasons=manual_review_reasons,
        normalization_notes=normalization_notes,
        text=text,
        parsed=parsed,
        profile_selection=profile_selection,
        labor_norm_applicability=labor_norm_applicability,
        labor_norm_summary=labor_norm_summary,
    )
