from __future__ import annotations

from importlib import import_module

_EXPORTS: dict[str, tuple[str, str]] = {
    "detect_document_flags": ("app.services.document_parsers.parser_helpers", "detect_document_flags"),
    "parse_document_text": ("app.application.documents.parsing_access", "parse_document_text_for_application"),
    "first_match": ("app.services.document_parsers.field_extractors", "first_match"),
    "normalize_service_candidate": ("app.services.document_parsers.field_extractors", "normalize_service_candidate"),
    "extract_header_text": ("app.services.document_parsers.field_extractors", "extract_header_text"),
    "extract_vehicle_section_text": ("app.services.document_parsers.field_extractors", "extract_vehicle_section_text"),
    "normalize_compare_token": ("app.services.document_parsers.field_extractors", "normalize_compare_token"),
    "normalize_plate_compare_token": ("app.services.document_parsers.field_extractors", "normalize_plate_compare_token"),
    "find_pattern_value": ("app.services.document_parsers.field_extractors", "find_pattern_value"),
    "find_plate_candidate": ("app.services.document_parsers.field_extractors", "find_plate_candidate"),
    "find_vin_candidate": ("app.services.document_parsers.field_extractors", "find_vin_candidate"),
    "find_chassis_candidate": ("app.services.document_parsers.field_extractors", "find_chassis_candidate"),
    "parse_mileage_candidate": ("app.services.document_parsers.field_extractors", "parse_mileage_candidate"),
    "has_explicit_missing_mileage": ("app.services.document_parsers.field_extractors", "has_explicit_missing_mileage"),
    "has_logistics_blank_mileage_field": ("app.services.document_parsers.field_extractors", "has_logistics_blank_mileage_field"),
    "is_logistics_trailer_vehicle_context": (
        "app.services.document_parsers.field_extractors",
        "is_logistics_trailer_vehicle_context",
    ),
    "is_gruzovye_rezervy_invoice_only_document": (
        "app.services.document_parsers.field_extractors",
        "is_gruzovye_rezervy_invoice_only_document",
    ),
    "is_leader_trak_invoice_only_document": (
        "app.services.document_parsers.field_extractors",
        "is_leader_trak_invoice_only_document",
    ),
    "extract_vehicle_identifiers_from_section": (
        "app.services.document_parsers.field_extractors",
        "extract_vehicle_identifiers_from_section",
    ),
    "extract_service_candidate_from_text": (
        "app.services.document_parsers.field_extractors",
        "extract_service_candidate_from_text",
    ),
    "extract_ets_act_late_fragment": ("app.services.document_parsers.field_extractors", "extract_ets_act_late_fragment"),
    "is_ets_act_work_code_line": ("app.services.document_parsers.ets_act_support", "is_ets_act_work_code_line"),
    "is_ets_act_sparse_work_noise_line": (
        "app.services.document_parsers.ets_act_support",
        "is_ets_act_sparse_work_noise_line",
    ),
    "parse_ets_act_sparse_summary_amount": (
        "app.services.document_parsers.ets_act_support",
        "parse_ets_act_sparse_summary_amount",
    ),
    "extract_ets_act_sparse_summary_blocks": (
        "app.services.document_parsers.ets_act_support",
        "extract_ets_act_sparse_summary_blocks",
    ),
    "extract_ets_act_sparse_work_layout": (
        "app.services.document_parsers.ets_act_support",
        "extract_ets_act_sparse_work_layout",
    ),
    "extract_ets_act_sparse_work_norms": (
        "app.services.document_parsers.ets_act_support",
        "extract_ets_act_sparse_work_norms",
    ),
    "extract_ets_act_sparse_scanned_work_items": (
        "app.services.document_parsers.ets_act_support",
        "extract_ets_act_sparse_scanned_work_items",
    ),
    "extract_ets_act_sparse_scanned_totals": (
        "app.services.document_parsers.ets_act_support",
        "extract_ets_act_sparse_scanned_totals",
    ),
    "extract_ets_act_scanned_header_fields": (
        "app.services.document_parsers.parser_helpers",
        "extract_ets_act_scanned_header_fields",
    ),
    "build_section_body_pattern": ("app.services.document_parsers.parser_helpers", "build_section_body_pattern"),
    "tokenize_inline_section": ("app.services.document_parsers.parser_helpers", "tokenize_inline_section"),
    "normalize_token_for_unit": ("app.services.document_parsers.parser_helpers", "normalize_token_for_unit"),
    "normalize_ocr_code_token": ("app.services.document_parsers.parser_helpers", "normalize_ocr_code_token"),
    "normalize_unit_name": ("app.services.document_parsers.parser_helpers", "normalize_unit_name"),
    "normalize_article_value": ("app.services.document_parsers.parser_helpers", "normalize_article_value"),
    "split_work_code_and_name": ("app.services.document_parsers.parser_helpers", "split_work_code_and_name"),
    "is_meaningful_work_name": ("app.services.document_parsers.parser_helpers", "is_meaningful_work_name"),
    "is_meaningful_part_name": ("app.services.document_parsers.parser_helpers", "is_meaningful_part_name"),
    "has_meaningful_leader_trak_items": (
        "app.services.document_parsers.parser_helpers",
        "has_meaningful_leader_trak_items",
    ),
    "sanitize_extracted_items": ("app.services.document_parsers.parser_helpers", "sanitize_extracted_items"),
    "is_quantity_token": ("app.services.document_parsers.parser_helpers", "is_quantity_token"),
    "is_amount_token": ("app.services.document_parsers.parser_helpers", "is_amount_token"),
    "parse_inline_item_sequence": ("app.services.document_parsers.parser_helpers", "parse_inline_item_sequence"),
    "extract_inline_section_items": ("app.services.document_parsers.parser_helpers", "extract_inline_section_items"),
    "extract_line_items": ("app.services.document_parsers.parser_helpers", "extract_line_items"),
    "parse_work_line": ("app.services.document_parsers.parser_helpers", "parse_work_line"),
    "parse_part_line": ("app.services.document_parsers.parser_helpers", "parse_part_line"),
    "reconcile_header_totals_with_line_items": (
        "app.services.document_parsers.parser_helpers",
        "reconcile_header_totals_with_line_items",
    ),
    "extract_fragment_after_marker": ("app.services.document_parsers.text_fragments", "extract_fragment_after_marker"),
    "extract_largest_amount_around_marker": (
        "app.services.document_parsers.text_fragments",
        "extract_largest_amount_around_marker",
    ),
    "extract_largest_amount_from_fragment": (
        "app.services.document_parsers.text_fragments",
        "extract_largest_amount_from_fragment",
    ),
    "extract_amount_candidates_from_fragment": (
        "app.services.document_parsers.text_fragments",
        "extract_amount_candidates_from_fragment",
    ),
    "is_axb_invoice_header_line": ("app.services.document_parsers.axb_helpers", "is_axb_invoice_header_line"),
    "is_axb_invoice_stop_line": ("app.services.document_parsers.axb_helpers", "is_axb_invoice_stop_line"),
    "is_axb_invoice_total_marker": ("app.services.document_parsers.axb_helpers", "is_axb_invoice_total_marker"),
    "extract_axb_invoice_fragment": ("app.services.document_parsers.axb_helpers", "extract_axb_invoice_fragment"),
    "apply_profile_specific_item_fallbacks": (
        "app.services.document_parsers.profile_fallbacks",
        "apply_profile_specific_item_fallbacks",
    ),
    "apply_profile_specific_total_fallbacks": (
        "app.services.document_parsers.profile_fallbacks",
        "apply_profile_specific_total_fallbacks",
    ),
}

__all__ = sorted(_EXPORTS)


def __getattr__(name: str) -> object:
    try:
        module_name, attr_name = _EXPORTS[name]
    except KeyError as exc:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}") from exc
    value = getattr(import_module(module_name), attr_name)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))
