from __future__ import annotations

import re
from typing import Optional

from app.application.documents.config import ARTICLE_TOKEN_PATTERN, WORK_CODE_TOKEN_PATTERN
from app.application.documents.document_parsers.axb_helpers import is_axb_invoice_total_marker, parse_axb_quantity_candidate
from app.application.documents.parser_helpers import amounts_match, extract_axb_compact_work_items, normalize_article_value
from app.application.documents.text_fragments import (
    extract_amount_candidates_from_fragment,
    extract_fragment_after_marker,
    extract_largest_amount_from_fragment,
)
from app.application.documents.runtime_text import normalize_text
from app.application.documents.text_utils import normalize_line, parse_amount, parse_decimal_value


def _is_axb_article_candidate(line: str) -> bool:
    from app.application.documents.document_parsers.axb_materials import is_axb_article_candidate

    return is_axb_article_candidate(line)


def axb_name_merge_score(left: str, right: str) -> int:
    left_normalized = normalize_line(left)
    right_normalized = normalize_line(right)
    score = 0

    if re.match(r"^[a-zа-я(]", right_normalized):
        score += 8
    if re.match(r"^\d", right_normalized):
        score += 7
    if len(right_normalized) <= 12:
        score += 3
    if re.match(r"^[A-ZА-Я0-9/-]{2,}$", right_normalized):
        score += 3
    if re.search(r"\b(?:с|в|на|под|для|по|от|до|над|при)\s*$", left_normalized.lower()):
        score += 5
    if left_normalized.endswith(("-", "/", ",")):
        score += 4
    if len(left_normalized) <= 24:
        score += 2
    if left_normalized.endswith((".", "!", "?", ")", '"')):
        score -= 6
    return score


def infer_axb_price(line_total: float, quantity: float) -> Optional[float]:
    if quantity <= 0:
        return None
    price = round(line_total / quantity / 0.95, 2)
    return price if price > 0 else None


def infer_axb_quantity(line_total: float, price: float) -> Optional[float]:
    if price <= 0:
        return None
    quantity = round(line_total / price / 0.95, 2)
    return quantity if quantity > 0 else None


def split_axb_leading_work_code(line: str) -> tuple[Optional[str], str]:
    normalize_line_value = normalize_line
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    work_code_pattern = WORK_CODE_TOKEN_PATTERN
    article_pattern = ARTICLE_TOKEN_PATTERN
    normalized_line_value_result = normalize_line_value(line)
    if not normalized_line_value_result:
        return None, ""

    match = re.fullmatch(
        r"(?P<code>[A-Za-zА-Яа-я0-9/_-]{3,})(?:\s+(?P<name>.+))?",
        normalized_line_value_result,
    )
    if match is None:
        return None, normalized_line_value_result

    code = match.group("code") or ""
    compact_code = code.replace(" ", "")
    if not compact_code or not any(char.isdigit() for char in compact_code):
        return None, normalized_line_value_result
    if re.fullmatch(r"(?:то|to)[-_]?\d+", compact_code, re.IGNORECASE):
        return None, normalized_line_value_result
    if not (work_code_pattern.fullmatch(compact_code) or article_pattern.fullmatch(compact_code)):
        return None, normalized_line_value_result

    return normalize_article(code) or normalize_text_value(code), normalize_line_value(match.group("name") or "")


def is_axb_compact_work_row_start(line: str) -> bool:
    normalized_line_value_result = normalize_line(line)
    if not normalized_line_value_result or is_axb_invoice_total_marker(normalized_line_value_result):
        return False
    if "ремонт" not in normalized_line_value_result.lower():
        return False
    return len(extract_amount_candidates_from_fragment(normalized_line_value_result)) >= 3


def is_axb_compact_work_continuation_line(line: str) -> bool:
    normalized_line_value_result = normalize_line(line)
    if not normalized_line_value_result or is_axb_compact_work_row_start(normalized_line_value_result):
        return False
    if is_axb_invoice_total_marker(normalized_line_value_result):
        return False
    lowered_line = normalized_line_value_result.lower()
    if lowered_line.startswith(("выполненные работы", "итого работ", "расходная накладная")):
        return False
    if parse_amount(normalized_line_value_result) is not None:
        return False
    if parse_axb_quantity_candidate(normalized_line_value_result) is not None:
        return False
    return bool(re.search(r"[A-Za-zА-Яа-я]", normalized_line_value_result))


def extract_axb_compact_work_row(line: str) -> Optional[dict[str, object]]:
    normalize_line_value = normalize_line
    parse_amount_value = parse_amount
    is_row_start = is_axb_compact_work_row_start
    split_leading_work_code_fn = split_axb_leading_work_code
    infer_price_fn = infer_axb_price
    infer_quantity_fn = infer_axb_quantity
    normalized_line_value_result = normalize_line_value(re.sub(r"[\[\]{}_]+", " ", line))
    if not is_row_start(normalized_line_value_result):
        return None

    amount_pattern = r"(?:\d{1,3}(?:\s\d{3})+|\d{1,6})(?:[.,-]\d{2})"
    amount_matches = [
        (match.start(), match.end(), value)
        for match in re.finditer(amount_pattern, normalized_line_value_result)
        if (value := parse_amount_value(match.group(0))) is not None and value > 0
    ]
    if len(amount_matches) < 3:
        return None

    line_total = float(amount_matches[-2][2])
    prefix_end = amount_matches[-3][0]
    prefix_text = normalize_line_value(normalized_line_value_result[:prefix_end].rstrip(" -:;,|"))
    if not prefix_text:
        return None

    prefix_amounts = [
        (match.start(), match.end(), value)
        for match in re.finditer(amount_pattern, prefix_text)
        if (value := parse_amount_value(match.group(0))) is not None and value > 0
    ]
    price_payload = next((payload for payload in reversed(prefix_amounts) if payload[2] >= 100 and payload[2] < 10000), None)
    standard_hours = next((float(payload[2]) for payload in reversed(prefix_amounts) if payload[2] < 20), None)

    name_prefix = prefix_text[: price_payload[0]] if price_payload is not None else prefix_text
    name_prefix = re.sub(r"\b\d+(?:[.,]\d+)?[!;)}|]*\s*$", "", name_prefix).strip(" -:;,|[]()")
    name_prefix = normalize_line_value(name_prefix)
    if not name_prefix:
        return None

    row_stripped_prefix = re.sub(r"^\d{1,2}\s+", "", name_prefix)
    work_code, inline_name = split_leading_work_code_fn(row_stripped_prefix)
    work_name = inline_name if work_code else row_stripped_prefix
    work_name = re.sub(r"^(?:\d+\s+)+", "", work_name)
    work_name = re.sub(r"^[^A-Za-zА-Яа-я0-9]+", "", work_name)
    work_name = normalize_line_value(work_name).strip(" -:;,|[]()")
    if not work_name or not re.search(r"[A-Za-zА-Яа-я]", work_name):
        return None

    price = float(price_payload[2]) if price_payload is not None else None
    if standard_hours is not None and price is None:
        price = infer_price_fn(line_total, standard_hours)
    if standard_hours is None and price is not None:
        standard_hours = infer_quantity_fn(line_total, price)

    return {
        "work_code": work_code,
        "name_lines": [work_name],
        "line_total": line_total,
        "price": float(price) if price is not None else line_total,
        "standard_hours": float(standard_hours) if standard_hours is not None else None,
    }


def extract_axb_work_line_totals_from_summary(
    summary_lines: list[str],
    *,
    expected_work_total: Optional[float] = None,
) -> list[float]:
    candidate_amounts: list[float] = []
    for line in summary_lines:
        normalized_line_value_result = normalize_line(line)
        lowered_line = normalized_line_value_result.lower()
        if not normalized_line_value_result:
            continue
        if any(marker in lowered_line for marker in ("расходная накладная", "итого материалов", "итого по заказ")):
            break
        if re.fullmatch(r"\d+", normalized_line_value_result):
            continue
        candidate_amounts.extend(extract_amount_candidates_from_fragment(normalized_line_value_result))

    if not candidate_amounts:
        return []

    vat_counter: dict[int, int] = {}
    for amount in candidate_amounts:
        amount_key = int(round(amount * 100))
        vat_counter[amount_key] = vat_counter.get(amount_key, 0) + 1

    line_totals: list[float] = []
    for amount in candidate_amounts:
        if expected_work_total is not None and amounts_match(amount, expected_work_total, tolerance=0.01):
            continue
        if amount <= 100:
            continue
        vat_candidate = round(amount / 6, 2)
        vat_key = int(round(vat_candidate * 100))
        if vat_counter.get(vat_key, 0) <= 0:
            continue
        vat_counter[vat_key] -= 1
        line_totals.append(float(amount))

    return line_totals


def extract_axb_expected_work_line_totals_from_summary(
    summary_lines: list[str],
    *,
    expected_work_total: float,
    name_line_hint_count: int,
) -> list[float]:
    normalized_lines: list[str] = []
    candidate_amounts: list[float] = []
    for line in summary_lines:
        normalized_line_value_result = normalize_line(line)
        lowered_line = normalized_line_value_result.lower()
        if not normalized_line_value_result:
            continue
        if any(marker in lowered_line for marker in ("расходная накладная", "итого материалов", "итого по заказ")):
            break
        normalized_lines.append(normalized_line_value_result)
        if re.fullmatch(r"\d+", normalized_line_value_result):
            continue
        candidate_amounts.extend(extract_amount_candidates_from_fragment(normalized_line_value_result))

    if not candidate_amounts:
        return []

    gross_section_amounts: list[float] = []
    gross_section_started = False
    for line in normalized_lines:
        lowered_line = line.lower()
        if "всего" in lowered_line:
            gross_section_started = True
            continue
        if gross_section_started and "ндс" in lowered_line:
            break
        if not gross_section_started:
            continue
        if re.fullmatch(r"\d+", line):
            continue
        gross_section_amounts.extend(extract_amount_candidates_from_fragment(line))

    filtered_candidates = [
        float(amount)
        for amount in (gross_section_amounts or candidate_amounts)
        if amount > 100 and amount <= float(expected_work_total) + 3.0
    ]
    if not filtered_candidates:
        return []

    target_cents = int(round(float(expected_work_total) * 100))
    tolerance_cents = 300
    subset_candidates = [
        amount
        for amount in filtered_candidates
        if not amounts_match(amount, float(expected_work_total), tolerance=0.2)
    ]
    subset_states: dict[int, list[int]] = {0: []}
    for index, amount in enumerate(subset_candidates):
        amount_cents = int(round(amount * 100))
        if amount_cents <= 0 or amount_cents > target_cents + tolerance_cents:
            continue
        for current_sum, current_indexes in list(subset_states.items()):
            new_sum = current_sum + amount_cents
            if new_sum > target_cents + tolerance_cents:
                continue
            new_indexes = current_indexes + [index]
            existing_indexes = subset_states.get(new_sum)
            if existing_indexes is None or len(new_indexes) > len(existing_indexes):
                subset_states[new_sum] = new_indexes

    best_sum = None
    best_indexes: list[int] | None = None
    for reachable_sum, indexes in subset_states.items():
        if not indexes:
            continue
        if abs(reachable_sum - target_cents) > tolerance_cents:
            continue
        if best_sum is None:
            best_sum = reachable_sum
            best_indexes = indexes
            continue
        current_delta = abs(reachable_sum - target_cents)
        best_delta = abs(best_sum - target_cents)
        if current_delta < best_delta or (current_delta == best_delta and len(indexes) > len(best_indexes or [])):
            best_sum = reachable_sum
            best_indexes = indexes
    if best_indexes:
        return [subset_candidates[index] for index in best_indexes]

    if name_line_hint_count <= 4:
        single_total = next(
            (amount for amount in filtered_candidates if amounts_match(amount, float(expected_work_total), tolerance=0.2)),
            None,
        )
        if single_total is not None:
            return [float(single_total)]

    return []


def clean_axb_work_name(name: str) -> str:
    cleaned = normalize_line(name)
    cleaned = re.sub(r"^скидка\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"[З3з]\s*\d[\d\s]*(?:[.,]\d{2})\s+\d+(?:[.,]\d+)?\s*Рем\w*",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\b[З3з]\s*\d[\d\s]*(?:[.,]\d{2})\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\d+(?:[.,]\d+)?\s*Рем\w*\b", " ", cleaned, flags=re.IGNORECASE)
    return normalize_line(cleaned).strip(" -:;,|[]")


def extract_axb_work_items(text: str, *, expected_work_total: Optional[float] = None) -> list[dict[str, object]]:
    extract_compact_work_items_fn = extract_axb_compact_work_items
    normalize_line_value = normalize_line
    parse_quantity_candidate = parse_axb_quantity_candidate
    parse_standard_hours = parse_axb_standard_hours_candidate
    parse_amount_value = parse_amount
    extract_rate_candidate_fn = extract_axb_rate_candidate
    split_leading_work_code_fn = split_axb_leading_work_code
    is_article_candidate = _is_axb_article_candidate
    extract_fragment = extract_fragment_after_marker
    is_total_marker = is_axb_invoice_total_marker
    extract_largest_amount = extract_largest_amount_from_fragment
    extract_expected_totals = extract_axb_expected_work_line_totals_from_summary
    extract_summary_totals = extract_axb_work_line_totals_from_summary
    clean_work_name_fn = clean_axb_work_name
    merge_name_score = axb_name_merge_score
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    infer_price_fn = infer_axb_price
    infer_quantity_fn = infer_axb_quantity
    work_body_match = re.search(
        r"Выполненные\s+работы\s+(?:по|no|No|ho|но)?\s*заказ[- ]наряду(?P<body>.*?)(?:Итого\s+работ:)",
        text,
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    if work_body_match is None:
        return extract_compact_work_items_fn(text)

    work_body_lines = [normalize_line_value(line) for line in work_body_match.group("body").splitlines() if normalize_line_value(line)]
    filtered_name_lines: list[tuple[int, str]] = []
    for index, line in enumerate(work_body_lines):
        lowered_line = line.lower()
        if "выполненные работы по заказ-наряду" in lowered_line or lowered_line.startswith("обращения "):
            continue
        if "к причине" in lowered_line:
            continue
        if any(marker in lowered_line for marker in ("кол. оп.", "цена н/ч", "норма н/ч")):
            continue
        if any(marker in lowered_line for marker in ("скидк", "всего", "ндс")):
            continue
        if lowered_line in {"n", "№", "артикул", "наименование", "кол. оп.", "цена н/ч", "норма", "н/ч", "скидка", "ремонт"}:
            continue
        if lowered_line.startswith(("nº ", "№ ", "цена н/ч")):
            continue
        if re.fullmatch(r"\d+", line):
            continue
        if parse_quantity_candidate(line) is not None:
            continue
        if re.fullmatch(r"\d+(?:[.,]\d+)?\s*ремонт", lowered_line):
            continue
        if parse_standard_hours(line) is not None:
            continue
        if parse_amount_value(line) is not None:
            continue
        if extract_rate_candidate_fn(line) is not None:
            continue
        compact_row = re.sub(r"^\d{1,2}\s+", "", line)
        _inline_code, inline_name = split_leading_work_code_fn(compact_row)
        normalized_candidate_line = normalize_line_value(inline_name or compact_row)
        if not normalized_candidate_line:
            continue
        if " " not in normalized_candidate_line and is_article_candidate(normalized_candidate_line):
            continue
        filtered_name_lines.append((index, normalized_candidate_line))
    work_totals_fragment = extract_fragment(
        text,
        r"Итого\s+работ:",
        stop_patterns=(r"Расходная\s+накладная", r"Итого\s+материал", r"Итого\s+по\s+заказ[- ]наряду"),
        max_chars=1400,
    )
    if not work_totals_fragment:
        return extract_compact_work_items_fn(text)

    totals_lines = [normalize_line_value(line) for line in work_totals_fragment.splitlines() if normalize_line_value(line)]
    explicit_expected_work_total = expected_work_total
    total_marker_index = -1
    for index, line in enumerate(totals_lines):
        if is_total_marker(line):
            total_marker_index = index
    if total_marker_index < 0 and explicit_expected_work_total is not None:
        total_marker_index = 0
    if total_marker_index < 0:
        return extract_compact_work_items_fn(text)

    expected_work_total = expected_work_total or extract_largest_amount(work_totals_fragment)
    if explicit_expected_work_total is not None:
        line_totals = extract_expected_totals(
            totals_lines[total_marker_index + 1 :],
            expected_work_total=float(expected_work_total),
            name_line_hint_count=len(filtered_name_lines),
        )
    else:
        line_totals = extract_summary_totals(
            totals_lines[total_marker_index + 1 :],
            expected_work_total=expected_work_total,
        )
    if not line_totals:
        if explicit_expected_work_total is not None and 0 < len(filtered_name_lines) <= 4:
            aggregated_work_name = clean_work_name_fn(" ".join(line for _index, line in filtered_name_lines))[:500]
            if aggregated_work_name:
                return [
                    {
                        "work_code": None,
                        "work_name": aggregated_work_name,
                        "quantity": 1.0,
                        "standard_hours": None,
                        "unit_name": "усл",
                        "price": float(explicit_expected_work_total),
                        "line_total": float(explicit_expected_work_total),
                    }
                ]
        return extract_compact_work_items_fn(text)

    grouped_name_lines = [[line] for _index, line in filtered_name_lines]
    grouped_positions = [[index] for index, _line in filtered_name_lines]
    while len(grouped_name_lines) > len(line_totals):
        best_index = 0
        best_score = None
        for index in range(len(grouped_name_lines) - 1):
            score = merge_name_score(grouped_name_lines[index][-1], grouped_name_lines[index + 1][0])
            if best_score is None or score > best_score:
                best_index = index
                best_score = score
        grouped_name_lines[best_index].extend(grouped_name_lines[best_index + 1])
        grouped_positions[best_index].extend(grouped_positions[best_index + 1])
        del grouped_name_lines[best_index + 1]
        del grouped_positions[best_index + 1]

    if len(grouped_name_lines) != len(line_totals):
        return extract_compact_work_items_fn(text)

    works: list[dict[str, object]] = []
    previous_group_end = -1
    for group_index, (name_group, position_group, line_total) in enumerate(zip(grouped_name_lines, grouped_positions, line_totals)):
        work_name = clean_work_name_fn(" ".join(name_group))[:500]
        if not work_name:
            previous_group_end = position_group[-1]
            continue

        current_group_start = position_group[0]
        current_group_end = position_group[-1]
        next_group_start = grouped_positions[group_index + 1][0] if group_index + 1 < len(grouped_positions) else len(work_body_lines)

        work_code: Optional[str] = None
        for line in work_body_lines[previous_group_end + 1 : current_group_start]:
            if " " in line:
                continue
            if re.fullmatch(r"\d{1,2}", line):
                continue
            if not re.fullmatch(r"[A-Za-zА-Яа-я0-9/_-]{3,}", line):
                continue
            if is_article_candidate(line):
                normalized_code = normalize_article(line) or normalize_text_value(line)
                if normalized_code and any(char.isdigit() for char in normalized_code):
                    work_code = normalized_code

        standard_hours: Optional[float] = None
        price: Optional[float] = None
        forward_lines = work_body_lines[current_group_start + 1 : next_group_start]
        for index, line in enumerate(forward_lines):
            candidate_price = extract_rate_candidate_fn(line)
            if candidate_price is not None and price is None:
                price = candidate_price

            candidate_hours = parse_standard_hours(line)
            if candidate_hours is None:
                continue

            tail_window = " ".join(forward_lines[index : index + 3]).lower()
            if "ремонт" in tail_window or price is not None:
                standard_hours = candidate_hours

        if standard_hours is not None and price is None:
            price = infer_price_fn(line_total, standard_hours)
        if standard_hours is None and price is not None:
            standard_hours = infer_quantity_fn(line_total, price)

        works.append(
            {
                "work_code": work_code,
                "work_name": work_name,
                "quantity": float(standard_hours) if standard_hours is not None else 1.0,
                "standard_hours": float(standard_hours) if standard_hours is not None else None,
                "unit_name": "ч" if standard_hours is not None else "усл",
                "price": float(price) if price is not None else float(line_total),
                "line_total": float(line_total),
            }
        )
        previous_group_end = current_group_end

    compact_works = extract_compact_work_items_fn(text)
    if compact_works and (
        len(compact_works) > len(works)
        or sum(item["line_total"] for item in compact_works) > sum(item["line_total"] for item in works) + 3.0
    ):
        return compact_works

    return works


def parse_axb_standard_hours_candidate(line: str) -> Optional[float]:
    normalized_line_value_result = normalize_line(line).lower()
    if not normalized_line_value_result:
        return None

    match = re.fullmatch(r"(?P<hours>\d+(?:[.,]\d+)?)\s*(?:[a-zа-я]+)?", normalized_line_value_result)
    if match is None:
        return None
    if "," not in match.group("hours") and "." not in match.group("hours"):
        return None

    hours = parse_decimal_value(match.group("hours"))
    if hours is None or hours <= 0 or hours > 12:
        return None
    return float(hours)


def extract_axb_rate_candidate(line: str) -> Optional[float]:
    normalized_line_value_result = normalize_line(line)
    if not re.search(r"[З3]\s*\d", normalized_line_value_result):
        return None
    compact_match = re.fullmatch(r"[З3]\s*(\d[\d\s]*(?:[.,]\d{2}))", normalized_line_value_result)
    if compact_match is not None:
        return parse_amount(f"3 {compact_match.group(1)}")
    amounts = extract_amount_candidates_from_fragment(normalized_line_value_result)
    if not amounts:
        return None
    return max(amounts)
