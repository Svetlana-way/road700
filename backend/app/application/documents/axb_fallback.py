from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.application.documents.legacy_overrides import extract_axb_raw_scanned_pdf_text, parse_document_text
from app.application.documents.ocr_profiles import normalize_ocr_rule_code
from app.application.documents.support import amounts_match


logger = logging.getLogger("app.services.document_processing")


def get_line_items_total(items: list[dict[str, object]]) -> float:
    return round(sum(float(item.get("line_total", 0) or 0) for item in items), 2)


def should_retry_axb_raw_tesseract(parsed: dict[str, object]) -> bool:
    extracted_fields = parsed.get("extracted_fields", {})
    extracted_items = parsed.get("extracted_items", {})
    works = extracted_items.get("works", []) if isinstance(extracted_items, dict) else []
    parts = extracted_items.get("parts", []) if isinstance(extracted_items, dict) else []

    if not works and not parts:
        return True

    work_total = extracted_fields.get("work_total") if isinstance(extracted_fields, dict) else None
    parts_total = extracted_fields.get("parts_total") if isinstance(extracted_fields, dict) else None
    works_sum = get_line_items_total(works)
    parts_sum = get_line_items_total(parts)

    if work_total not in {None, ""} and works and not amounts_match(works_sum, float(work_total), tolerance=0.2):
        return True
    if parts_total not in {None, ""} and parts and not amounts_match(parts_sum, float(parts_total), tolerance=0.2):
        return True
    if parts_total not in {None, ""} and float(parts_total) > 0 and len(parts) <= 1:
        return True
    if work_total not in {None, ""} and float(work_total) > 0 and not works:
        return True
    return False


def score_axb_parsed_document(parsed: dict[str, object]) -> int:
    extracted_fields = parsed.get("extracted_fields", {})
    extracted_items = parsed.get("extracted_items", {})
    confidence_map = parsed.get("confidence_map", {})
    manual_review_reasons = parsed.get("manual_review_reasons", [])
    works = extracted_items.get("works", []) if isinstance(extracted_items, dict) else []
    parts = extracted_items.get("parts", []) if isinstance(extracted_items, dict) else []
    work_total = extracted_fields.get("work_total") if isinstance(extracted_fields, dict) else None
    parts_total = extracted_fields.get("parts_total") if isinstance(extracted_fields, dict) else None
    works_sum = get_line_items_total(works)
    parts_sum = get_line_items_total(parts)

    score = len(works) * 18 + len(parts) * 30 + len(confidence_map) * 5
    if works:
        score += 100
    if parts:
        score += 120

    if work_total not in {None, ""} and works:
        score += 260 if amounts_match(works_sum, float(work_total), tolerance=0.2) else -180
    if parts_total not in {None, ""} and parts:
        score += 280 if amounts_match(parts_sum, float(parts_total), tolerance=0.2) else -220

    if parts_total not in {None, ""} and float(parts_total) > 0 and len(parts) <= 1:
        score -= 260
    if work_total not in {None, ""} and float(work_total) > 0 and not works:
        score -= 240

    score -= len(manual_review_reasons) * 12
    return score


def maybe_apply_axb_raw_tesseract_fallback(
    path: Path,
    *,
    text: str,
    extracted_from: str,
    profile_scope: str | None,
    parsed: dict[str, object],
    db: Session | None = None,
) -> tuple[str, str, dict[str, object]]:
    if normalize_ocr_rule_code(profile_scope) != "axb":
        return text, extracted_from, parsed
    if extracted_from != "pdf_tesseract_ocr":
        return text, extracted_from, parsed
    if not should_retry_axb_raw_tesseract(parsed):
        return text, extracted_from, parsed

    try:
        fallback_text = extract_axb_raw_scanned_pdf_text(path)
    except RuntimeError:
        logger.info("axb_raw_tesseract_fallback_unavailable", extra={"source_path": path.as_posix()})
        return text, extracted_from, parsed

    if not fallback_text:
        return text, extracted_from, parsed

    fallback_parsed = parse_document_text(
        fallback_text,
        db=db,
        profile_scope=profile_scope,
    )
    if score_axb_parsed_document(fallback_parsed) <= score_axb_parsed_document(parsed):
        return text, extracted_from, parsed

    fallback_notes = list(fallback_parsed.get("normalization_notes", []))
    fallback_notes.append("Для AXB применён резервный OCR-проход без постобработки изображений.")
    fallback_parsed["normalization_notes"] = fallback_notes
    logger.info("axb_raw_tesseract_fallback_applied", extra={"source_path": path.as_posix()})
    return fallback_text, "pdf_tesseract_ocr_axb_raw_fallback", fallback_parsed
