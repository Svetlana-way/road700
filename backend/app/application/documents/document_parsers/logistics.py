from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import (
    LOGISTICS_PART_ROW_PATTERN,
    LOGISTICS_PART_TAIL_PATTERN,
    LOGISTICS_ROW_START_PATTERN,
    LOGISTICS_WORK_ROW_PATTERN,
    LOGISTICS_WORK_TAIL_PATTERN,
)
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_logistics_noise_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    lower_line = normalized_line.lower()
    if not normalized_line:
        return True
    if lower_line.startswith("выполненные работы по заказ-наряду"):
        return True
    if lower_line.startswith("расходная накладная к заказ-наряду"):
        return True
    if lower_line.startswith("итого работ:"):
        return True
    if lower_line.startswith("итого материалов:"):
        return True
    if lower_line.startswith("итого по странице материалов:"):
        return True
    if lower_line.startswith("итого по причине обращения:"):
        return True
    if lower_line.startswith("итого по заказ-наряду"):
        return True
    if lower_line.startswith("всего по причине обращения:"):
        return True
    if lower_line.startswith("всего по заказ-наряду:"):
        return True
    if lower_line.startswith("рекомендации:"):
        return True
    if normalized_line in {
        "№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Ставка НДС Всего в т.ч. НДС",
        "№ Артикул Наименование Кол-во Ед.изм. Цена Ставка НДС Всего в т.ч. НДС",
        "1 2 3 4 5 6 7 8 9",
        "1 2 3 4 5 6 7 8 9 10",
    }:
        return True
    if re.fullmatch(r"[0-9a-f-]{16,}", lower_line):
        return True
    if re.fullmatch(r"страница:\s*\d+", lower_line):
        return True
    return False


def split_logistics_part_body(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_line(value)
    tokens = normalized_value.split()
    if len(tokens) < 2:
        return None, normalized_value

    article_tokens: list[str] = []
    for token in tokens:
        if re.search(r"[А-Яа-я]", token):
            break
        article_tokens.append(token)

    if not article_tokens:
        return None, normalized_value

    part_name = normalize_line(" ".join(tokens[len(article_tokens) :]))
    article = normalize_article_value("".join(article_tokens))
    if not part_name:
        return None, normalized_value
    return article, part_name


def extract_logistics_row_buffers(
    text: str,
    *,
    marker_pattern: str,
    stop_patterns: tuple[str, ...],
    tail_pattern,
    max_chars: int = 30000,
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
        if is_logistics_noise_line(line):
            continue
        if current_buffer and tail_pattern.match(line):
            current_buffer.append(line)
            buffers.append(normalize_line(" ".join(current_buffer)))
            current_buffer = []
            continue
        if LOGISTICS_ROW_START_PATTERN.match(line):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
            current_buffer = [line]
            continue
        if current_buffer:
            current_buffer.append(line)

    if current_buffer:
        buffers.append(normalize_line(" ".join(current_buffer)))
    return buffers


def parse_logistics_work_row(line: str) -> Optional[dict[str, object]]:
    match = LOGISTICS_WORK_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    standard_hours = parse_decimal_value(match.group("norm"))
    line_total = parse_amount(match.group("gross"))
    work_name = normalize_line(match.group("body"))
    if quantity is None or price is None or standard_hours is None or line_total is None or not work_name:
        return None

    return {
        "work_code": None,
        "work_name": work_name[:500],
        "quantity": quantity,
        "unit_name": None,
        "price": price,
        "line_total": line_total,
        "standard_hours": standard_hours,
    }


def parse_logistics_part_row(line: str) -> Optional[dict[str, object]]:
    match = LOGISTICS_PART_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    line_total = parse_amount(match.group("gross"))
    if quantity is None or price is None or line_total is None:
        return None

    article, part_name = split_logistics_part_body(match.group("body"))
    if not part_name:
        return None

    return {
        "article": article,
        "part_name": part_name[:500],
        "quantity": quantity,
        "unit_name": normalize_unit_name(match.group("unit")),
        "price": price,
        "line_total": line_total,
    }


def extract_logistics_items(text: str) -> dict[str, list[dict[str, object]]]:
    work_rows = extract_logistics_row_buffers(
        text,
        marker_pattern=r"Выполненные\s+работы\s+по\s+заказ[- ]наряду",
        stop_patterns=(r"Итого\s+работ:",),
        tail_pattern=LOGISTICS_WORK_TAIL_PATTERN,
    )
    part_rows = extract_logistics_row_buffers(
        text,
        marker_pattern=r"Расходная\s+накладная\s+к\s+заказ[- ]наряду",
        stop_patterns=(r"Итого\s+материал", r"Итого\s+по\s+причине\s+обращения"),
        tail_pattern=LOGISTICS_PART_TAIL_PATTERN,
        max_chars=40000,
    )

    works = [payload for payload in (parse_logistics_work_row(line) for line in work_rows) if payload]
    parts = [payload for payload in (parse_logistics_part_row(line) for line in part_rows) if payload]
    return {"works": works, "parts": parts}
