from __future__ import annotations

from app.application.documents.field_extractors import is_leader_trak_invoice_only_document
from app.application.documents.ocr_profiles import normalize_ocr_rule_code
from app.application.documents.parser_helpers import amounts_match, sanitize_extracted_items, summarize_line_totals
from app.application.documents.parser_profile_access import (
    extract_antares_items,
    extract_axb_invoice_items,
    extract_axb_material_parts,
    extract_axb_work_items,
    extract_ets_act_items,
    extract_gruzovye_rezervy_items,
    extract_klever_trak_items,
    extract_leader_trak_items,
    extract_logistics_items,
    extract_sibtrakscan_items,
)
from app.application.documents.text_fragments import (
    extract_amount_candidates_from_fragment,
    extract_fragment_after_marker,
    extract_largest_amount_around_marker,
    extract_largest_amount_from_fragment,
)
from app.application.documents.document_parsers.ets_act_support import extract_ets_act_sparse_scanned_totals


def apply_profile_specific_item_fallbacks(
    text: str,
    *,
    profile_scope: str | None,
    extracted_items: dict[str, list[dict[str, object]]],
    extracted_fields: dict[str, object],
    normalization_notes: list[str],
) -> dict[str, list[dict[str, object]]]:
    normalized_profile_scope = normalize_ocr_rule_code(profile_scope)
    if normalized_profile_scope not in {"axb", "antares", "ets_act", "sibtrakscan", "leader_trak", "gruzovye_rezervy", "logistics", "klever_trak"}:
        return extracted_items

    header_work_total = float(extracted_fields["work_total"]) if isinstance(extracted_fields.get("work_total"), (int, float)) else None
    header_parts_total = float(extracted_fields["parts_total"]) if isinstance(extracted_fields.get("parts_total"), (int, float)) else None
    header_grand_total = float(extracted_fields["grand_total"]) if isinstance(extracted_fields.get("grand_total"), (int, float)) else None

    if normalized_profile_scope == "antares":
        fallback_items = extract_antares_items(text)
    elif normalized_profile_scope == "ets_act":
        fallback_items = extract_ets_act_items(text)
    elif normalized_profile_scope == "logistics":
        fallback_items = extract_logistics_items(text)
    elif normalized_profile_scope == "klever_trak":
        fallback_items = extract_klever_trak_items(text)
    elif normalized_profile_scope == "sibtrakscan":
        fallback_items = extract_sibtrakscan_items(text)
    elif normalized_profile_scope == "leader_trak":
        fallback_items = extract_leader_trak_items(text)
    elif normalized_profile_scope == "gruzovye_rezervy":
        fallback_items = extract_gruzovye_rezervy_items(text)
    else:
        fallback_items = extract_axb_invoice_items(text)
        profile_work_items = extract_axb_work_items(text)
        tuned_profile_work_items = (
            extract_axb_work_items(text, expected_work_total=header_work_total)
            if header_work_total is not None
            else []
        )
        material_parts = extract_axb_material_parts(text, expected_parts_total=header_parts_total)
        raw_profile_work_total = round(sum(float(item.get("line_total") or 0) for item in profile_work_items), 2) if profile_work_items else None
        tuned_profile_work_total = (
            round(sum(float(item.get("line_total") or 0) for item in tuned_profile_work_items), 2)
            if tuned_profile_work_items
            else None
        )
        if tuned_profile_work_items and (
            not profile_work_items
            or (
                header_work_total is not None
                and amounts_match(tuned_profile_work_total, header_work_total, tolerance=3.0)
                and not amounts_match(raw_profile_work_total, header_work_total, tolerance=3.0)
            )
        ):
            profile_work_items = tuned_profile_work_items
        fallback_work_total, _ = summarize_line_totals(fallback_items)
        profile_work_total = round(sum(float(item.get("line_total") or 0) for item in profile_work_items), 2) if profile_work_items else None
        if profile_work_items and (
            len(profile_work_items) >= len(fallback_items["works"])
            or (
                header_work_total is not None
                and amounts_match(profile_work_total, header_work_total, tolerance=3.0)
                and not amounts_match(fallback_work_total, header_work_total, tolerance=3.0)
            )
        ):
            fallback_items["works"] = profile_work_items
        if material_parts and len(material_parts) >= len(fallback_items["parts"]):
            fallback_items["parts"] = material_parts

    fallback_items, fallback_removed_count = sanitize_extracted_items(fallback_items)
    if fallback_removed_count:
        normalization_notes.append(f"noise_work_items_removed_from_profile_fallback:{fallback_removed_count}")

    current_count = len(extracted_items.get("works") or []) + len(extracted_items.get("parts") or [])
    fallback_fills_missing_section = (
        bool(fallback_items["works"]) and not bool(extracted_items.get("works"))
    ) or (
        bool(fallback_items["parts"]) and not bool(extracted_items.get("parts"))
    )
    fallback_drops_existing_section = (
        bool(extracted_items.get("works")) and not bool(fallback_items["works"])
    ) or (
        bool(extracted_items.get("parts")) and not bool(fallback_items["parts"])
    )
    candidate_items = fallback_items
    if normalized_profile_scope == "ets_act" and fallback_fills_missing_section and fallback_drops_existing_section:
        candidate_items = {
            "works": list(fallback_items["works"] or extracted_items.get("works") or []),
            "parts": list(fallback_items["parts"] or extracted_items.get("parts") or []),
        }

    fallback_count = len(candidate_items["works"]) + len(candidate_items["parts"])
    if fallback_count == 0:
        return extracted_items

    fallback_work_total, fallback_parts_total = summarize_line_totals(candidate_items)
    fallback_grand_total = None
    if fallback_work_total is not None and fallback_parts_total is not None:
        fallback_grand_total = round(fallback_work_total + fallback_parts_total, 2)

    current_work_total, current_parts_total = summarize_line_totals(extracted_items)
    current_grand_total = None
    if current_work_total is not None and current_parts_total is not None:
        current_grand_total = round(current_work_total + current_parts_total, 2)

    fallback_matches_header = header_grand_total is not None and amounts_match(
        fallback_grand_total,
        header_grand_total,
        tolerance=3.0,
    )
    current_matches_header = header_grand_total is not None and amounts_match(
        current_grand_total,
        header_grand_total,
        tolerance=3.0,
    )
    fallback_match_score = int(amounts_match(fallback_work_total, header_work_total, tolerance=3.0)) + int(
        amounts_match(fallback_parts_total, header_parts_total, tolerance=3.0)
    )
    current_match_score = int(amounts_match(current_work_total, header_work_total, tolerance=3.0)) + int(
        amounts_match(current_parts_total, header_parts_total, tolerance=3.0)
    )

    if (
        (fallback_fills_missing_section and not fallback_drops_existing_section)
        or fallback_count > current_count
        or fallback_match_score > current_match_score
        or (fallback_matches_header and not current_matches_header)
    ):
        if normalized_profile_scope == "antares":
            normalization_notes.append("antares_items_restored_from_tabular_sections")
        elif normalized_profile_scope == "ets_act":
            normalization_notes.append("ets_act_items_restored_from_tabular_sections")
        elif normalized_profile_scope == "sibtrakscan":
            normalization_notes.append("sibtrakscan_items_restored_from_task_sections")
        elif normalized_profile_scope == "leader_trak":
            if is_leader_trak_invoice_only_document(text):
                normalization_notes.append("leader_trak_items_restored_from_invoice_table")
            else:
                normalization_notes.append("leader_trak_items_restored_from_service_table")
        elif normalized_profile_scope == "logistics":
            normalization_notes.append("logistics_items_restored_from_tabular_sections")
        elif normalized_profile_scope == "klever_trak":
            normalization_notes.append("klever_trak_items_restored_from_spreadsheet_rows")
        elif normalized_profile_scope == "gruzovye_rezervy":
            normalization_notes.append("gruzovye_rezervy_items_restored_from_sections")
        else:
            normalization_notes.append("axb_invoice_items_restored_from_payment_invoice")
        return candidate_items

    if normalized_profile_scope == "axb" and fallback_items["parts"] and not extracted_items.get("parts"):
        normalization_notes.append("axb_parts_restored_from_material_sections")
        return {
            "works": extracted_items.get("works", []),
            "parts": fallback_items["parts"],
        }

    return extracted_items


def apply_profile_specific_total_fallbacks(
    text: str,
    *,
    profile_scope: str | None,
    extracted_fields: dict[str, object],
    confidence_map: dict[str, float],
    normalization_notes: list[str],
) -> None:
    normalized_profile_scope = normalize_ocr_rule_code(profile_scope)
    if normalized_profile_scope == "klever_trak":
        work_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+работ:",
                stop_patterns=(r"Расходная\s+накладная", r"Итого\s+материал", r"Итого\s+по\s+заказ[- ]наряду"),
                max_chars=180,
            )
        )
        if len(work_amounts) >= 2:
            extracted_fields["work_total"] = work_amounts[0]
            confidence_map["work_total"] = max(confidence_map.get("work_total", 0.0), 0.92)
            normalization_notes.append("work_total_restored_from_klever_trak_summary")

        parts_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+материал(?:ов|ы):",
                stop_patterns=(r"Итого\s+по\s+заказ[- ]наряду", r"Всего\s+по\s+заказ[- ]наряду"),
                max_chars=180,
            )
        )
        if len(parts_amounts) >= 2:
            extracted_fields["parts_total"] = parts_amounts[0]
            confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.92)
            normalization_notes.append("parts_total_restored_from_klever_trak_summary")

        overall_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+по\s+заказ[- ]наряду",
                stop_patterns=(r"Всего\s+по\s+заказ[- ]наряду", r"Мастер-приемщик", r"Рекомендации"),
                max_chars=180,
            )
        )
        if len(overall_amounts) >= 2:
            extracted_fields["grand_total"] = overall_amounts[0]
            extracted_fields["vat_total"] = overall_amounts[1]
            confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.94)
            confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.9)
            normalization_notes.append("grand_total_restored_from_klever_trak_summary")
        return

    if normalized_profile_scope == "antares":
        work_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+работ:",
                stop_patterns=(r"Расходная\s+накладная", r"Принят:", r"Вид\s+ремонта", r"Итого\s+по\s+причине\s+обращения"),
                max_chars=160,
            )
        )
        if work_amounts:
            extracted_fields["work_total"] = work_amounts[0]
            confidence_map["work_total"] = max(confidence_map.get("work_total", 0.0), 0.9)
            normalization_notes.append("work_total_restored_from_antares_summary")

        parts_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+материал(?:ов|ы):",
                stop_patterns=(r"Итого\s+по\s+причине\s+обращения", r"Итого\s+по\s+заказ[- ]наряду", r"Руб"),
                max_chars=220,
            )
        )
        if len(parts_amounts) >= 2:
            extracted_fields["parts_total"] = parts_amounts[-2]
            confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.9)
            normalization_notes.append("parts_total_restored_from_antares_summary")

        overall_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+по\s+причине\s+обращения",
                stop_patterns=(r"Всего\s+по\s+причине\s+обращения", r"Итого\s+по\s+заказ[- ]наряду", r"Гарантии", r"Мастер"),
                max_chars=180,
            )
        )
        if len(overall_amounts) < 2:
            overall_amounts = extract_amount_candidates_from_fragment(
                extract_fragment_after_marker(
                    text,
                    r"Итого\s+по\s+заказ[- ]наряду",
                    stop_patterns=(r"Всего\s+по\s+заказ[- ]наряду", r"Гарантии", r"Мастер"),
                    max_chars=180,
                )
            )
        if len(overall_amounts) >= 2:
            extracted_fields["grand_total"] = overall_amounts[0]
            extracted_fields["vat_total"] = overall_amounts[1]
            confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.92)
            confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.88)
            normalization_notes.append("grand_total_restored_from_antares_summary")

            if isinstance(extracted_fields.get("work_total"), (int, float)):
                derived_parts_total = round(overall_amounts[0] - float(extracted_fields["work_total"]), 2)
                if derived_parts_total > 0:
                    extracted_fields["parts_total"] = derived_parts_total
                    confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.92)
                    normalization_notes.append("parts_total_derived_from_antares_overall_total")
        return

    if normalized_profile_scope == "ets_act":
        work_fragment = extract_fragment_after_marker(
            text,
            r"Итого\s+работ:",
            stop_patterns=(r"Расходная\s+накладная", r"Итого\s+материал", r"Руб", r"руб"),
            max_chars=250,
        )
        work_amounts = extract_amount_candidates_from_fragment(work_fragment)
        work_total_candidate = None
        if len(work_amounts) >= 8 and work_amounts[-1] > max(work_amounts[:-1]):
            work_total_candidate = work_amounts[-1]
        elif len(work_amounts) >= 3:
            work_total_candidate = work_amounts[-3]
        if work_total_candidate is not None and (
            not isinstance(extracted_fields.get("work_total"), (int, float))
            or float(extracted_fields["work_total"]) < float(work_total_candidate) * 0.5
        ):
            extracted_fields["work_total"] = work_total_candidate
            confidence_map["work_total"] = max(confidence_map.get("work_total", 0.0), 0.9)
            normalization_notes.append("work_total_restored_from_ets_act_summary")

        overall_fragment = extract_fragment_after_marker(
            text,
            r"Итого\s+по\s+акту\s+выполненных\s+работ",
            stop_patterns=(r"Всего\s+по\s+акту", r"Причина\s+обращения", r"Рекомендации"),
            max_chars=250,
        )
        overall_amounts = extract_amount_candidates_from_fragment(overall_fragment)
        if len(overall_amounts) >= 3:
            overall_net_total, overall_vat_total, overall_grand_total = overall_amounts[-3:]
            extracted_fields["vat_total"] = overall_vat_total
            extracted_fields["grand_total"] = overall_grand_total
            confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.9)
            confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.9)
            normalization_notes.append("grand_total_restored_from_ets_act_summary")

            if isinstance(extracted_fields.get("work_total"), (int, float)):
                derived_parts_total = round(overall_net_total - float(extracted_fields["work_total"]), 2)
                if derived_parts_total > 0:
                    extracted_fields["parts_total"] = derived_parts_total
                    confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.88)
                    normalization_notes.append("parts_total_derived_from_ets_act_summary")

        invoice_total_fragment = extract_fragment_after_marker(
            text,
            r"Всего\s+к\s+оплате:",
            stop_patterns=(r"Всего\s+наименований", r"Предпр", r"Счет-фактура"),
            max_chars=180,
        )
        invoice_total_amounts = extract_amount_candidates_from_fragment(invoice_total_fragment)
        if len(invoice_total_amounts) >= 3:
            if len(invoice_total_amounts) >= 4 and amounts_match(
                invoice_total_amounts[0],
                invoice_total_amounts[1],
                tolerance=0.01,
            ):
                invoice_net_total = invoice_total_amounts[0]
                invoice_vat_total = invoice_total_amounts[2]
                invoice_grand_total = invoice_total_amounts[3]
            else:
                invoice_net_total = invoice_total_amounts[-3]
                invoice_vat_total = invoice_total_amounts[-2]
                invoice_grand_total = invoice_total_amounts[-1]

            if (
                not isinstance(extracted_fields.get("vat_total"), (int, float))
                or float(extracted_fields["vat_total"]) < invoice_vat_total * 0.5
            ):
                extracted_fields["vat_total"] = invoice_vat_total
                confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.88)
                normalization_notes.append("vat_total_restored_from_ets_invoice_summary")

            if (
                not isinstance(extracted_fields.get("grand_total"), (int, float))
                or float(extracted_fields["grand_total"]) < invoice_grand_total * 0.5
            ):
                extracted_fields["grand_total"] = invoice_grand_total
                confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.9)
                normalization_notes.append("grand_total_restored_from_ets_invoice_summary")

            if isinstance(extracted_fields.get("work_total"), (int, float)):
                derived_parts_total = round(invoice_net_total - float(extracted_fields["work_total"]), 2)
                if derived_parts_total > 0 and (
                    not isinstance(extracted_fields.get("parts_total"), (int, float))
                    or float(extracted_fields["parts_total"]) < derived_parts_total * 0.5
                ):
                    extracted_fields["parts_total"] = derived_parts_total
                    confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.88)
                    normalization_notes.append("parts_total_derived_from_ets_invoice_summary")

        sparse_totals = extract_ets_act_sparse_scanned_totals(text)
        if sparse_totals:
            for field_name, confidence, note in (
                ("work_total", 0.9, "work_total_restored_from_ets_act_sparse_scan"),
                ("parts_total", 0.88, "parts_total_restored_from_ets_act_sparse_scan"),
                ("vat_total", 0.88, "vat_total_restored_from_ets_act_sparse_scan"),
                ("grand_total", 0.9, "grand_total_restored_from_ets_act_sparse_scan"),
            ):
                sparse_value = sparse_totals.get(field_name)
                if sparse_value is None:
                    continue
                current_value = extracted_fields.get(field_name)
                should_replace = not isinstance(current_value, (int, float))
                if isinstance(current_value, (int, float)) and float(current_value) < float(sparse_value) * 0.5:
                    should_replace = True
                if should_replace:
                    extracted_fields[field_name] = sparse_value
                    confidence_map[field_name] = max(confidence_map.get(field_name, 0.0), confidence)
                    normalization_notes.append(note)
        return

    if normalized_profile_scope == "sibtrakscan":
        work_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Всего\s+по\s+работам",
                stop_patterns=(r"Всего\s+по\s+материалам", r"Всего:", r"К\s+оплате"),
                max_chars=120,
            )
        )
        if work_amounts:
            extracted_fields["work_total"] = work_amounts[0]
            confidence_map["work_total"] = max(confidence_map.get("work_total", 0.0), 0.9)
            normalization_notes.append("work_total_restored_from_sibtrakscan_summary")

        parts_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Всего\s+по\s+материалам",
                stop_patterns=(r"Всего:", r"в\s+т\\.ч\\.\\s+НДС", r"Итого\s+по\s+заказ[- ]наряду"),
                max_chars=120,
            )
        )
        if parts_amounts:
            extracted_fields["parts_total"] = parts_amounts[0]
            confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.9)
            normalization_notes.append("parts_total_restored_from_sibtrakscan_summary")

        grand_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"К\s+оплате",
                stop_patterns=(r"Сто\s", r"Дата\s+оплаты", r"ГАРАНТИИ", r"РЕКОМЕНДАЦИИ"),
                max_chars=120,
            )
        )
        if not grand_amounts:
            grand_amounts = extract_amount_candidates_from_fragment(
                extract_fragment_after_marker(
                    text,
                    r"Итого\s+по\s+заказ[- ]наряду",
                    stop_patterns=(r"К\s+оплате", r"Сто\s", r"Дата\s+оплаты", r"ГАРАНТИИ", r"РЕКОМЕНДАЦИИ"),
                    max_chars=180,
                )
            )
        if grand_amounts:
            extracted_fields["grand_total"] = grand_amounts[-1]
            confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.92)
            normalization_notes.append("grand_total_restored_from_sibtrakscan_summary")

        vat_amounts = extract_amount_candidates_from_fragment(
            extract_fragment_after_marker(
                text,
                r"в\s+т\.ч\.\s+НДС",
                stop_patterns=(r"Итого\s+по\s+заказ[- ]наряду", r"К\s+оплате", r"Сто\s"),
                max_chars=120,
            )
        )
        if vat_amounts:
            extracted_fields["vat_total"] = vat_amounts[0]
            confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.9)
            normalization_notes.append("vat_total_restored_from_sibtrakscan_summary")
        return

    if normalized_profile_scope == "leader_trak":
        summary_fragment = extract_fragment_after_marker(
            text,
            r"Всего\s+по\s+наряд[- ]заказу",
            stop_patterns=(r"Всего:", r"Сумма\s+прописью", r"Сервисные\s+услуги", r"После\s+подписания"),
            max_chars=180,
        )
        summary_amounts = extract_amount_candidates_from_fragment(summary_fragment)
        if len(summary_amounts) >= 3:
            net_total, vat_total, grand_total = summary_amounts[-3:]
            extracted_fields["vat_total"] = vat_total
            extracted_fields["grand_total"] = grand_total
            confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.9)
            confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.92)
            normalization_notes.append("leader_trak_totals_restored_from_summary")

        invoice_summary_fragment = extract_fragment_after_marker(
            text,
            r"Итого\s+RUB:",
            stop_patterns=(r"Всего\s+наименований", r"Сумма\s+прописью"),
            max_chars=160,
        )
        invoice_summary_amounts = extract_amount_candidates_from_fragment(invoice_summary_fragment)
        if len(invoice_summary_amounts) >= 3:
            extracted_fields["vat_total"] = invoice_summary_amounts[-2]
            extracted_fields["grand_total"] = invoice_summary_amounts[-1]
            confidence_map["vat_total"] = max(confidence_map.get("vat_total", 0.0), 0.9)
            confidence_map["grand_total"] = max(confidence_map.get("grand_total", 0.0), 0.92)
            normalization_notes.append("leader_trak_totals_restored_from_invoice_summary")
        return

    if normalized_profile_scope != "axb":
        return

    axb_material_parts = extract_axb_material_parts(text)
    axb_material_parts_total = (
        round(sum(float(item.get("line_total") or 0) for item in axb_material_parts), 2)
        if axb_material_parts
        else None
    )

    profile_total_candidates = {
        "work_total": extract_largest_amount_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+работ:",
                stop_patterns=(r"Расходная\s+накладная", r"Итого\s+материал", r"Итого\s+по\s+заказ[- ]наряду", r"Всего\s+по\s+заказ[- ]наряду"),
                max_chars=800,
            )
        ),
        "parts_total": extract_largest_amount_from_fragment(
            extract_fragment_after_marker(
                text,
                r"Итого\s+материал(?:ов|ы):",
                stop_patterns=(r"Итого\s+по\s+причине\s+обращения", r"Всего\s+по\s+причине\s+обращения", r"Итого\s+по\s+заказ[- ]наряду", r"Всего\s+по\s+заказ[- ]наряду"),
                max_chars=1800,
            )
        ),
        "grand_total": extract_largest_amount_around_marker(
            text,
            r"(?:Итого|Всего)\s+по\s+заказ[- ]наряду",
            before_chars=180,
            after_chars=180,
            stop_patterns=(r"Заказчик\s+подтверждает", r"Заказ-наряд\s+и\s+Сч[её]т", r"Универсальный\s+передаточный"),
        ),
    }

    if axb_material_parts_total is not None and (
        profile_total_candidates["parts_total"] is None
        or float(profile_total_candidates["parts_total"]) < round(axb_material_parts_total * 0.7, 2)
    ):
        profile_total_candidates["parts_total"] = axb_material_parts_total

    for field_name, candidate_amount in profile_total_candidates.items():
        if candidate_amount is None:
            continue

        current_value_raw = extracted_fields.get(field_name)
        current_value = float(current_value_raw) if isinstance(current_value_raw, (int, float)) else None
        if current_value is not None and current_value >= candidate_amount:
            continue

        extracted_fields[field_name] = candidate_amount
        confidence_map[field_name] = max(confidence_map.get(field_name, 0.0), 0.86 if field_name == "grand_total" else 0.82)
        normalization_notes.append(f"{field_name}_restored_from_axb_profile_totals")

    work_total = extracted_fields.get("work_total")
    parts_total = extracted_fields.get("parts_total")
    grand_total = extracted_fields.get("grand_total")
    if (
        axb_material_parts_total is None
        and isinstance(work_total, (int, float))
        and isinstance(grand_total, (int, float))
    ):
        derived_parts_total = round(float(grand_total) - float(work_total), 2)
        if derived_parts_total > 0 and (
            not isinstance(parts_total, (int, float)) or float(parts_total) < round(derived_parts_total * 0.7, 2)
        ):
            extracted_fields["parts_total"] = derived_parts_total
            confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0.0), 0.84)
            normalization_notes.append("parts_total_derived_from_axb_grand_total")
