from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import (
    LEADER_TRAK_INVOICE_ROW_PATTERN,
    LEADER_TRAK_ROW_PATTERN,
    LEADER_TRAK_ROW_START_PATTERN,
)
from app.application.documents.config import ARTICLE_TOKEN_PATTERN, WORK_CODE_TOKEN_PATTERN
from app.application.documents.field_extractors import is_leader_trak_invoice_only_document
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_leader_trak_noise_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    lower_line = normalized_line.lower()
    if not normalized_line:
        return True
    if lower_line.startswith("страница "):
        return True
    if lower_line.startswith("стр. "):
        return True
    if lower_line.startswith("передан через диадок"):
        return True
    if lower_line.startswith("сервисные услуги сдал"):
        return True
    if lower_line.startswith("сервисные услуги принял"):
        return True
    if lower_line.startswith("после подписания"):
        return True
    if re.fullmatch(r"[0-9a-f-]{16,}", lower_line):
        return True
    if normalized_line in {"№ Номер", "операции или", "запчасти", "Наименование работ,", "запчастей и материалов"}:
        return True
    if lower_line in {
        "кол-во ед.",
        "измер.",
        "цена за",
        "единицу",
        "сумма",
        "скидки",
        "стоимость",
        "без налога",
        "сумма налога",
        "стоимость с налогом *",
    }:
        return True
    return False


def is_leader_trak_tail_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    return bool(
        re.match(
            r"^\d+(?:[.,]\d+)?\s+(?:н/ч|шт|г|гр|мл|литр|л|кг|м)\b",
            normalized_line,
            re.IGNORECASE,
        )
    )


def split_leader_trak_body(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_line(value)
    normalized_value = re.sub(r"(?<=[A-Za-zА-Я0-9/-])(?=[А-Я][а-я])", " ", normalized_value, count=1)
    normalized_value = re.sub(r"(?<=[A-Za-zА-Я0-9/-])(?=[A-Z][a-z])", " ", normalized_value, count=1)
    parts = normalized_value.split(maxsplit=1)
    if len(parts) == 2 and (ARTICLE_TOKEN_PATTERN.fullmatch(parts[0]) or WORK_CODE_TOKEN_PATTERN.fullmatch(parts[0])):
        return normalize_article_value(parts[0]), parts[1]
    return None, normalized_value


def extract_leader_trak_row_buffers(text: str) -> list[str]:
    fragment = extract_fragment_after_marker(
        text,
        r"Выполненные\s+сервисные\s+услуги\s+и\s+использованные\s+материалы",
        stop_patterns=(r"Всего\s+по\s+наряд[- ]заказу", r"После\s+подписания", r"Рекомендации:"),
        max_chars=25000,
    )
    if not fragment:
        return []

    lines = [normalize_line(line) for line in fragment.splitlines() if normalize_line(line)]
    buffers: list[str] = []
    current_buffer: list[str] = []

    for line in lines:
        lower_line = line.lower()
        if is_leader_trak_noise_line(line):
            continue
        if lower_line.startswith("всего по странице:"):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
                current_buffer = []
            continue
        if lower_line.startswith("всего по наряд-заказу"):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
            break
        if current_buffer and is_leader_trak_tail_line(line):
            current_buffer.append(line)
            continue
        if LEADER_TRAK_ROW_START_PATTERN.match(line):
            if current_buffer:
                buffers.append(normalize_line(" ".join(current_buffer)))
            current_buffer = [line]
            continue
        if current_buffer:
            current_buffer.append(line)

    if current_buffer:
        buffers.append(normalize_line(" ".join(current_buffer)))
    return buffers


def extract_leader_trak_invoice_fragment(text: str) -> str:
    fragment = extract_fragment_after_marker(
        text,
        r"№\s*Товар\s+Артикул\s+Кол-во\s+Ед\.\s+Цена\s+Скидка\s+НДС\s+Всего",
        stop_patterns=(r"Итого\s+RUB:", r"Всего\s+наименований", r"Сумма\s+прописью"),
        max_chars=25000,
    )
    if fragment:
        return fragment
    return ""


def parse_leader_trak_row(line: str) -> Optional[tuple[str, dict[str, object]]]:
    match = LEADER_TRAK_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    unit_name = normalize_unit_name(match.group("unit"))
    price = parse_amount(match.group("price"))
    net_total = parse_amount(match.group("net"))
    if quantity is None or unit_name is None or price is None or net_total is None:
        return None

    code_value, name_value = split_leader_trak_body(match.group("body"))
    if not name_value:
        return None

    if unit_name == "нч":
        return (
            "works",
            {
                "work_code": normalize_article_value(code_value),
                "work_name": name_value[:500],
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
            "article": normalize_article_value(code_value),
            "part_name": name_value[:500],
            "quantity": quantity,
            "unit_name": unit_name,
            "price": price,
            "line_total": net_total,
        },
    )


def parse_leader_trak_invoice_row(fragment: str) -> Optional[tuple[str, dict[str, object]]]:
    match = LEADER_TRAK_INVOICE_ROW_PATTERN.match(fragment)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    unit_name = normalize_unit_name(match.group("unit"))
    price = parse_amount(match.group("price"))
    vat_total = parse_amount(match.group("vat"))
    gross_total = parse_amount(match.group("total"))
    if quantity is None or unit_name is None or price is None or vat_total is None or gross_total is None:
        return None

    net_total = round(gross_total - vat_total, 2)
    if net_total <= 0:
        return None

    code_value, name_value = split_leader_trak_body(match.group("body"))
    if not name_value:
        return None

    if unit_name == "нч":
        return (
            "works",
            {
                "work_code": normalize_article_value(code_value),
                "work_name": name_value[:500],
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
            "article": normalize_article_value(code_value),
            "part_name": name_value[:500],
            "quantity": quantity,
            "unit_name": unit_name,
            "price": price,
            "line_total": net_total,
        },
    )


def extract_leader_trak_invoice_items(text: str) -> dict[str, list[dict[str, object]]]:
    fragment = normalize_line(extract_leader_trak_invoice_fragment(text))
    if not fragment:
        return {"works": [], "parts": []}

    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    for match in LEADER_TRAK_INVOICE_ROW_PATTERN.finditer(fragment):
        parsed_row = parse_leader_trak_invoice_row(match.group(0))
        if parsed_row is None:
            continue
        item_kind, payload = parsed_row
        if item_kind == "works":
            works.append(payload)
        else:
            parts.append(payload)

    if len(works) + len(parts) < 2:
        return {"works": [], "parts": []}
    return {"works": works, "parts": parts}


def extract_leader_trak_items(text: str) -> dict[str, list[dict[str, object]]]:
    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    for buffer in extract_leader_trak_row_buffers(text):
        parsed_row = parse_leader_trak_row(buffer)
        if parsed_row is None:
            continue
        item_kind, payload = parsed_row
        if item_kind == "works":
            works.append(payload)
        else:
            parts.append(payload)
    service_items = {"works": works, "parts": parts}
    invoice_items = extract_leader_trak_invoice_items(text)
    if is_leader_trak_invoice_only_document(text) and (invoice_items["works"] or invoice_items["parts"]):
        return invoice_items
    return service_items
