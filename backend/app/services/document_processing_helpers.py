from __future__ import annotations

from app.application.documents.axb_fallback import (
    get_line_items_total,
    maybe_apply_axb_raw_tesseract_fallback,
    score_axb_parsed_document,
    should_retry_axb_raw_tesseract,
)
from app.application.documents.support import (
    average_confidence,
    build_manual_review_check,
    load_document_for_processing,
    replace_ocr_checks,
    replace_repair_lines,
    resolve_service,
)
from app.services.document_checks import (
    build_duplicate_line_checks,
    build_dynamic_work_reference_checks,
    build_expected_total_checks,
    build_labor_norm_reference_checks,
    build_repeat_repair_checks,
    build_standard_hours_checks,
    describe_work_reference_source,
    resolve_work_reference_hours,
)
from app.services.document_metadata import (
    add_manual_review_reason,
    apply_document_metadata_fallbacks,
    build_document_hint_text,
    derive_service_name_from_source_path,
    enrich_vehicle_fields_from_repair,
    extract_document_source_path,
    is_service_name_suspicious,
    remove_manual_review_reason,
)
from app.services.document_text_utils import (
    is_plausible_order_number,
    normalize_identifier_token,
    normalize_line,
    parse_amount,
    parse_date_value,
    parse_decimal_value,
)
from app.services.labor_norm_enrichment import enrich_work_payloads_with_labor_norms
from app.services.ocr_field_helpers import extract_header_field, match_custom_ocr_rule, parse_ocr_rule_value
from app.services.document_parsers.parser_helpers import amounts_match, summarize_line_totals
from app.application.documents.guards import get_document_processing_block_reason
from app.application.documents.vehicle_matching import (
    auto_create_repair_vehicle_from_document,
    auto_link_repair_vehicle_from_registry,
    enrich_vehicle_fields_from_registry,
    extract_vehicle_brand_model_from_document_text,
    extract_vehicle_year_from_document_text,
    find_vehicle_by_identifiers,
    infer_vehicle_type_from_document_text,
)
