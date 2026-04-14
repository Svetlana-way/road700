from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import (
    GRUZOVYE_REZERVY_ROW_PATTERN,
    GRUZOVYE_REZERVY_ROW_START_PATTERN,
    GRUZOVYE_REZERVY_ROW_TAIL_PATTERN,
)
from app.application.documents.config import ARTICLE_TOKEN_PATTERN
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_gruzovye_rezervy_noise_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    lower_line = normalized_line.lower()
    if not normalized_line:
        return True
    if lower_line.startswith("передан через диадок"):
        return True
    if lower_line.startswith("страница "):
        return True
    if lower_line.startswith("стр. "):
        return True
    if lower_line in {"виды работ:", "материалы:"}:
        return True
    if normalized_line == "№ Наименование работ, услуг Кол-во Ед. Цена Сумма":
        return True
    if re.fullmatch(r"[0-9a-f-]{16,}", lower_line):
        return True
    return False


def is_gruzovye_rezervy_total_line(line: str) -> bool:
    return bool(re.fullmatch(r"\d[\d\s]*(?:[.,]\d{2})\s*руб\.?", normalize_line(line), re.IGNORECASE))


def extract_gruzovye_rezervy_row_buffers(
    text: str,
    *,
    marker_pattern: str,
    stop_patterns: tuple[str, ...],
    max_chars: int = 25000,
) -> list[str]:
    fragment = extract_fragment_after_marker(
        text,
        marker_pattern,
        stop_patterns=stop_patterns,
        max_chars=max_chars,
    )
    if not fragment:
        return []

    lines = [normalize_line(line) for line in fragment.splitlines() if normalize_line(line)]
    buffers: list[str] = []
    current_buffer: list[str] = []

    for line in lines:
        if is_gruzovye_rezervy_noise_line(line):
            continue
        if is_gruzovye_rezervy_total_line(line):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
                current_buffer = []
            continue
        if current_buffer and GRUZOVYE_REZERVY_ROW_TAIL_PATTERN.match(line):
            current_buffer.append(line)
            continue
        if GRUZOVYE_REZERVY_ROW_START_PATTERN.match(line):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
            current_buffer = [line]
            continue
        if current_buffer:
            current_buffer.append(line)

    if current_buffer:
        buffers.append(normalize_line(" ".join(current_buffer)))
    return buffers


def split_gruzovye_rezervy_part_body(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_line(value)
    parts = normalized_value.split(maxsplit=1)
    if len(parts) == 2 and ARTICLE_TOKEN_PATTERN.fullmatch(parts[0]) and any(char.isdigit() for char in parts[0]):
        return normalize_article_value(parts[0]), parts[1]
    return None, normalized_value


def parse_gruzovye_rezervy_row(line: str, *, item_kind: str) -> Optional[dict[str, object]]:
    match = GRUZOVYE_REZERVY_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    unit_name = normalize_unit_name(match.group("unit"))
    price = parse_amount(match.group("price"))
    net_total = parse_amount(match.group("net"))
    if quantity is None or unit_name is None or price is None or net_total is None:
        return None

    body_value = normalize_line(match.group("body"))
    if item_kind == "works":
        return {
            "work_code": None,
            "work_name": body_value[:500],
            "quantity": quantity,
            "unit_name": unit_name,
            "price": price,
            "line_total": net_total,
        }

    article, part_name = split_gruzovye_rezervy_part_body(body_value)
    if not part_name:
        return None
    return {
        "article": article,
        "part_name": part_name[:500],
        "quantity": quantity,
        "unit_name": unit_name,
        "price": price,
        "line_total": net_total,
    }


def extract_gruzovye_rezervy_items(text: str) -> dict[str, list[dict[str, object]]]:
    work_rows = extract_gruzovye_rezervy_row_buffers(
        text,
        marker_pattern=r"Виды\s+Работ:",
        stop_patterns=(r"Материалы:",),
    )
    part_rows = extract_gruzovye_rezervy_row_buffers(
        text,
        marker_pattern=r"Материалы:",
        stop_patterns=(r"Итого:",),
    )

    works = [payload for payload in (parse_gruzovye_rezervy_row(line, item_kind="works") for line in work_rows) if payload]
    parts = [payload for payload in (parse_gruzovye_rezervy_row(line, item_kind="parts") for line in part_rows) if payload]
    return {"works": works, "parts": parts}
