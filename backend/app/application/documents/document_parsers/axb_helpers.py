from __future__ import annotations

import re
from typing import Optional

from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_decimal_value


def _axb_name_merge_score(left: str, right: str) -> int:
    from app.application.documents.document_parsers.axb_work_items import axb_name_merge_score

    return axb_name_merge_score(left, right)


def is_axb_invoice_header_line(line: str) -> bool:
    normalized_line = normalize_line(line).lower().rstrip(":")
    compact_line = normalized_line.replace(" ", "")
    return normalized_line in {
        "артикул",
        "кол-во",
        "ед",
        "ед.",
        "цена",
        "скидка",
        "итого",
        "rub",
        "rub:",
        "в валюте",
        "в валюте:",
        "в т.ч. ндс",
        "в т ч ндс",
    } or "rub" in compact_line


def is_axb_invoice_stop_line(line: str) -> bool:
    normalized_line = normalize_line(line).lower()
    return normalized_line.startswith("всего наименований") or normalized_line in {"руководитель", "бухгалтер"}


def is_axb_invoice_total_marker(line: str) -> bool:
    compact_line = re.sub(
        r"[^A-Za-zА-Яа-яЁё]",
        "",
        normalize_line(line),
    ).lower()
    return compact_line in {"всего", "всег"} or bool(re.fullmatch(r"[bв][cс][eе][rг](?:[oо])?", compact_line))


def extract_axb_invoice_fragment(text: str) -> str:
    invoice_fragment = extract_fragment_after_marker(text, r"Счет\s+на\s+оплату", max_chars=7000)
    if invoice_fragment:
        return invoice_fragment

    lines = [normalize_line(line) for line in text.splitlines()]
    for index, line in enumerate(lines):
        lowered_line = line.lower()
        if not lowered_line or "товар" in lowered_line or "артикул" in lowered_line:
            continue
        if "на основании" not in lowered_line and "покупатель" not in lowered_line:
            continue

        search_window = "\n".join(lines[index : index + 48]).lower()
        if "товар" not in search_window or "артикул" not in search_window:
            continue
        if "заказ-наряд" not in search_window and "автомобиль" not in search_window:
            continue

        start_index = max(0, index - 6)
        while start_index > 0:
            previous_line = lines[start_index - 1].lower()
            if not previous_line:
                break
            if any(
                marker in previous_line
                for marker in ("поставщик", "получатель", "банк получателя", "образец заполнения")
            ):
                start_index -= 1
                continue
            if previous_line.startswith("сч.") or previous_line.startswith("cч.") or re.fullmatch(r"\d{6,}", previous_line):
                start_index -= 1
                continue
            break

        return "\n".join(filter(None, lines[start_index : min(len(lines), start_index + 160)])).strip()

    return ""


def parse_axb_quantity_candidate(line: str) -> Optional[tuple[float, Optional[str]]]:
    normalized_line = normalize_line(line).replace("|", "").strip()
    match = re.fullmatch(r"(?P<qty>\d+(?:[.,]\d+)?)\s*(?P<unit>[A-Za-zА-Яа-я4Ff-]{0,4})", normalized_line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    if quantity is None or quantity <= 0 or quantity > 20:
        return None

    raw_unit = (match.group("unit") or "").strip()
    if not raw_unit and abs(quantity - round(quantity)) <= 0.001:
        return None
    if not raw_unit and quantity > 0.5:
        return None
    if not raw_unit and re.search(r"[.,]00$", normalized_line):
        return None

    return quantity, raw_unit or None


def collapse_axb_name_lines(name_lines: list[str], expected_count: int) -> list[str]:
    groups = [normalized_line for line in name_lines if (normalized_line := normalize_line(line))]
    if expected_count <= 0 or not groups:
        return groups

    while len(groups) > expected_count:
        best_index = 0
        best_score = None
        for index in range(len(groups) - 1):
            score = _axb_name_merge_score(groups[index], groups[index + 1])
            if best_score is None or score > best_score:
                best_index = index
                best_score = score
        groups[best_index] = normalize_line(f"{groups[best_index]} {groups[best_index + 1]}")
        del groups[best_index + 1]

    return groups
