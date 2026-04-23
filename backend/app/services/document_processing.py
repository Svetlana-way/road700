from __future__ import annotations

from collections import Counter
import json
import logging
import re
import shutil
import statistics
import subprocess
import tempfile
from datetime import date, datetime, timedelta
from importlib import import_module as _import_module
from pathlib import Path
from zipfile import BadZipFile

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import joinedload

_LAZY_MODULE_EXPORTS: dict[str, tuple[str, ...]] = {
    "app.application.documents.results": ("ProcessingResult",),
    "app.models.document": ("Document", "DocumentVersion"),
    "app.models.enums": ("DocumentStatus", "VehicleType"),
    "app.models.imports": ("ImportJob",),
    "app.models.ocr_rule": ("OcrRule",),
    "app.models.repair": ("Repair", "RepairCheck", "RepairPart", "RepairWork"),
    "app.models.service": ("Service",),
    "app.models.vehicle": ("Vehicle",),
    "app.services.ocr_profiles": (
        "OcrProfileSelection",
        "extract_profile_history_scope",
        "group_ocr_rules_by_field",
        "infer_builtin_profile_scope_from_text",
        "load_active_ocr_rules",
        "load_active_ocr_profile_matchers",
        "normalize_ocr_rule_code",
        "select_ocr_profile_scope",
    ),
    "app.services.ocr_runtime": (
        "PDFTOPPM_BINARY",
        "SIPS_BINARY",
        "TESSERACT_BINARY",
        "VISION_OCR_SCRIPT",
        "get_available_ocr_backend",
        "is_pdftoppm_available",
        "is_sips_available",
        "is_tesseract_ocr_available",
        "is_vision_ocr_available",
    ),
    "app.services.service_catalog": (
        "find_service_name_in_text",
        "normalize_service_key",
    ),
    "app.services.document_processing_config": (
        "ACT_LABEL_PATTERN",
        "ACT_WORKS_LABEL_PATTERN",
        "ARTICLE_TOKEN_PATTERN",
        "AXB_ARTICLE_TOKEN_PATTERN",
        "AXB_PART_NAME_KEYWORDS",
        "AXB_WORK_NAME_KEYWORDS",
        "CHASSIS_LABEL_PATTERNS",
        "DATE_PATTERNS",
        "DATE_CLOSED_LABEL_PATTERN",
        "DATE_COMPLETED_LABEL_PATTERN",
        "DATE_LABEL_PATTERN",
        "DEFAULT_OCR_PROFILE_MATCHER_DEFINITIONS",
        "DEFAULT_OCR_RULE_DEFINITIONS",
        "DOCUMENT_LABEL_PATTERN",
        "EXPECTED_TOTAL_HOURLY_SAMPLE_THRESHOLD",
        "EXPECTED_TOTAL_REPAIR_STATUSES",
        "EXPECTED_TOTAL_SERVICE_SAMPLE_THRESHOLD",
        "EXPECTED_TOTAL_THRESHOLD_MULTIPLIER",
        "FILENAME_SERVICE_PREFIXES",
        "FROM_LABEL_PATTERN",
        "GRAND_TOTAL_LABEL_PATTERN",
        "HISTORICAL_IMPORT_REASON_PREFIX",
        "ITEM_UNIT_MARKERS",
        "LINE_ITEM_PATTERN",
        "MILEAGE_LABEL_PATTERN",
        "MILEAGE_PATTERNS",
        "MILEAGE_SECTION_PATTERNS",
        "NUMBER_MARKER_PATTERN",
        "OCR_RULE_TARGET_FIELDS",
        "OCR_RULE_VALUE_PARSERS",
        "OCR_TOKEN_CHAR_REPLACEMENTS",
        "ODOMETER_LABEL_PATTERN",
        "ORDER_PATTERNS",
        "ORDER_LABEL_PATTERN",
        "PARTS_TOTAL_LABEL_PATTERN",
        "PART_LINE_WITH_ARTICLE_PATTERN",
        "PART_SECTION_MARKERS",
        "PLACEHOLDER_VEHICLE_EXTERNAL_ID",
        "PLATE_LABEL_PATTERNS",
        "PLATE_PATTERNS",
        "PROFILE_SPECIFIC_OCR_RULE_DEFINITIONS",
        "REASON_LABEL_PATTERN",
        "REASON_SECTION_PATTERNS",
        "REVERSED_ORDER_LABEL_PATTERN",
        "REPEAT_REPAIR_WINDOW_DAYS",
        "RUSSIAN_MONTHS",
        "SECTION_FOOTER_MARKERS",
        "SERVICE_CANDIDATE_PATTERNS",
        "SERVICE_LABEL_PATTERN",
        "SERVICE_NAME_BLOCKLIST",
        "SERVICE_PATTERNS",
        "SOURCE_PATH_KEY",
        "TESSERACT_LANGUAGE",
        "TESSERACT_PAGE_SEGMENTATION_MODES",
        "TEXT_CHAR_REPLACEMENTS",
        "TEXT_KEYWORD_PATTERN",
        "TOTAL_PATTERNS",
        "UNIT_ALIASES",
        "VAT_LABEL_PATTERN",
        "VEHICLE_ROW_MILEAGE_PATTERNS",
        "VEHICLE_SECTION_START_PATTERN",
        "VEHICLE_SECTION_STOP_PATTERN",
        "VIN_LABEL_PATTERNS",
        "VIN_PATTERNS",
        "WORK_TOTAL_LABEL_PATTERN",
        "WORK_CODE_TOKEN_PATTERN",
        "WORK_REFERENCE_MILEAGE_MARGIN_RATIO",
        "WORK_REFERENCE_MIN_MILEAGE_MARGIN",
        "WORK_REFERENCE_MIN_SAMPLES",
        "WORK_REFERENCE_OPERATIONAL_STATUSES",
        "WORK_REFERENCE_SERVICE_SAMPLE_THRESHOLD",
        "WORK_REFERENCE_SUSPICIOUS_LOWER_MULTIPLIER",
        "WORK_REFERENCE_SUSPICIOUS_MULTIPLIER",
        "WORK_REFERENCE_VEHICLE_SAMPLE_THRESHOLD",
        "WORK_REFERENCE_WARNING_LOWER_MULTIPLIER",
        "WORK_REFERENCE_WARNING_MULTIPLIER",
        "WORK_SECTION_MARKERS",
    ),
    "app.services.document_parser_patterns": (
        "ANTARES_AMOUNT_CONTINUATION_PATTERN",
        "ANTARES_PART_ROW_PATTERN",
        "ANTARES_PART_TAIL_PATTERN",
        "ANTARES_ROW_START_PATTERN",
        "ANTARES_WORK_ROW_PATTERN",
        "ANTARES_WORK_TAIL_PATTERN",
        "ETS_ACT_PART_ROW_PATTERN",
        "ETS_ACT_WORK_ROW_PATTERN",
        "GRUZOVYE_REZERVY_ROW_PATTERN",
        "GRUZOVYE_REZERVY_ROW_START_PATTERN",
        "GRUZOVYE_REZERVY_ROW_TAIL_PATTERN",
        "KLEVER_TRAK_PART_ROW_PATTERN",
        "KLEVER_TRAK_ROW_START_PATTERN",
        "KLEVER_TRAK_VEHICLE_ROW_PATTERN",
        "KLEVER_TRAK_WORK_ROW_PATTERN",
        "LEADER_TRAK_INVOICE_ROW_PATTERN",
        "LEADER_TRAK_ROW_PATTERN",
        "LEADER_TRAK_ROW_START_PATTERN",
        "LOGISTICS_PART_ROW_PATTERN",
        "LOGISTICS_PART_TAIL_PATTERN",
        "LOGISTICS_ROW_START_PATTERN",
        "LOGISTICS_WORK_ROW_PATTERN",
        "LOGISTICS_WORK_TAIL_PATTERN",
        "SIBTRAKSCAN_ROW_PATTERN",
        "SIBTRAKSCAN_ROW_START_PATTERN",
    ),
    "app.services.document_parser_facade": (
        "_extract_axb_material_section_entries_from_lines",
        "axb_name_merge_score",
        "choose_axb_material_line_totals",
        "clean_axb_inline_material_name",
        "clean_axb_work_name",
        "collapse_axb_name_lines",
        "extract_antares_items",
        "extract_antares_row_buffers",
        "extract_axb_batched_material_section_entries_from_lines",
        "extract_axb_compact_work_items",
        "extract_axb_compact_work_row",
        "extract_axb_expected_work_line_totals_from_summary",
        "extract_axb_inline_material_entries",
        "extract_axb_invoice_items",
        "extract_axb_invoice_totals",
        "extract_axb_material_parts",
        "extract_axb_material_section_amounts",
        "extract_axb_material_section_entries",
        "extract_axb_rate_candidate",
        "extract_axb_work_items",
        "extract_axb_work_line_totals_from_summary",
        "extract_ets_act_items",
        "extract_ets_act_section_rows",
        "extract_gruzovye_rezervy_items",
        "extract_gruzovye_rezervy_row_buffers",
        "extract_klever_trak_items",
        "extract_klever_trak_row_buffers",
        "extract_leader_trak_invoice_fragment",
        "extract_leader_trak_invoice_items",
        "extract_leader_trak_items",
        "extract_leader_trak_order_number",
        "extract_leader_trak_row_buffers",
        "extract_logistics_items",
        "extract_logistics_row_buffers",
        "extract_sibtrakscan_items",
        "extract_sibtrakscan_row_buffers",
        "has_polluted_axb_material_entry_names",
        "infer_axb_item_kind",
        "infer_axb_price",
        "infer_axb_quantity",
        "is_antares_noise_line",
        "is_axb_article_candidate",
        "is_axb_compact_work_continuation_line",
        "is_axb_compact_work_row_start",
        "is_axb_material_article_candidate",
        "is_axb_material_name_header_line",
        "is_gruzovye_rezervy_noise_line",
        "is_gruzovye_rezervy_total_line",
        "is_klever_trak_noise_line",
        "is_leader_trak_noise_line",
        "is_leader_trak_tail_line",
        "is_logistics_noise_line",
        "is_sibtrakscan_noise_line",
        "normalize_axb_explicit_unit",
        "parse_antares_part_row",
        "parse_antares_work_row",
        "parse_axb_quantity_candidate",
        "parse_axb_standard_hours_candidate",
        "parse_ets_act_part_row",
        "parse_ets_act_work_row",
        "parse_gruzovye_rezervy_row",
        "parse_klever_trak_part_row",
        "parse_klever_trak_work_row",
        "parse_leader_trak_invoice_row",
        "parse_leader_trak_row",
        "parse_logistics_part_row",
        "parse_logistics_work_row",
        "parse_sibtrakscan_row",
        "repair_antares_numeric_splits",
        "score_axb_material_entries",
        "score_axb_price_sequence",
        "select_axb_batch_prices",
        "select_axb_material_section_total",
        "split_antares_part_body",
        "split_axb_leading_item_code",
        "split_axb_leading_work_code",
        "split_gruzovye_rezervy_part_body",
        "split_klever_trak_part_body",
        "split_klever_trak_work_body",
        "split_leader_trak_body",
        "split_logistics_part_body",
    ),
    "app.services.document_text_parsing_facade": (
        "apply_profile_specific_item_fallbacks",
        "apply_profile_specific_total_fallbacks",
        "build_section_body_pattern",
        "detect_document_flags",
        "extract_amount_candidates_from_fragment",
        "extract_axb_invoice_fragment",
        "extract_ets_act_late_fragment",
        "extract_ets_act_scanned_header_fields",
        "extract_ets_act_sparse_scanned_totals",
        "extract_ets_act_sparse_scanned_work_items",
        "extract_ets_act_sparse_summary_blocks",
        "extract_ets_act_sparse_work_layout",
        "extract_ets_act_sparse_work_norms",
        "extract_fragment_after_marker",
        "extract_header_text",
        "extract_inline_section_items",
        "extract_largest_amount_around_marker",
        "extract_largest_amount_from_fragment",
        "extract_line_items",
        "extract_service_candidate_from_text",
        "extract_vehicle_identifiers_from_section",
        "extract_vehicle_section_text",
        "find_chassis_candidate",
        "find_pattern_value",
        "find_plate_candidate",
        "find_vin_candidate",
        "first_match",
        "has_explicit_missing_mileage",
        "has_logistics_blank_mileage_field",
        "has_meaningful_leader_trak_items",
        "is_amount_token",
        "is_axb_invoice_header_line",
        "is_axb_invoice_stop_line",
        "is_axb_invoice_total_marker",
        "is_ets_act_sparse_work_noise_line",
        "is_ets_act_work_code_line",
        "is_gruzovye_rezervy_invoice_only_document",
        "is_leader_trak_invoice_only_document",
        "is_logistics_trailer_vehicle_context",
        "is_meaningful_part_name",
        "is_meaningful_work_name",
        "is_quantity_token",
        "normalize_article_value",
        "normalize_compare_token",
        "normalize_ocr_code_token",
        "normalize_plate_compare_token",
        "normalize_service_candidate",
        "normalize_token_for_unit",
        "normalize_unit_name",
        "parse_document_text",
        "parse_ets_act_sparse_summary_amount",
        "parse_inline_item_sequence",
        "parse_mileage_candidate",
        "parse_part_line",
        "parse_work_line",
        "reconcile_header_totals_with_line_items",
        "sanitize_extracted_items",
        "split_work_code_and_name",
        "tokenize_inline_section",
    ),
    "app.services.document_processing_helpers": (
        "add_manual_review_reason",
        "amounts_match",
        "apply_document_metadata_fallbacks",
        "auto_create_repair_vehicle_from_document",
        "auto_link_repair_vehicle_from_registry",
        "average_confidence",
        "build_document_hint_text",
        "build_duplicate_line_checks",
        "build_dynamic_work_reference_checks",
        "build_expected_total_checks",
        "build_labor_norm_reference_checks",
        "build_manual_review_check",
        "build_repeat_repair_checks",
        "build_standard_hours_checks",
        "derive_service_name_from_source_path",
        "describe_work_reference_source",
        "enrich_vehicle_fields_from_registry",
        "enrich_vehicle_fields_from_repair",
        "enrich_work_payloads_with_labor_norms",
        "extract_document_source_path",
        "extract_header_field",
        "extract_vehicle_brand_model_from_document_text",
        "extract_vehicle_year_from_document_text",
        "find_vehicle_by_identifiers",
        "get_document_processing_block_reason",
        "get_line_items_total",
        "infer_vehicle_type_from_document_text",
        "is_plausible_order_number",
        "is_service_name_suspicious",
        "load_document_for_processing",
        "match_custom_ocr_rule",
        "maybe_apply_axb_raw_tesseract_fallback",
        "normalize_identifier_token",
        "normalize_line",
        "parse_amount",
        "parse_date_value",
        "parse_decimal_value",
        "parse_ocr_rule_value",
        "remove_manual_review_reason",
        "replace_ocr_checks",
        "replace_repair_lines",
        "resolve_service",
        "resolve_work_reference_hours",
        "score_axb_parsed_document",
        "should_retry_axb_raw_tesseract",
        "summarize_line_totals",
    ),
    "app.services.document_runtime_facade": (
        "clean_text_lines",
        "extract_not_done_items_from_text",
        "extract_reason_from_text",
        "extract_recommendations_from_text",
        "generate_text_variants",
        "is_pillow_available",
        "normalize_multiline_text",
        "normalize_text",
        "score_tesseract_ocr_variant",
        "score_text_quality",
        "select_best_tesseract_ocr_variant",
        "select_best_text_variant",
    ),
    "app.services.text_extraction_facade": (
        "decode_pdf_literal",
        "extract_axb_raw_scanned_pdf_text",
        "extract_document_text",
        "extract_image_text",
        "extract_pdf_stream_text",
        "extract_pdf_text",
        "extract_scanned_pdf_text",
        "extract_spreadsheet_text",
        "format_spreadsheet_cell_value",
        "optimize_existing_image_for_ocr",
        "preprocess_image_for_ocr",
        "render_pdf_pages_for_ocr",
        "render_pdf_pages_for_raw_pdftoppm_ocr",
        "render_single_page_pdf_for_ocr",
        "run_ocr_backend",
        "run_tesseract_ocr",
        "run_tesseract_ocr_with_modes",
        "run_vision_ocr",
        "save_pdf_header_crop_for_ocr",
        "save_pillow_optimized_image",
    ),
    "app.services.labor_norms": (
        "LaborNormApplicability",
        "LaborNormEnrichmentSummary",
        "assess_labor_norm_applicability",
        "build_normalized_name",
        "classify_known_non_catalog_operation",
        "find_best_labor_norm_match",
        "normalize_labor_norm_code",
    ),
    "app.core.paths": (
        "get_storage_root",
        "resolve_storage_path",
    ),
}

_LAZY_ATTR_TO_MODULE = {
    attr_name: module_name
    for module_name, attr_names in _LAZY_MODULE_EXPORTS.items()
    for attr_name in attr_names
}

_EAGER_EXPORTS = {
    "BadZipFile",
    "Counter",
    "LOCAL_STORAGE_ROOT",
    "Path",
    "date",
    "datetime",
    "delete",
    "ensure_ocr_runtime",
    "format_ocr_runtime_status_lines",
    "get_ocr_runtime_issues",
    "get_ocr_runtime_status",
    "get_storage_path",
    "joinedload",
    "json",
    "logger",
    "logging",
    "or_",
    "process_document",
    "re",
    "select",
    "shutil",
    "statistics",
    "subprocess",
    "tempfile",
    "timedelta",
}

__all__ = sorted(_EAGER_EXPORTS | set(_LAZY_ATTR_TO_MODULE))


LOCAL_STORAGE_ROOT: Path | None = None


logger = logging.getLogger(__name__)


def _load_lazy_export(name: str):
    module_name = _LAZY_ATTR_TO_MODULE.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module = _import_module(module_name)
    value = getattr(module, name)
    globals()[name] = value
    return value


def __getattr__(name: str):
    return _load_lazy_export(name)


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))


def get_ocr_runtime_status() -> dict[str, object]:
    from app.services.ocr_runtime import get_ocr_runtime_status as _get_ocr_runtime_status

    return _get_ocr_runtime_status()


def get_ocr_runtime_issues(*, require_pdf_scan_ocr: bool = True) -> list[str]:
    from app.services.processing_guards import get_ocr_runtime_issues as _get_ocr_runtime_issues

    return _get_ocr_runtime_issues(require_pdf_scan_ocr=require_pdf_scan_ocr)


def format_ocr_runtime_status_lines(*, require_pdf_scan_ocr: bool = True) -> list[str]:
    from app.services.processing_guards import format_ocr_runtime_status_lines as _format_ocr_runtime_status_lines

    return _format_ocr_runtime_status_lines(require_pdf_scan_ocr=require_pdf_scan_ocr)


def ensure_ocr_runtime(*, require_pdf_scan_ocr: bool = True) -> None:
    from app.services.processing_guards import ensure_ocr_runtime as _ensure_ocr_runtime

    _ensure_ocr_runtime(require_pdf_scan_ocr=require_pdf_scan_ocr)


def get_storage_path(storage_key: str) -> Path | None:
    get_storage_root = _load_lazy_export("get_storage_root")
    resolve_storage_path = _load_lazy_export("resolve_storage_path")
    storage_root = LOCAL_STORAGE_ROOT if LOCAL_STORAGE_ROOT is not None else get_storage_root()
    return resolve_storage_path(storage_key, storage_root=storage_root)


def build_manual_review_check(reason: str, *, extracted_fields: dict[str, object]):
    # Compat marker check types retained in the facade:
    # "check_type": "ocr_vehicle_not_found"
    # "check_type": "ocr_service_not_found"
    # "check_type": "ocr_service_missing"
    from app.services.processing_support import build_manual_review_check as _build_manual_review_check

    return _build_manual_review_check(reason, extracted_fields=extracted_fields)


def process_document(db, document_id: int, *, job_id: int | None = None):
    from app.services.processing_pipeline import process_document as _process_document

    return _process_document(db, document_id, job_id=job_id)
