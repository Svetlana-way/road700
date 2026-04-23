from __future__ import annotations

from app.application.documents.document_checks import (
    build_duplicate_line_checks as build_duplicate_line_checks_default,
    build_dynamic_work_reference_checks as build_dynamic_work_reference_checks_default,
    build_expected_total_checks as build_expected_total_checks_default,
    build_labor_norm_reference_checks as build_labor_norm_reference_checks_default,
    build_repeat_repair_checks as build_repeat_repair_checks_default,
    build_standard_hours_checks as build_standard_hours_checks_default,
)
from app.application.documents.legacy_overrides import call_document_processing_override
from app.application.documents.parsing_access import normalize_plate_compare_token_for_application
from app.application.documents.support import amounts_match, build_manual_review_check, replace_ocr_checks, replace_repair_lines


normalize_plate_compare_token = normalize_plate_compare_token_for_application


def build_standard_hours_checks(works_payload):
    return call_document_processing_override(
        "build_standard_hours_checks",
        build_standard_hours_checks_default,
        works_payload,
    )


def build_repeat_repair_checks(db, repair, works_payload):
    return call_document_processing_override(
        "build_repeat_repair_checks",
        build_repeat_repair_checks_default,
        db,
        repair,
        works_payload,
    )


def build_duplicate_line_checks(works_payload, parts_payload):
    return call_document_processing_override(
        "build_duplicate_line_checks",
        build_duplicate_line_checks_default,
        works_payload,
        parts_payload,
    )


def build_expected_total_checks(db, repair, works_payload):
    return call_document_processing_override(
        "build_expected_total_checks",
        build_expected_total_checks_default,
        db,
        repair,
        works_payload,
    )


def build_dynamic_work_reference_checks(db, repair, works_payload):
    return call_document_processing_override(
        "build_dynamic_work_reference_checks",
        build_dynamic_work_reference_checks_default,
        db,
        repair,
        works_payload,
    )


def build_labor_norm_reference_checks(works_payload):
    return call_document_processing_override(
        "build_labor_norm_reference_checks",
        build_labor_norm_reference_checks_default,
        works_payload,
    )
