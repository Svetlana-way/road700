from __future__ import annotations

from importlib import import_module

_EXPORTS: dict[str, tuple[str, str]] = {
    "parse_axb_quantity_candidate": ("app.services.document_parsers.axb_helpers", "parse_axb_quantity_candidate"),
    "collapse_axb_name_lines": ("app.services.document_parsers.axb_helpers", "collapse_axb_name_lines"),
    "normalize_axb_explicit_unit": ("app.services.document_parsers.axb_invoice_items", "normalize_axb_explicit_unit"),
    "extract_ets_act_section_rows": ("app.services.document_parsers.ets_act_support", "extract_ets_act_section_rows"),
    "parse_ets_act_work_row": ("app.services.document_parsers.ets_act_support", "parse_ets_act_work_row"),
    "parse_ets_act_part_row": ("app.services.document_parsers.ets_act_support", "parse_ets_act_part_row"),
    "extract_ets_act_items": ("app.services.document_parsers.ets_act_support", "extract_ets_act_items"),
    "is_sibtrakscan_noise_line": ("app.services.document_parsers.sibtrakscan", "is_sibtrakscan_noise_line"),
    "extract_sibtrakscan_row_buffers": ("app.services.document_parsers.sibtrakscan", "extract_sibtrakscan_row_buffers"),
    "parse_sibtrakscan_row": ("app.services.document_parsers.sibtrakscan", "parse_sibtrakscan_row"),
    "extract_sibtrakscan_items": ("app.services.document_parsers.sibtrakscan", "extract_sibtrakscan_items"),
    "is_leader_trak_noise_line": ("app.services.document_parsers.leader_trak", "is_leader_trak_noise_line"),
    "is_leader_trak_tail_line": ("app.services.document_parsers.leader_trak", "is_leader_trak_tail_line"),
    "split_leader_trak_body": ("app.services.document_parsers.leader_trak", "split_leader_trak_body"),
    "extract_leader_trak_row_buffers": ("app.services.document_parsers.leader_trak", "extract_leader_trak_row_buffers"),
    "extract_leader_trak_invoice_fragment": (
        "app.services.document_parsers.leader_trak",
        "extract_leader_trak_invoice_fragment",
    ),
    "extract_leader_trak_order_number": (
        "app.services.document_parsers.parser_helpers",
        "extract_leader_trak_order_number",
    ),
    "parse_leader_trak_row": ("app.services.document_parsers.leader_trak", "parse_leader_trak_row"),
    "parse_leader_trak_invoice_row": ("app.services.document_parsers.leader_trak", "parse_leader_trak_invoice_row"),
    "extract_leader_trak_invoice_items": (
        "app.services.document_parsers.leader_trak",
        "extract_leader_trak_invoice_items",
    ),
    "extract_leader_trak_items": ("app.services.document_parsers.leader_trak", "extract_leader_trak_items"),
    "is_logistics_noise_line": ("app.services.document_parsers.logistics", "is_logistics_noise_line"),
    "split_logistics_part_body": ("app.services.document_parsers.logistics", "split_logistics_part_body"),
    "extract_logistics_row_buffers": ("app.services.document_parsers.logistics", "extract_logistics_row_buffers"),
    "parse_logistics_work_row": ("app.services.document_parsers.logistics", "parse_logistics_work_row"),
    "parse_logistics_part_row": ("app.services.document_parsers.logistics", "parse_logistics_part_row"),
    "extract_logistics_items": ("app.services.document_parsers.logistics", "extract_logistics_items"),
    "is_klever_trak_noise_line": ("app.services.document_parsers.klever_trak", "is_klever_trak_noise_line"),
    "split_klever_trak_work_body": ("app.services.document_parsers.klever_trak", "split_klever_trak_work_body"),
    "split_klever_trak_part_body": ("app.services.document_parsers.klever_trak", "split_klever_trak_part_body"),
    "extract_klever_trak_row_buffers": ("app.services.document_parsers.klever_trak", "extract_klever_trak_row_buffers"),
    "parse_klever_trak_work_row": ("app.services.document_parsers.klever_trak", "parse_klever_trak_work_row"),
    "parse_klever_trak_part_row": ("app.services.document_parsers.klever_trak", "parse_klever_trak_part_row"),
    "extract_klever_trak_items": ("app.services.document_parsers.klever_trak", "extract_klever_trak_items"),
    "is_antares_noise_line": ("app.services.document_parsers.antares", "is_antares_noise_line"),
    "repair_antares_numeric_splits": ("app.services.document_parsers.antares", "repair_antares_numeric_splits"),
    "extract_antares_row_buffers": ("app.services.document_parsers.antares", "extract_antares_row_buffers"),
    "split_antares_part_body": ("app.services.document_parsers.antares", "split_antares_part_body"),
    "parse_antares_work_row": ("app.services.document_parsers.antares", "parse_antares_work_row"),
    "parse_antares_part_row": ("app.services.document_parsers.antares", "parse_antares_part_row"),
    "extract_antares_items": ("app.services.document_parsers.antares", "extract_antares_items"),
    "is_gruzovye_rezervy_noise_line": (
        "app.services.document_parsers.gruzovye_rezervy",
        "is_gruzovye_rezervy_noise_line",
    ),
    "is_gruzovye_rezervy_total_line": (
        "app.services.document_parsers.gruzovye_rezervy",
        "is_gruzovye_rezervy_total_line",
    ),
    "extract_gruzovye_rezervy_row_buffers": (
        "app.services.document_parsers.gruzovye_rezervy",
        "extract_gruzovye_rezervy_row_buffers",
    ),
    "split_gruzovye_rezervy_part_body": (
        "app.services.document_parsers.gruzovye_rezervy",
        "split_gruzovye_rezervy_part_body",
    ),
    "parse_gruzovye_rezervy_row": ("app.services.document_parsers.gruzovye_rezervy", "parse_gruzovye_rezervy_row"),
    "extract_gruzovye_rezervy_items": (
        "app.services.document_parsers.gruzovye_rezervy",
        "extract_gruzovye_rezervy_items",
    ),
    "is_axb_article_candidate": ("app.services.document_parsers.axb_materials", "is_axb_article_candidate"),
    "is_axb_material_article_candidate": (
        "app.services.document_parsers.axb_materials",
        "is_axb_material_article_candidate",
    ),
    "extract_axb_invoice_totals": ("app.services.document_parsers.axb_invoice_items", "extract_axb_invoice_totals"),
    "axb_name_merge_score": ("app.services.document_parsers.axb_work_items", "axb_name_merge_score"),
    "infer_axb_item_kind": ("app.services.document_parsers.axb_invoice_items", "infer_axb_item_kind"),
    "infer_axb_price": ("app.services.document_parsers.axb_work_items", "infer_axb_price"),
    "infer_axb_quantity": ("app.services.document_parsers.axb_work_items", "infer_axb_quantity"),
    "score_axb_price_sequence": ("app.services.document_parsers.axb_invoice_items", "score_axb_price_sequence"),
    "select_axb_batch_prices": ("app.services.document_parsers.axb_invoice_items", "select_axb_batch_prices"),
    "split_axb_leading_item_code": ("app.services.document_parsers.axb_materials", "split_axb_leading_item_code"),
    "split_axb_leading_work_code": ("app.services.document_parsers.axb_work_items", "split_axb_leading_work_code"),
    "is_axb_material_name_header_line": (
        "app.services.document_parsers.axb_materials",
        "is_axb_material_name_header_line",
    ),
    "is_axb_compact_work_row_start": (
        "app.services.document_parsers.axb_work_items",
        "is_axb_compact_work_row_start",
    ),
    "is_axb_compact_work_continuation_line": (
        "app.services.document_parsers.axb_work_items",
        "is_axb_compact_work_continuation_line",
    ),
    "extract_axb_compact_work_row": ("app.services.document_parsers.axb_work_items", "extract_axb_compact_work_row"),
    "extract_axb_compact_work_items": (
        "app.services.document_parsers.parser_helpers",
        "extract_axb_compact_work_items",
    ),
    "extract_axb_work_line_totals_from_summary": (
        "app.services.document_parsers.axb_work_items",
        "extract_axb_work_line_totals_from_summary",
    ),
    "extract_axb_expected_work_line_totals_from_summary": (
        "app.services.document_parsers.axb_work_items",
        "extract_axb_expected_work_line_totals_from_summary",
    ),
    "clean_axb_work_name": ("app.services.document_parsers.axb_work_items", "clean_axb_work_name"),
    "score_axb_material_entries": ("app.services.document_parsers.axb_materials", "score_axb_material_entries"),
    "has_polluted_axb_material_entry_names": (
        "app.services.document_parsers.axb_materials",
        "has_polluted_axb_material_entry_names",
    ),
    "clean_axb_inline_material_name": (
        "app.services.document_parsers.axb_materials",
        "clean_axb_inline_material_name",
    ),
    "extract_axb_inline_material_entries": (
        "app.services.document_parsers.axb_materials",
        "extract_axb_inline_material_entries",
    ),
    "extract_axb_work_items": ("app.services.document_parsers.axb_work_items", "extract_axb_work_items"),
    "_extract_axb_material_section_entries_from_lines": (
        "app.services.document_parsers.axb_materials",
        "_extract_axb_material_section_entries_from_lines",
    ),
    "extract_axb_batched_material_section_entries_from_lines": (
        "app.services.document_parsers.axb_materials",
        "extract_axb_batched_material_section_entries_from_lines",
    ),
    "extract_axb_material_section_entries": (
        "app.services.document_parsers.axb_materials",
        "extract_axb_material_section_entries",
    ),
    "extract_axb_material_section_amounts": (
        "app.services.document_parsers.axb_materials",
        "extract_axb_material_section_amounts",
    ),
    "choose_axb_material_line_totals": ("app.services.document_parsers.axb_materials", "choose_axb_material_line_totals"),
    "select_axb_material_section_total": (
        "app.services.document_parsers.axb_materials",
        "select_axb_material_section_total",
    ),
    "parse_axb_standard_hours_candidate": (
        "app.services.document_parsers.axb_work_items",
        "parse_axb_standard_hours_candidate",
    ),
    "extract_axb_rate_candidate": ("app.services.document_parsers.axb_work_items", "extract_axb_rate_candidate"),
    "extract_axb_material_parts": ("app.services.document_parsers.axb_materials", "extract_axb_material_parts"),
    "extract_axb_invoice_items": ("app.services.document_parsers.axb_invoice_items", "extract_axb_invoice_items"),
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
