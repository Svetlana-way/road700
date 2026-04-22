from __future__ import annotations

import re
from typing import Optional

from app.application.documents.runtime_text import normalize_multiline_text, normalize_text
from app.application.documents.text_utils import (
    is_plausible_order_number,
    normalize_identifier_token,
    normalize_line,
    parse_amount,
    parse_decimal_value,
)
from app.application.documents.config import (
    ARTICLE_TOKEN_PATTERN,
    ITEM_UNIT_MARKERS,
    LINE_ITEM_PATTERN,
    MILEAGE_LABEL_PATTERN,
    OCR_TOKEN_CHAR_REPLACEMENTS,
    ODOMETER_LABEL_PATTERN,
    PART_LINE_WITH_ARTICLE_PATTERN,
    PART_SECTION_MARKERS,
    SECTION_FOOTER_MARKERS,
    UNIT_ALIASES,
    WORK_CODE_TOKEN_PATTERN,
    WORK_SECTION_MARKERS,
)


def _extract_ets_act_late_fragment(text: str) -> str:
    from app.application.documents.field_extractors import extract_ets_act_late_fragment

    return extract_ets_act_late_fragment(text)


def _find_plate_candidate(value: str | None) -> Optional[str]:
    from app.application.documents.field_extractors import find_plate_candidate

    return find_plate_candidate(value)


def _find_vin_candidate(value: str | None) -> Optional[str]:
    from app.application.documents.field_extractors import find_vin_candidate

    return find_vin_candidate(value)


def _parse_mileage_candidate(value: str | None) -> Optional[int]:
    from app.application.documents.field_extractors import parse_mileage_candidate

    return parse_mileage_candidate(value)


def _is_axb_compact_work_row_start(line: str) -> bool:
    from app.application.documents.document_parsers.axb_work_items import is_axb_compact_work_row_start

    return is_axb_compact_work_row_start(line)


def _is_axb_compact_work_continuation_line(line: str) -> bool:
    from app.application.documents.document_parsers.axb_work_items import is_axb_compact_work_continuation_line

    return is_axb_compact_work_continuation_line(line)


def _extract_axb_compact_work_row(line: str) -> Optional[dict[str, object]]:
    from app.application.documents.document_parsers.axb_work_items import extract_axb_compact_work_row

    return extract_axb_compact_work_row(line)


def _clean_axb_work_name(name: str) -> str:
    from app.application.documents.document_parsers.axb_work_items import clean_axb_work_name

    return clean_axb_work_name(name)


def detect_document_flags(text: str) -> list[str]:
    normalized = normalize_multiline_text(text).lower()
    flags: list[str] = []
    if "exchange program" in normalized:
        flags.append("exchange_program_present")
    return flags


def extract_ets_act_scanned_header_fields(text: str) -> dict[str, object]:
    fragment = _extract_ets_act_late_fragment(text)
    if not fragment:
        return {}

    extracted: dict[str, object] = {}
    order_match = re.search(
        r"Акт\s+выполненных\s+работ\s*(?:N|№|No|Nº)?\s*(?P<value>[A-Za-zА-Яа-я0-9]{4,})",
        fragment,
        re.IGNORECASE,
    )
    if order_match:
        extracted["order_number"] = normalize_identifier_token(order_match.group("value"))

    plate_match = re.search(r"Гос\.\s*номер\s*(?P<value>[^\n\r]{0,24})", fragment, re.IGNORECASE)
    if plate_match:
        raw_plate_value = plate_match.group("value")
        plate_number = _find_plate_candidate(raw_plate_value) or _find_plate_candidate(normalize_identifier_token(raw_plate_value))
        if plate_number:
            extracted["plate_number"] = plate_number

    vin_match = re.search(r"VIN\s*(?P<value>[^\n\r]{0,24})", fragment, re.IGNORECASE)
    if vin_match:
        vin = _find_vin_candidate(vin_match.group("value")) or _find_vin_candidate(fragment)
        if vin:
            extracted["vin"] = vin

    mileage_match = re.search(
        rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\s*[:№]?\s*(?P<value>\d[\d\s]{{2,}})",
        fragment,
        re.IGNORECASE,
    )
    if mileage_match:
        mileage = _parse_mileage_candidate(mileage_match.group("value"))
        if mileage is not None:
            extracted["mileage"] = mileage

    return extracted


def build_section_body_pattern(markers: tuple[str, ...], stop_markers: tuple[str, ...]) -> re.Pattern[str]:
    marker_pattern = "|".join(re.escape(marker.rstrip(":")) + ":?" for marker in markers)
    stop_pattern = "|".join(re.escape(marker) for marker in stop_markers)
    return re.compile(
        rf"(?:^|\b)(?:{marker_pattern})\b\s*(?P<body>.+?)(?=(?:\b(?:{stop_pattern})\b)|$)",
        re.IGNORECASE | re.DOTALL,
    )


def tokenize_inline_section(section_text: str) -> list[str]:
    return [token for token in re.split(r"\s+", normalize_line(section_text)) if token]


def normalize_token_for_unit(token: str) -> str:
    return token.lower().strip(".,;:!?)(")


def normalize_ocr_code_token(value: str) -> str:
    return normalize_text(value).translate(OCR_TOKEN_CHAR_REPLACEMENTS)


def normalize_unit_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_token_for_unit(value)
    compact_value = normalized_value.replace(" ", "")
    translated_value = normalize_ocr_code_token(compact_value).lower()
    translated_value = translated_value.replace(".", ".").replace("/", "/")
    return (
        UNIT_ALIASES.get(compact_value)
        or UNIT_ALIASES.get(translated_value)
        or compact_value
        or None
    )


def normalize_article_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_ocr_code_token(value).upper()
    normalized_value = re.sub(r"[^A-Z0-9/_-]+", "", normalized_value)
    return normalized_value or None


def split_work_code_and_name(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_text(value)
    parts = normalized_value.split(maxsplit=1)
    if len(parts) == 2 and (WORK_CODE_TOKEN_PATTERN.fullmatch(parts[0]) or ARTICLE_TOKEN_PATTERN.fullmatch(parts[0])):
        return normalize_article_value(parts[0]), parts[1]
    return None, normalized_value


def is_meaningful_work_name(value: object) -> bool:
    normalized_value = normalize_line(str(value or ""))
    lower_value = normalized_value.lower()
    if not normalized_value:
        return False
    if lower_value in {"n", "no", "nº", "№"}:
        return False
    if re.fullmatch(r"\d+(?:[.,]\d+)?\s*(?:н/?ч|нч|шт|г|гр|мл|литр|л|кг|м)\b", lower_value):
        return False

    alpha_tokens = re.findall(r"[A-Za-zА-Яа-я]+", lower_value)
    if any(token in {"итого", "всего", "ндс", "rub", "руб"} for token in alpha_tokens):
        return False
    if any(marker in lower_value for marker in ("итого rub", "всего rub", "сумма ндс", "в т.ч. ндс")):
        return False
    return True


def is_meaningful_part_name(value: object) -> bool:
    normalized_value = normalize_line(str(value or ""))
    lower_value = normalized_value.lower()
    if not normalized_value:
        return False
    if not re.search(r"[A-Za-zА-Яа-я]", normalized_value):
        return False
    if any(marker in lower_value for marker in ("итого", "всего", "ндс", "rub", "руб")):
        return False
    if re.fullmatch(r"\d+(?:[.,]\d+)?\s*(?:шт|г|гр|мл|литр|л|кг|м)\b", lower_value):
        return False
    return True


def has_meaningful_leader_trak_items(extracted_items: dict[str, list[dict[str, object]]]) -> bool:
    works = extracted_items.get("works") or []
    parts = extracted_items.get("parts") or []
    return any(is_meaningful_work_name(item.get("work_name")) for item in works) or any(
        is_meaningful_part_name(item.get("part_name")) for item in parts
    )


def sanitize_extracted_items(extracted_items: dict[str, list[dict[str, object]]]) -> tuple[dict[str, list[dict[str, object]]], int]:
    works = extracted_items.get("works") or []
    parts = extracted_items.get("parts") or []
    sanitized_works = [item for item in works if is_meaningful_work_name(item.get("work_name"))]
    removed_count = len(works) - len(sanitized_works)
    return {"works": sanitized_works, "parts": list(parts)}, removed_count


def is_quantity_token(token: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:[.,]\d+)?", token))


def is_amount_token(token: str) -> bool:
    return parse_amount(token) is not None


def parse_inline_item_sequence(section_text: str, target: str) -> list[dict[str, object]]:
    tokens = tokenize_inline_section(section_text)
    items: list[dict[str, object]] = []
    start_index = 0
    item_unit_markers = ITEM_UNIT_MARKERS
    section_footer_markers = SECTION_FOOTER_MARKERS
    while start_index < len(tokens):
        matched = False
        for quantity_index in range(start_index + 1, len(tokens)):
            if not is_quantity_token(tokens[quantity_index]):
                continue

            amount_start_index = quantity_index + 1
            unit_token: Optional[str] = None
            normalized_candidate_unit = (
                normalize_unit_name(tokens[amount_start_index]) if amount_start_index < len(tokens) else None
            )
            if normalized_candidate_unit in item_unit_markers:
                unit_token = normalized_candidate_unit
                amount_start_index += 1

            if amount_start_index + 1 >= len(tokens):
                continue
            if not is_amount_token(tokens[amount_start_index]) or not is_amount_token(tokens[amount_start_index + 1]):
                continue

            prefix_tokens = tokens[start_index:quantity_index]
            if not prefix_tokens:
                continue

            payload_text = " ".join(prefix_tokens)
            if any(marker in payload_text.lower() for marker in section_footer_markers):
                return items

            quantity = parse_decimal_value(tokens[quantity_index])
            price = parse_amount(tokens[amount_start_index])
            total = parse_amount(tokens[amount_start_index + 1])
            if quantity is None or price is None or total is None:
                continue

            if target == "works":
                work_code, work_name = split_work_code_and_name(payload_text)
                payload = {
                    "work_code": work_code,
                    "work_name": work_name[:500],
                    "quantity": quantity,
                    "unit_name": normalize_unit_name(unit_token),
                    "price": price,
                    "line_total": total,
                }
            else:
                article = None
                name_tokens = prefix_tokens
                if len(prefix_tokens) > 1 and ARTICLE_TOKEN_PATTERN.fullmatch(prefix_tokens[0]):
                    article = normalize_article_value(prefix_tokens[0])
                    name_tokens = prefix_tokens[1:]
                part_name = " ".join(name_tokens).strip()
                if not part_name:
                    continue
                payload = {
                    "article": article,
                    "part_name": part_name[:500],
                    "quantity": quantity,
                    "unit_name": normalize_unit_name(unit_token),
                    "price": price,
                    "line_total": total,
                }

            items.append(payload)
            start_index = amount_start_index + 2
            matched = True
            break

        if not matched:
            break

    return items


def extract_inline_section_items(text: str) -> dict[str, list[dict[str, object]]]:
    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    normalized_text = normalize_line(text.replace("\n", " "))

    work_pattern = build_section_body_pattern(
        WORK_SECTION_MARKERS,
        PART_SECTION_MARKERS + SECTION_FOOTER_MARKERS,
    )
    part_pattern = build_section_body_pattern(
        PART_SECTION_MARKERS,
        SECTION_FOOTER_MARKERS,
    )

    work_match = work_pattern.search(normalized_text)
    if work_match:
        works = parse_inline_item_sequence(work_match.group("body"), "works")

    part_match = part_pattern.search(normalized_text)
    if part_match:
        parts = parse_inline_item_sequence(part_match.group("body"), "parts")

    return {"works": works, "parts": parts}


def parse_work_line(line: str) -> Optional[dict[str, object]]:
    match = LINE_ITEM_PATTERN.match(line)
    if not match:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    total = parse_amount(match.group("total"))
    work_code, name = split_work_code_and_name(normalize_text(match.group("name")))
    if quantity is None or price is None or total is None or not name:
        return None

    return {
        "work_code": work_code,
        "work_name": name[:500],
        "quantity": quantity,
        "unit_name": normalize_unit_name(match.group("unit")),
        "price": price,
        "line_total": total,
    }


def parse_part_line(line: str) -> Optional[dict[str, object]]:
    match = PART_LINE_WITH_ARTICLE_PATTERN.match(line)
    article = None
    if match is None:
        match = LINE_ITEM_PATTERN.match(line)
    else:
        article = normalize_text(match.group("article"))

    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    total = parse_amount(match.group("total"))
    name = normalize_text(match.group("name"))
    if quantity is None or price is None or total is None or not name:
        return None

    return {
        "article": normalize_article_value(article),
        "part_name": name[:500],
        "quantity": quantity,
        "unit_name": normalize_unit_name(match.groupdict().get("unit")),
        "price": price,
        "line_total": total,
    }


def extract_line_items(text: str) -> dict[str, list[dict[str, object]]]:
    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    current_section: Optional[str] = None
    for raw_line in text.splitlines():
        line = normalize_line(raw_line)
        if not line:
            continue

        lower_line = line.lower()
        if any(marker in lower_line for marker in WORK_SECTION_MARKERS):
            current_section = "works"
            if lower_line.startswith("работа:"):
                payload = parse_work_line(line.split(":", 1)[1].strip())
                if payload:
                    works.append(payload)
            continue

        if any(marker in lower_line for marker in PART_SECTION_MARKERS):
            current_section = "parts"
            if lower_line.startswith("запчасть:"):
                payload = parse_part_line(line.split(":", 1)[1].strip())
                if payload:
                    parts.append(payload)
            continue

        if current_section == "works":
            payload = parse_work_line(line)
            if payload:
                works.append(payload)
                continue

        if current_section == "parts":
            payload = parse_part_line(line)
            if payload:
                parts.append(payload)
                continue

        if lower_line.startswith("работа:"):
            payload = parse_work_line(line.split(":", 1)[1].strip())
            if payload:
                works.append(payload)
            continue

        if lower_line.startswith("запчасть:"):
            payload = parse_part_line(line.split(":", 1)[1].strip())
            if payload:
                parts.append(payload)

    if works or parts:
        return {"works": works, "parts": parts}

    return extract_inline_section_items(text)


def summarize_line_totals(extracted_items: dict[str, list[dict[str, object]]]) -> tuple[Optional[float], Optional[float]]:
    works = extracted_items.get("works") or []
    parts = extracted_items.get("parts") or []
    works_total = round(sum(float(item["line_total"]) for item in works), 2) if works else None
    parts_total = round(sum(float(item["line_total"]) for item in parts), 2) if parts else None
    return works_total, parts_total


def amounts_match(left: Optional[float], right: Optional[float], tolerance: float = 0.0) -> bool:
    if left is None or right is None:
        return False
    return abs(left - right) <= tolerance


def reconcile_header_totals_with_line_items(
    extracted_fields: dict[str, object],
    extracted_items: dict[str, list[dict[str, object]]],
    confidence_map: dict[str, float],
) -> list[str]:
    notes: list[str] = []
    works_total_from_lines, parts_total_from_lines = summarize_line_totals(extracted_items)

    if works_total_from_lines is not None and "work_total" not in extracted_fields:
        extracted_fields["work_total"] = works_total_from_lines
        confidence_map["work_total"] = 0.68
        notes.append("work_total_restored_from_lines")

    if parts_total_from_lines is not None and "parts_total" not in extracted_fields:
        extracted_fields["parts_total"] = parts_total_from_lines
        confidence_map["parts_total"] = 0.68
        notes.append("parts_total_restored_from_lines")

    grand_total = float(extracted_fields["grand_total"]) if "grand_total" in extracted_fields else None
    vat_total = float(extracted_fields.get("vat_total", 0) or 0) if "vat_total" in extracted_fields else 0.0
    if grand_total is None:
        return notes

    if works_total_from_lines is not None and parts_total_from_lines is not None:
        inferred_grand_total = round(works_total_from_lines + parts_total_from_lines + vat_total, 2)
        if amounts_match(inferred_grand_total, grand_total):
            current_work_total = float(extracted_fields["work_total"]) if "work_total" in extracted_fields else None
            current_parts_total = float(extracted_fields["parts_total"]) if "parts_total" in extracted_fields else None

            if not amounts_match(current_work_total, works_total_from_lines):
                extracted_fields["work_total"] = works_total_from_lines
                confidence_map["work_total"] = max(confidence_map.get("work_total", 0), 0.68)
                notes.append("work_total_aligned_with_lines")

            if not amounts_match(current_parts_total, parts_total_from_lines):
                extracted_fields["parts_total"] = parts_total_from_lines
                confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0), 0.68)
                notes.append("parts_total_aligned_with_lines")

    return notes


def extract_leader_trak_order_number(text: str) -> Optional[str]:
    for pattern in (
        r"План\s+ремонта\s*№\s*([A-Za-zА-Яа-я0-9/_-]{3,})",
        r"Предварительный\s+счет\s+на\s+оплату\s*№\s*([A-Za-zА-Яа-я0-9/_-]{3,})",
    ):
        match = re.search(pattern, text, re.IGNORECASE)
        if match is None:
            continue
        order_number = normalize_line(match.group(1))
        if is_plausible_order_number(order_number):
            return order_number
    return None


def extract_axb_compact_work_items(text: str) -> list[dict[str, object]]:
    work_body_match = re.search(
        r"Выполненные\s+работы\s+(?:по|no|No|ho|но)?\s*заказ[- ]наряду(?P<body>.*?)(?:Итого\s+работ:)",
        text,
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    if work_body_match is None:
        return []

    work_body_lines = [
        normalize_line(line)
        for line in work_body_match.group("body").splitlines()
        if normalize_line(line)
    ]
    compact_rows: list[dict[str, object]] = []
    current_row: Optional[dict[str, object]] = None

    for line in work_body_lines:
        if _is_axb_compact_work_row_start(line):
            row_payload = _extract_axb_compact_work_row(line)
            if row_payload is None:
                continue
            if current_row is not None and current_row.get("name_lines"):
                compact_rows.append(current_row)
            current_row = row_payload
            continue
        if current_row is not None and _is_axb_compact_work_continuation_line(line):
            current_row.setdefault("name_lines", []).append(line)

    if current_row is not None and current_row.get("name_lines"):
        compact_rows.append(current_row)

    works: list[dict[str, object]] = []
    for row_payload in compact_rows:
        work_name = _clean_axb_work_name(" ".join(str(line) for line in row_payload.get("name_lines", [])))[:500]
        if not work_name:
            continue
        standard_hours = row_payload.get("standard_hours")
        works.append(
            {
                "work_code": row_payload.get("work_code"),
                "work_name": work_name,
                "quantity": float(standard_hours) if isinstance(standard_hours, (int, float)) else 1.0,
                "standard_hours": float(standard_hours) if isinstance(standard_hours, (int, float)) else None,
                "unit_name": "ч" if isinstance(standard_hours, (int, float)) else "усл",
                "price": float(row_payload.get("price") or row_payload.get("line_total") or 0.0),
                "line_total": float(row_payload["line_total"]),
            }
        )

    return works
