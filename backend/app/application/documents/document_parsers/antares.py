from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import (
    ANTARES_AMOUNT_CONTINUATION_PATTERN,
    ANTARES_PART_ROW_PATTERN,
    ANTARES_PART_TAIL_PATTERN,
    ANTARES_ROW_START_PATTERN,
    ANTARES_WORK_ROW_PATTERN,
    ANTARES_WORK_TAIL_PATTERN,
)
from app.application.documents.config import ARTICLE_TOKEN_PATTERN, WORK_CODE_TOKEN_PATTERN
from app.application.documents.parser_helpers import (
    normalize_article_value,
    normalize_unit_name,
    split_work_code_and_name,
)
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_antares_noise_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    lower_line = normalized_line.lower()
    if not normalized_line:
        return True
    if lower_line.startswith("передан через диадок"):
        return True
    if lower_line.startswith("страница "):
        return True
    if lower_line.startswith("заказ-наряд №"):
        return True
    if lower_line.startswith("выполненные работы по заказ-наряду"):
        return True
    if lower_line.startswith("расходная накладная к заказ-наряду"):
        return True
    if lower_line.startswith("№ артикул"):
        return True
    if lower_line in {"1 2 3 4 5 6 7 8 9", "1 2 3 4 5 6 7 8 9 10"}:
        return True
    if lower_line.startswith("принят:"):
        return True
    if lower_line.startswith("вид ремонта:"):
        return True
    if lower_line.startswith("диспетчер:"):
        return True
    if lower_line.startswith("мастер:"):
        return True
    if lower_line.startswith("срок исполнения:"):
        return True
    if lower_line == "закрыт":
        return True
    if re.fullmatch(r"[0-9a-f-]{16,}", lower_line):
        return True
    return False


def repair_antares_numeric_splits(value: str) -> str:
    normalized_value = normalize_line(value)
    previous_value = None
    while previous_value != normalized_value:
        previous_value = normalized_value
        normalized_value = re.sub(
            r"(\d[\d\s]*,\d)\s+(\d)(?=\s+\d[\d\s]*(?:[.,]\d{2})\b)",
            r"\1\2",
            normalized_value,
        )
    return normalized_value


def extract_antares_row_buffers(
    text: str,
    *,
    marker_pattern: str,
    stop_patterns: tuple[str, ...],
    tail_pattern,
    final_total_prefix: str,
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
        lower_line = line.lower()
        if is_antares_noise_line(line):
            continue
        if lower_line.startswith(final_total_prefix):
            if current_buffer:
                buffers.append(repair_antares_numeric_splits(" ".join(current_buffer)))
                current_buffer = []
            break
        if lower_line.startswith("итого по странице"):
            if current_buffer:
                buffers.append(repair_antares_numeric_splits(" ".join(current_buffer)))
                current_buffer = []
            continue
        if current_buffer and (tail_pattern.match(line) or ANTARES_AMOUNT_CONTINUATION_PATTERN.match(line)):
            current_buffer.append(line)
            continue
        if ANTARES_ROW_START_PATTERN.match(line):
            if current_buffer:
                buffers.append(repair_antares_numeric_splits(" ".join(current_buffer)))
            current_buffer = [line]
            continue
        if current_buffer:
            current_buffer.append(line)

    if current_buffer:
        buffers.append(repair_antares_numeric_splits(" ".join(current_buffer)))
    return buffers


def split_antares_part_body(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_line(value)
    tokens = normalized_value.split()
    if not tokens:
        return None, ""

    first_token = tokens[0]
    if not (ARTICLE_TOKEN_PATTERN.fullmatch(first_token) or WORK_CODE_TOKEN_PATTERN.fullmatch(first_token)):
        return None, normalized_value

    article_tokens = [first_token]
    index = 1
    while index < len(tokens):
        token = tokens[index]
        if token.startswith("("):
            break
        if token.isdigit() and len(token) <= 3:
            article_tokens.append(token)
            index += 1
            continue
        if re.fullmatch(r"[A-Z0-9_/-]{1,4}", token):
            article_tokens.append(token)
            index += 1
            continue
        break

    article = normalize_article_value("".join(article_tokens))
    part_name = normalize_line(" ".join(tokens[index:]))
    return article, part_name


def parse_antares_work_row(line: str) -> Optional[dict[str, object]]:
    match = ANTARES_WORK_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    standard_hours = parse_decimal_value(match.group("norm"))
    net_total = parse_amount(match.group("net"))
    if quantity is None or price is None or standard_hours is None or net_total is None:
        return None

    work_code, work_name = split_work_code_and_name(match.group("body"))
    if not work_name:
        return None

    return {
        "work_code": normalize_article_value(work_code),
        "work_name": normalize_line(work_name)[:500],
        "quantity": quantity,
        "unit_name": None,
        "price": price,
        "line_total": net_total,
        "standard_hours": standard_hours,
    }


def parse_antares_part_row(line: str) -> Optional[dict[str, object]]:
    match = ANTARES_PART_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    unit_name = normalize_unit_name(match.group("unit"))
    price = parse_amount(match.group("price"))
    net_total = parse_amount(match.group("net"))
    if quantity is None or unit_name is None or price is None or net_total is None:
        return None

    article, part_name = split_antares_part_body(match.group("body"))
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


def extract_antares_items(text: str) -> dict[str, list[dict[str, object]]]:
    work_rows = extract_antares_row_buffers(
        text,
        marker_pattern=r"Выполненные\s+работы\s+по\s+заказ[- ]наряду",
        stop_patterns=(r"Итого\s+работ:",),
        tail_pattern=ANTARES_WORK_TAIL_PATTERN,
        final_total_prefix="итого работ:",
    )
    part_rows = extract_antares_row_buffers(
        text,
        marker_pattern=r"Расходная\s+накладная\s+к\s+заказ[- ]наряду",
        stop_patterns=(r"Итого\s+материал",),
        tail_pattern=ANTARES_PART_TAIL_PATTERN,
        final_total_prefix="итого материалов:",
    )

    works = [payload for payload in (parse_antares_work_row(line) for line in work_rows) if payload]
    parts = [payload for payload in (parse_antares_part_row(line) for line in part_rows) if payload]
    return {"works": works, "parts": parts}
