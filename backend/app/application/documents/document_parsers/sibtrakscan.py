from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import SIBTRAKSCAN_ROW_PATTERN, SIBTRAKSCAN_ROW_START_PATTERN
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_sibtrakscan_noise_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    lower_line = normalized_line.lower()
    if not normalized_line:
        return True
    if lower_line.startswith("стр."):
        return True
    if lower_line.startswith("страница "):
        return True
    if lower_line.startswith("передан через диадок"):
        return True
    if re.fullmatch(r"[0-9a-f-]{16,}", lower_line):
        return True
    return False


def extract_sibtrakscan_row_buffers(text: str) -> list[str]:
    fragment = extract_fragment_after_marker(
        text,
        r"ЗАДАНИЕ\s*:",
        stop_patterns=(r"Итого\s+нормочасов", r"Всего\s+по\s+работам", r"Итого\s+по\s+заказ[- ]наряду", r"К\s+оплате"),
        max_chars=20000,
    )
    if not fragment:
        return []

    lines = [normalize_line(line) for line in fragment.splitlines() if normalize_line(line)]
    buffers: list[str] = []
    current_buffer: list[str] = []

    for line in lines:
        lower_line = line.lower()
        if is_sibtrakscan_noise_line(line):
            continue
        if lower_line.startswith("задание:") or lower_line.startswith("итого по заданию"):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
                current_buffer = []
            continue
        if SIBTRAKSCAN_ROW_START_PATTERN.match(line):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
            current_buffer = [line]
            continue
        if current_buffer:
            current_buffer.append(line)

    if current_buffer:
        buffers.append(normalize_line(" ".join(current_buffer)))
    return buffers


def parse_sibtrakscan_row(line: str) -> Optional[tuple[str, dict[str, object]]]:
    match = SIBTRAKSCAN_ROW_PATTERN.match(line)
    if match is None:
        return None

    unit_name = normalize_unit_name(match.group("unit"))
    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    net_total = parse_amount(match.group("net"))
    if unit_name is None or quantity is None or price is None or net_total is None:
        return None

    code_value = normalize_article_value(match.group("code"))
    name_value = normalize_line(match.group("name"))[:500]
    if unit_name == "нч":
        return (
            "works",
            {
                "work_code": code_value,
                "work_name": name_value,
                "quantity": quantity,
                "unit_name": unit_name,
                "price": price,
                "line_total": net_total,
                "standard_hours": quantity,
            },
        )

    return (
        "parts",
        {
            "article": code_value,
            "part_name": name_value,
            "quantity": quantity,
            "unit_name": unit_name,
            "price": price,
            "line_total": net_total,
        },
    )


def extract_sibtrakscan_items(text: str) -> dict[str, list[dict[str, object]]]:
    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    for buffer in extract_sibtrakscan_row_buffers(text):
        parsed_row = parse_sibtrakscan_row(buffer)
        if parsed_row is None:
            continue
        item_kind, payload = parsed_row
        if item_kind == "works":
            works.append(payload)
        else:
            parts.append(payload)
    return {"works": works, "parts": parts}
