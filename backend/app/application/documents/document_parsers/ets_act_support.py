from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_patterns import ETS_ACT_PART_ROW_PATTERN, ETS_ACT_WORK_ROW_PATTERN
from app.application.documents.field_extractors import extract_ets_act_late_fragment
from app.application.documents.parser_helpers import amounts_match
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name
from app.application.documents.text_fragments import extract_fragment_after_marker
from app.application.documents.runtime_text import normalize_text
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def is_ets_act_work_code_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    return bool(
        re.fullmatch(r"[A-Za-zА-Яа-я0-9.-]{5,}", normalized_line)
        and "-" in normalized_line
        and any(char.isdigit() for char in normalized_line)
    )


def is_ets_act_sparse_work_noise_line(line: str) -> bool:
    normalized_line = normalize_line(line)
    lower_line = normalized_line.lower()
    if not normalized_line:
        return True
    if lower_line in {"n", "артикул", "наименование", "кол. оп.", "цена", "н/ч", "норма"}:
        return True
    if lower_line.startswith("итого работ"):
        return True
    if re.fullmatch(r"\d+", normalized_line):
        return True
    if parse_amount(normalized_line) is not None:
        return True
    if re.search(r"\bруб(?:\.|ля|лей)?\b", lower_line):
        return True
    return False


def parse_ets_act_sparse_summary_amount(line: str) -> Optional[float]:
    normalized_line = normalize_line(line)
    if not normalized_line:
        return None
    if re.fullmatch(r"\d{1,2}", normalized_line):
        return None
    if normalized_line in {"T", "НДС"}:
        return None
    return parse_amount(normalized_line)


def extract_ets_act_sparse_summary_blocks(fragment: str) -> list[dict[str, list[float]]]:
    lines = [normalize_line(line) for line in fragment.splitlines() if normalize_line(line)]
    blocks: list[dict[str, list[float]]] = []
    index = 0

    while index < len(lines):
        if lines[index].lower() != "сумма":
            index += 1
            continue

        index += 1
        net_values: list[float] = []
        while index < len(lines) and not lines[index].lower().startswith("сумма ндс"):
            amount_value = parse_ets_act_sparse_summary_amount(lines[index])
            if amount_value is not None:
                net_values.append(amount_value)
            index += 1

        if index >= len(lines):
            break

        index += 1
        vat_values: list[float] = []
        while index < len(lines) and not lines[index].lower().startswith("сумма с учетом"):
            amount_value = parse_ets_act_sparse_summary_amount(lines[index])
            if amount_value is not None:
                vat_values.append(amount_value)
            index += 1

        if index >= len(lines):
            break

        index += 1
        total_values: list[float] = []
        while index < len(lines) and lines[index].lower() != "сумма" and not lines[index].lower().startswith("итого по акту"):
            amount_value = parse_ets_act_sparse_summary_amount(lines[index])
            if amount_value is not None:
                total_values.append(amount_value)
            index += 1

        if net_values and vat_values and total_values:
            blocks.append(
                {
                    "net_values": net_values,
                    "vat_values": vat_values,
                    "total_values": total_values,
                }
            )

    return blocks


def extract_ets_act_sparse_work_layout(fragment: str) -> list[tuple[str, str]]:
    lines = [normalize_line(line) for line in fragment.splitlines() if normalize_line(line)]
    start_index = next(
        (index for index, line in enumerate(lines) if line.lower().startswith("выполненные работы по акту выполненных работ")),
        None,
    )
    end_index = next((index for index, line in enumerate(lines) if line.lower().startswith("итого работ")), None)
    if start_index is None or end_index is None or end_index <= start_index:
        return []

    section_lines = lines[start_index + 1 : end_index]
    first_code_index = next((index for index, line in enumerate(section_lines) if is_ets_act_work_code_line(line)), None)
    if first_code_index is None:
        return []
    section_lines = section_lines[first_code_index:]

    layout: list[tuple[str, str]] = []
    index = 0
    while index < len(section_lines):
        if not is_ets_act_work_code_line(section_lines[index]):
            index += 1
            continue

        run_start = index
        while index < len(section_lines) and is_ets_act_work_code_line(section_lines[index]):
            index += 1
        code_run = section_lines[run_start:index]

        name_lines: list[str] = []
        while index < len(section_lines) and not is_ets_act_work_code_line(section_lines[index]):
            candidate_line = section_lines[index]
            if not is_ets_act_sparse_work_noise_line(candidate_line):
                name_lines.append(candidate_line)
            index += 1

        if len(code_run) > 1:
            for code_index, code_value in enumerate(code_run):
                if code_index < len(code_run) - 1 and code_index < len(name_lines):
                    name_value = name_lines[code_index]
                else:
                    tail_lines = name_lines[len(code_run) - 1 :] if len(name_lines) >= len(code_run) - 1 else []
                    name_value = normalize_line(" ".join(tail_lines))
                if name_value:
                    layout.append((normalize_article_value(code_value) or code_value, name_value))
            continue

        name_value = normalize_line(" ".join(name_lines))
        if name_value:
            layout.append((normalize_article_value(code_run[0]) or code_run[0], name_value))

    return layout


def extract_ets_act_sparse_work_norms(fragment: str) -> list[float]:
    lines = [normalize_line(line) for line in fragment.splitlines() if normalize_line(line)]
    start_index = next((index for index, line in enumerate(lines) if line.lower().startswith("итого работ")), None)
    end_index = next((index for index, line in enumerate(lines) if line.lower().startswith("расходная накладная")), None)
    if start_index is None or end_index is None or end_index <= start_index:
        return []

    norms: list[float] = []
    for line in lines[start_index + 1 : end_index]:
        if not re.fullmatch(r"\d+(?:[.,]\d+)?", line) or not re.search(r"[.,]", line):
            continue
        norm_value = parse_decimal_value(line)
        if norm_value is not None:
            norms.append(norm_value)
    return norms


def extract_ets_act_sparse_scanned_work_items(text: str) -> list[dict[str, object]]:
    fragment = extract_ets_act_late_fragment(text)
    if not fragment:
        return []

    layout = extract_ets_act_sparse_work_layout(fragment)
    summary_blocks = extract_ets_act_sparse_summary_blocks(fragment)
    if not layout or not summary_blocks:
        return []

    work_block = next(
        (
            block
            for block in summary_blocks
            if len(block["net_values"]) >= len(layout)
            and len(block["vat_values"]) >= len(layout)
            and len(block["total_values"]) >= len(layout)
        ),
        None,
    )
    if work_block is None:
        return []

    net_values = work_block["net_values"][:-1] if len(work_block["net_values"]) == len(layout) + 1 else work_block["net_values"]
    total_values = work_block["total_values"][:-1] if len(work_block["total_values"]) == len(layout) + 1 else work_block["total_values"]
    norms = extract_ets_act_sparse_work_norms(fragment)
    if len(norms) == len(layout) + 1:
        norms = norms[:-1]

    item_count = min(len(layout), len(net_values), len(total_values), len(norms) if norms else len(layout))
    if item_count <= 0:
        return []

    works: list[dict[str, object]] = []
    for index in range(item_count):
        work_code, work_name = layout[index]
        standard_hours = norms[index] if index < len(norms) else None
        net_total = net_values[index]
        price = round(net_total / standard_hours, 2) if standard_hours and standard_hours > 0 else net_total
        works.append(
            {
                "work_code": normalize_article_value(work_code),
                "work_name": work_name[:500],
                "quantity": 1.0,
                "unit_name": None,
                "price": price,
                "line_total": net_total,
                "standard_hours": standard_hours,
            }
        )

    return works


def extract_ets_act_sparse_scanned_totals(text: str) -> dict[str, float]:
    fragment = extract_ets_act_late_fragment(text)
    if not fragment:
        return {}

    summary_blocks = extract_ets_act_sparse_summary_blocks(fragment)
    if len(summary_blocks) < 3:
        return {}

    item_blocks = [
        block
        for block in summary_blocks
        if len(block["net_values"]) >= 2 and len(block["vat_values"]) >= 2 and len(block["total_values"]) >= 2
    ]
    overall_block = summary_blocks[-1]
    if len(item_blocks) < 2 or not overall_block["net_values"] or not overall_block["vat_values"] or not overall_block["total_values"]:
        return {}

    work_total = item_blocks[0]["net_values"][-1]
    parts_total = item_blocks[1]["net_values"][-1]
    overall_net_total = overall_block["net_values"][-1]
    vat_total = overall_block["vat_values"][-1]
    grand_total = overall_block["total_values"][-1]

    if not amounts_match(round(work_total + parts_total, 2), overall_net_total, tolerance=0.5):
        return {}
    if not amounts_match(round(overall_net_total + vat_total, 2), grand_total, tolerance=0.5):
        return {}

    return {
        "work_total": work_total,
        "parts_total": parts_total,
        "vat_total": vat_total,
        "grand_total": grand_total,
    }


def extract_ets_act_section_rows(
    text: str,
    *,
    marker_pattern: str,
    stop_patterns: tuple[str, ...],
    max_chars: int = 8000,
) -> list[str]:
    fragment = extract_fragment_after_marker(
        text,
        marker_pattern,
        stop_patterns=stop_patterns,
        max_chars=max_chars,
    )
    if not fragment:
        return []

    section_text = normalize_text(fragment.replace("\n", " ").replace("\r", " "))
    section_text = re.sub(r".*?1 2 3 4 5 6 7 8 9\s*", "", section_text, count=1)
    section_text = re.sub(
        r"(?<=\d[.,]\d{2})\s+(?=\d{1,2}\s+[A-Za-zА-Яа-я0-9.-]{1,}\s)",
        "\n",
        section_text,
    )
    section_text = re.sub(
        r"(?<=\d[.,]\d{2})(?=\d{1,2}\s+[A-Za-zА-Яа-я0-9.-]{1,}\s)",
        "\n",
        section_text,
    )
    return [normalize_line(line) for line in section_text.splitlines() if normalize_line(line)]


def parse_ets_act_work_row(line: str) -> Optional[dict[str, object]]:
    match = ETS_ACT_WORK_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    standard_hours = parse_decimal_value(match.group("norm"))
    net_total = parse_amount(match.group("net"))
    if quantity is None or price is None or standard_hours is None or net_total is None:
        return None

    return {
        "work_code": normalize_article_value(match.group("code")),
        "work_name": normalize_line(match.group("name"))[:500],
        "quantity": quantity,
        "unit_name": None,
        "price": price,
        "line_total": net_total,
        "standard_hours": standard_hours,
    }


def parse_ets_act_part_row(line: str) -> Optional[dict[str, object]]:
    match = ETS_ACT_PART_ROW_PATTERN.match(line)
    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    net_total = parse_amount(match.group("net"))
    if quantity is None or price is None or net_total is None:
        return None

    return {
        "article": normalize_article_value(match.group("article")),
        "part_name": normalize_line(match.group("name"))[:500],
        "quantity": quantity,
        "unit_name": normalize_unit_name(match.group("unit")),
        "price": price,
        "line_total": net_total,
    }


def extract_ets_act_items(text: str) -> dict[str, list[dict[str, object]]]:
    work_rows = extract_ets_act_section_rows(
        text,
        marker_pattern=r"Выполненные\s+работы\s+по\s+акту\s+выполненных\s+работ",
        stop_patterns=(r"Итого\s+работ:",),
        max_chars=5000,
    )
    part_rows = extract_ets_act_section_rows(
        text,
        marker_pattern=r"Расходная\s+накладная\s+к\s+акту\s+выполненных\s+работ",
        stop_patterns=(r"Итого\s+материал",),
        max_chars=9000,
    )

    works = [payload for payload in (parse_ets_act_work_row(line) for line in work_rows) if payload]
    parts = [payload for payload in (parse_ets_act_part_row(line) for line in part_rows) if payload]
    if not works:
        works = extract_ets_act_sparse_scanned_work_items(text)
    return {"works": works, "parts": parts}
