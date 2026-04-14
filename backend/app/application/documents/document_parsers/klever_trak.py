from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import KLEVER_TRAK_ROW_START_PATTERN
from app.application.documents.config import ARTICLE_TOKEN_PATTERN
from app.application.documents.parser_helpers import (
    normalize_article_value,
    normalize_unit_name,
    split_work_code_and_name,
)
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_klever_trak_noise_line(line: str) -> bool:
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
    if lower_line.startswith("итого по заказ-наряду"):
        return True
    if lower_line.startswith("всего по заказ-наряду:"):
        return True
    if lower_line.startswith("рекомендации:"):
        return True
    if lower_line.startswith("страница:"):
        return True
    if normalized_line in {
        "№ Артикул Наименование Кол. оп. Цена н/ч Норма н/ч Всего в т.ч. НДС",
        "№ Артикул Наименование Кол-во Ед.изм. Цена Всего в т.ч. НДС",
        "1 2 3 4 5 6 7 8 9",
        "1 2 3 4 5 6 7 8",
    }:
        return True
    return False


def split_klever_trak_work_body(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_line(value)
    tokens = normalized_value.split()
    if len(tokens) >= 3 and ARTICLE_TOKEN_PATTERN.fullmatch(tokens[0]) and re.fullmatch(r"\d{4,}", tokens[1]):
        article = normalize_article_value(tokens[0] + tokens[1])
        name = normalize_line(" ".join(tokens[2:]))
        if name:
            return article, name
    return split_work_code_and_name(normalized_value)


def split_klever_trak_part_body(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_line(value)
    tokens = normalized_value.split()
    if len(tokens) >= 3 and ARTICLE_TOKEN_PATTERN.fullmatch(tokens[0]) and re.fullmatch(r"\d{4,}", tokens[1]):
        article = normalize_article_value(tokens[0] + tokens[1])
        name = normalize_line(" ".join(tokens[2:]))
        if name:
            return article, name
    if len(tokens) >= 2 and ARTICLE_TOKEN_PATTERN.fullmatch(tokens[0]) and any(char.isdigit() for char in tokens[0]):
        article = normalize_article_value(tokens[0])
        name = normalize_line(" ".join(tokens[1:]))
        if name:
            return article, name
    return None, normalized_value


def extract_klever_trak_row_buffers(
    text: str,
    *,
    marker_pattern: str,
    stop_patterns: tuple[str, ...],
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
    return [
        line
        for line in lines
        if KLEVER_TRAK_ROW_START_PATTERN.match(line) and not is_klever_trak_noise_line(line)
    ]


def parse_klever_trak_work_row(line: str) -> Optional[dict[str, object]]:
    normalized_line = normalize_line(line)
    tokens = normalized_line.split()
    if len(tokens) < 8 or not tokens[0].isdigit():
        return None

    quantity = parse_decimal_value(tokens[-6])
    price = parse_amount(tokens[-5])
    standard_hours = parse_decimal_value(tokens[-4])
    unit_name = normalize_unit_name(tokens[-3])
    line_total = parse_amount(tokens[-2])
    vat_total = parse_amount(tokens[-1])
    if quantity is None or price is None or standard_hours is None or line_total is None or vat_total is None:
        return None

    work_code, work_name = split_klever_trak_work_body(" ".join(tokens[1:-6]))
    if not work_name:
        return None

    return {
        "work_code": normalize_article_value(work_code),
        "work_name": work_name[:500],
        "quantity": quantity,
        "unit_name": unit_name,
        "price": price,
        "line_total": line_total,
        "standard_hours": standard_hours,
    }


def parse_klever_trak_part_row(line: str) -> Optional[dict[str, object]]:
    normalized_line = normalize_line(line)
    tokens = normalized_line.split()
    if len(tokens) < 7 or not tokens[0].isdigit():
        return None

    quantity = parse_decimal_value(tokens[-5])
    unit_name = normalize_unit_name(tokens[-4])
    price = parse_amount(tokens[-3])
    line_total = parse_amount(tokens[-2])
    vat_total = parse_amount(tokens[-1])
    if quantity is None or unit_name is None or price is None or line_total is None or vat_total is None:
        return None

    article, part_name = split_klever_trak_part_body(" ".join(tokens[1:-5]))
    if not part_name:
        return None

    return {
        "article": article,
        "part_name": part_name[:500],
        "quantity": quantity,
        "unit_name": unit_name,
        "price": price,
        "line_total": line_total,
    }


def extract_klever_trak_items(text: str) -> dict[str, list[dict[str, object]]]:
    work_rows = extract_klever_trak_row_buffers(
        text,
        marker_pattern=r"Выполненные\s+работы\s+по\s+заказ[- ]наряду",
        stop_patterns=(r"Итого\s+работ:",),
    )
    part_rows = extract_klever_trak_row_buffers(
        text,
        marker_pattern=r"Расходная\s+накладная\s+к\s+заказ[- ]наряду",
        stop_patterns=(r"Итого\s+материал", r"Итого\s+по\s+заказ[- ]наряду"),
        max_chars=40000,
    )
    works = [payload for payload in (parse_klever_trak_work_row(line) for line in work_rows) if payload]
    parts = [payload for payload in (parse_klever_trak_part_row(line) for line in part_rows) if payload]
    return {"works": works, "parts": parts}
