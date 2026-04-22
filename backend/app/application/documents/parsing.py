from __future__ import annotations

from sqlalchemy.orm import Session

from app.application.documents.field_extractors import (
    extract_header_text,
    extract_service_candidate_from_text,
    extract_vehicle_identifiers_from_section,
    extract_vehicle_section_text,
    find_chassis_candidate,
    find_plate_candidate,
    find_vin_candidate,
    has_explicit_missing_mileage,
    has_logistics_blank_mileage_field,
    is_gruzovye_rezervy_invoice_only_document,
    is_leader_trak_invoice_only_document,
    is_logistics_trailer_vehicle_context,
    normalize_service_candidate,
    parse_mileage_candidate,
)
from app.application.documents.parser_helpers import (
    detect_document_flags,
    extract_ets_act_scanned_header_fields,
    extract_leader_trak_order_number,
    extract_line_items,
    has_meaningful_leader_trak_items,
    reconcile_header_totals_with_line_items,
    sanitize_extracted_items,
)
from app.application.documents.document_parsers.axb_work_items import repair_axb_fragmented_work_items
from app.application.documents.profile_fallbacks import (
    apply_profile_specific_item_fallbacks,
    apply_profile_specific_total_fallbacks,
)
from app.application.documents.document_metadata import is_service_name_suspicious, remove_manual_review_reason
from app.application.documents.ocr_field_helpers import extract_header_field
from app.application.documents.ocr_profiles import (
    group_ocr_rules_by_field,
    infer_builtin_profile_scope_from_text,
    load_active_ocr_rules,
    normalize_ocr_rule_code,
)
from app.application.documents.parser_patterns import KLEVER_TRAK_VEHICLE_ROW_PATTERN
from app.application.documents.runtime_text import (
    extract_not_done_items_from_text,
    extract_reason_from_text,
    extract_recommendations_from_text,
    normalize_text,
    select_best_text_variant,
)
from app.application.documents.text_utils import is_plausible_order_number, normalize_identifier_token
from app.application.documents.vehicle_matching import enrich_vehicle_fields_from_registry
from app.application.services.service_catalog import (
    find_service_name_in_text,
    normalize_service_key,
)
from app.application.documents.config import (
    DATE_PATTERNS,
    MILEAGE_PATTERNS,
    ORDER_PATTERNS,
    PLATE_PATTERNS,
    SERVICE_PATTERNS,
    TOTAL_PATTERNS,
    VIN_PATTERNS,
)


def parse_document_text(text: str, db: Session | None = None, *, profile_scope: str | None = None) -> dict[str, object]:
    text = select_best_text_variant(text)
    normalized_profile_scope = normalize_ocr_rule_code(profile_scope)
    if not normalized_profile_scope:
        inferred_profile_scope = infer_builtin_profile_scope_from_text(text)
        normalized_profile_scope = normalize_ocr_rule_code(inferred_profile_scope)
    header_text = extract_header_text(text)
    vehicle_section_text = extract_vehicle_section_text(text)
    field_search_texts: list[str] = []
    for candidate in (vehicle_section_text, header_text):
        normalized_candidate = normalize_text(candidate)
        if normalized_candidate and normalized_candidate not in field_search_texts:
            field_search_texts.append(normalized_candidate)
    extracted_fields = {}
    confidence_map = {}
    manual_review_reasons = []
    normalization_notes = []
    normalization_notes.extend(detect_document_flags(text))
    extracted_items = extract_line_items(text)
    extracted_items, removed_noise_work_count = sanitize_extracted_items(extracted_items)
    if removed_noise_work_count:
        normalization_notes.append(f"noise_work_items_removed:{removed_noise_work_count}")
    rule_map = (
        group_ocr_rules_by_field(
            load_active_ocr_rules(db, profile_scope=normalized_profile_scope),
            profile_scope=normalized_profile_scope,
        )
        if db is not None
        else {}
    )
    section_plate_number, section_vin, section_mileage = extract_vehicle_identifiers_from_section(text)
    section_chassis_number = find_chassis_candidate(vehicle_section_text) or find_chassis_candidate(header_text)

    order_number, order_number_confidence, _ = extract_header_field(
        header_text,
        target_field="order_number",
        fallback_patterns=ORDER_PATTERNS,
        fallback_parser="raw",
        fallback_confidence=0.74,
        rule_map=rule_map,
    )
    if isinstance(order_number, str) and is_plausible_order_number(order_number):
        extracted_fields["order_number"] = order_number
        confidence_map["order_number"] = float(order_number_confidence or 0.74)
    else:
        manual_review_reasons.append("order_number_missing")

    repair_date, repair_date_confidence, repair_date_invalid = extract_header_field(
        header_text,
        target_field="repair_date",
        fallback_patterns=DATE_PATTERNS,
        fallback_parser="date",
        fallback_confidence=0.7,
        rule_map=rule_map,
    )
    if isinstance(repair_date, str) and repair_date:
        extracted_fields["repair_date"] = repair_date
        confidence_map["repair_date"] = float(repair_date_confidence or 0.7)
    elif repair_date_invalid:
        manual_review_reasons.append("repair_date_invalid")
    else:
        manual_review_reasons.append("repair_date_missing")

    if section_mileage is not None:
        extracted_fields["mileage"] = section_mileage
        confidence_map["mileage"] = 0.9
    else:
        mileage_found = False
        explicit_missing_mileage = any(has_explicit_missing_mileage(field_text) for field_text in field_search_texts)
        logistics_blank_mileage = normalized_profile_scope == "logistics" and has_logistics_blank_mileage_field(text)
        suppress_missing_mileage_review = explicit_missing_mileage or (
            normalized_profile_scope == "logistics" and is_logistics_trailer_vehicle_context(text)
        ) or logistics_blank_mileage
        if not explicit_missing_mileage:
            for field_text in field_search_texts:
                mileage, mileage_confidence, _ = extract_header_field(
                    field_text,
                    target_field="mileage",
                    fallback_patterns=MILEAGE_PATTERNS,
                    fallback_parser="digits_int",
                    fallback_confidence=0.82,
                    rule_map=rule_map,
                )
                if isinstance(mileage, int):
                    extracted_fields["mileage"] = mileage
                    confidence_map["mileage"] = float(mileage_confidence or 0.82)
                    mileage_found = True
                    break
        if not mileage_found and not suppress_missing_mileage_review:
            manual_review_reasons.append("mileage_missing")

    if section_plate_number:
        extracted_fields["plate_number"] = section_plate_number
        confidence_map["plate_number"] = 0.9
    else:
        for field_text in field_search_texts:
            plate_number, plate_number_confidence, _ = extract_header_field(
                field_text,
                target_field="plate_number",
                fallback_patterns=PLATE_PATTERNS,
                fallback_parser="raw",
                fallback_confidence=0.77,
                rule_map=rule_map,
            )
            if isinstance(plate_number, str) and plate_number:
                normalized_plate = find_plate_candidate(plate_number) or normalize_identifier_token(plate_number)
                if normalized_plate:
                    extracted_fields["plate_number"] = normalized_plate
                    confidence_map["plate_number"] = float(plate_number_confidence or 0.77)
                    break

    if section_vin:
        extracted_fields["vin"] = section_vin
        confidence_map["vin"] = 0.92
    else:
        for field_text in field_search_texts:
            vin, vin_confidence, _ = extract_header_field(
                field_text,
                target_field="vin",
                fallback_patterns=VIN_PATTERNS,
                fallback_parser="raw",
                fallback_confidence=0.88,
                rule_map=rule_map,
            )
            if isinstance(vin, str) and vin:
                normalized_vin = find_vin_candidate(vin) or normalize_identifier_token(vin)
                if normalized_vin:
                    extracted_fields["vin"] = normalized_vin
                    confidence_map["vin"] = float(vin_confidence or 0.88)
                    break

    if section_chassis_number:
        extracted_fields["chassis_number"] = section_chassis_number
        confidence_map["chassis_number"] = 0.78

    resolved_service_match = find_service_name_in_text(text, db=db) if db is not None else find_service_name_in_text(text)
    service_name, service_name_confidence, _ = extract_header_field(
        text,
        target_field="service_name",
        fallback_patterns=SERVICE_PATTERNS,
        fallback_parser="raw",
        fallback_confidence=0.58,
        rule_map=rule_map,
    )
    service_candidate = normalize_service_candidate(service_name) if isinstance(service_name, str) else None
    labeled_service_candidate = extract_service_candidate_from_text(text)
    if labeled_service_candidate:
        labeled_key = normalize_service_key(labeled_service_candidate)
        current_key = normalize_service_key(service_candidate) if service_candidate else None
        if (
            service_candidate is None
            or not current_key
            or (labeled_key and current_key and labeled_key.startswith(current_key))
            or len(labeled_service_candidate) > len(service_candidate) + 4
        ):
            service_candidate = labeled_service_candidate

    if resolved_service_match is not None:
        extracted_fields["service_name"] = resolved_service_match[0]
        confidence_map["service_name"] = 0.92
        normalization_notes.append(f"Сервис распознан по тексту документа: {resolved_service_match[1]}")
    elif service_candidate:
        if is_service_name_suspicious(service_candidate):
            manual_review_reasons.append("service_name_suspicious")
        else:
            extracted_fields["service_name"] = service_candidate[:120]
            confidence_map["service_name"] = float(service_name_confidence or 0.58)

    reason = extract_reason_from_text(text)
    if reason:
        extracted_fields["reason"] = reason
        confidence_map["reason"] = 0.84
    employee_comment = extract_recommendations_from_text(text)
    if employee_comment:
        extracted_fields["employee_comment"] = employee_comment
        confidence_map["employee_comment"] = 0.8
    service_not_done = extract_not_done_items_from_text(text)

    if normalized_profile_scope == "leader_trak" and "order_number" not in extracted_fields:
        leader_trak_order_number = extract_leader_trak_order_number(header_text or text)
        if leader_trak_order_number:
            extracted_fields["order_number"] = leader_trak_order_number
            confidence_map["order_number"] = max(confidence_map.get("order_number", 0.0), 0.9)
            remove_manual_review_reason(manual_review_reasons, "order_number_missing")

    if normalized_profile_scope == "ets_act":
        ets_scanned_fields = extract_ets_act_scanned_header_fields(text)
        for field_name, confidence in (
            ("order_number", 0.9),
            ("plate_number", 0.88),
            ("vin", 0.9),
            ("mileage", 0.88),
        ):
            field_value = ets_scanned_fields.get(field_name)
            if field_value is None or field_name in extracted_fields:
                continue
            extracted_fields[field_name] = field_value
            confidence_map[field_name] = max(confidence_map.get(field_name, 0.0), confidence)
            if field_name == "order_number":
                remove_manual_review_reason(manual_review_reasons, "order_number_missing")
            elif field_name == "mileage":
                remove_manual_review_reason(manual_review_reasons, "mileage_missing")

    if normalized_profile_scope == "klever_trak":
        klever_match = KLEVER_TRAK_VEHICLE_ROW_PATTERN.search(text)
        if klever_match is not None:
            mileage = parse_mileage_candidate(klever_match.group("mileage"))
            if mileage is not None:
                extracted_fields["mileage"] = mileage
                confidence_map["mileage"] = max(confidence_map.get("mileage", 0.0), 0.9)
                remove_manual_review_reason(manual_review_reasons, "mileage_missing")

    for field_name, patterns in TOTAL_PATTERNS.items():
        amount, amount_confidence, _ = extract_header_field(
            text,
            target_field=field_name,
            fallback_patterns=patterns,
            fallback_parser="amount",
            fallback_confidence=0.8 if field_name == "grand_total" else 0.72,
            rule_map=rule_map,
        )
        if not isinstance(amount, (int, float)):
            continue
        extracted_fields[field_name] = float(amount)
        confidence_map[field_name] = float(amount_confidence or (0.8 if field_name == "grand_total" else 0.72))

    apply_profile_specific_total_fallbacks(
        text,
        profile_scope=normalized_profile_scope,
        extracted_fields=extracted_fields,
        confidence_map=confidence_map,
        normalization_notes=normalization_notes,
    )

    extracted_items = apply_profile_specific_item_fallbacks(
        text,
        profile_scope=normalized_profile_scope,
        extracted_items=extracted_items,
        extracted_fields=extracted_fields,
        normalization_notes=normalization_notes,
    )
    if normalized_profile_scope == "axb":
        extracted_items = {
            "works": repair_axb_fragmented_work_items(extracted_items.get("works") or [], document_text=text),
            "parts": list(extracted_items.get("parts") or []),
        }
    extracted_items, removed_post_fallback_noise_work_count = sanitize_extracted_items(extracted_items)
    if removed_post_fallback_noise_work_count:
        normalization_notes.append(f"noise_work_items_removed_after_fallback:{removed_post_fallback_noise_work_count}")

    if normalized_profile_scope == "leader_trak" and is_leader_trak_invoice_only_document(text):
        if (extracted_items.get("works") or extracted_items.get("parts")) and not has_meaningful_leader_trak_items(extracted_items):
            extracted_items = {"works": [], "parts": []}
            normalization_notes.append("leader_trak_invoice_only_items_suppressed")

    normalization_notes.extend(
        reconcile_header_totals_with_line_items(
            extracted_fields=extracted_fields,
            extracted_items=extracted_items,
            confidence_map=confidence_map,
        )
    )

    if normalized_profile_scope == "gruzovye_rezervy" and is_gruzovye_rezervy_invoice_only_document(text):
        removed_reasons = []
        if "order_number_missing" in manual_review_reasons:
            remove_manual_review_reason(manual_review_reasons, "order_number_missing")
            removed_reasons.append("order_number_missing")
        if "mileage_missing" in manual_review_reasons:
            remove_manual_review_reason(manual_review_reasons, "mileage_missing")
            removed_reasons.append("mileage_missing")
        if removed_reasons:
            normalization_notes.append(
                "gruzovye_rezervy_invoice_only_review_suppressed:" + ",".join(removed_reasons)
            )

    if normalized_profile_scope == "leader_trak" and is_leader_trak_invoice_only_document(text):
        removed_reasons = []
        if "mileage_missing" in manual_review_reasons:
            remove_manual_review_reason(manual_review_reasons, "mileage_missing")
            removed_reasons.append("mileage_missing")
        if removed_reasons:
            normalization_notes.append(
                "leader_trak_invoice_only_review_suppressed:" + ",".join(removed_reasons)
            )

    if db is not None:
        enrich_vehicle_fields_from_registry(
            db,
            extracted_fields=extracted_fields,
            confidence_map=confidence_map,
            normalization_notes=normalization_notes,
        )

    return {
        "extracted_fields": extracted_fields,
        "extracted_items": extracted_items,
        "confidence_map": confidence_map,
        "manual_review_reasons": manual_review_reasons,
        "normalization_notes": normalization_notes,
        "service_not_done": service_not_done,
    }
