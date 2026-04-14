from __future__ import annotations

from typing import Optional

from app.application.documents.config import AXB_PART_NAME_KEYWORDS, AXB_WORK_NAME_KEYWORDS
from app.application.documents.document_parsers.axb_helpers import (
    collapse_axb_name_lines,
    extract_axb_invoice_fragment,
    is_axb_invoice_header_line,
    is_axb_invoice_stop_line,
    is_axb_invoice_total_marker,
    parse_axb_quantity_candidate,
)
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name
from app.application.documents.runtime_text import normalize_text
from app.application.documents.text_utils import normalize_line, parse_amount


def _is_axb_article_candidate(line: str) -> bool:
    from app.application.documents.document_parsers.axb_materials import is_axb_article_candidate

    return is_axb_article_candidate(line)


def _infer_axb_price(line_total: float, quantity: float) -> Optional[float]:
    from app.application.documents.document_parsers.axb_work_items import infer_axb_price

    return infer_axb_price(line_total, quantity)


def _infer_axb_quantity(line_total: float, price: float) -> Optional[float]:
    from app.application.documents.document_parsers.axb_work_items import infer_axb_quantity

    return infer_axb_quantity(line_total, price)


def normalize_axb_explicit_unit(raw_unit: Optional[str]) -> Optional[str]:
    if not raw_unit:
        return None
    translated_unit = raw_unit.lower()
    if translated_unit in {"4", "f"}:
        return "ч"
    if translated_unit == "-":
        return None
    return normalize_unit_name(raw_unit)


def extract_axb_invoice_totals(lines: list[str]) -> tuple[list[float], int]:
    total_marker_index = -1
    for index, line in enumerate(lines):
        if is_axb_invoice_total_marker(line):
            total_marker_index = index

    if total_marker_index < 0:
        return [], 0

    totals = [
        amount
        for amount in (parse_amount(line) for line in lines[total_marker_index + 1 :])
        if amount is not None and amount > 0
    ]
    if not totals:
        return [], 0

    expected_count = len(totals)
    if len(totals) >= 2 and totals[-1] > max(totals[:-1]):
        expected_count -= 1
    return totals[:expected_count], expected_count


def infer_axb_item_kind(name: str, *, unit_name: Optional[str], quantity: Optional[float]) -> str:
    normalized_name = normalize_line(name).lower()
    if any(keyword in normalized_name for keyword in AXB_WORK_NAME_KEYWORDS):
        return "works"
    if any(keyword in normalized_name for keyword in AXB_PART_NAME_KEYWORDS):
        return "parts"
    if unit_name == "шт":
        return "parts"
    if quantity is not None and abs(quantity - round(quantity)) > 0.001:
        return "works"
    return "parts"


def score_axb_price_sequence(
    prices: list[float],
    quantities: list[float],
    total_slice: list[float],
) -> float:
    if len(prices) != len(quantities) or len(prices) != len(total_slice):
        return float("-inf")

    score = 0.0
    for price, quantity, line_total in zip(prices, quantities, total_slice):
        if price <= 0 or quantity <= 0:
            return float("-inf")
        if price * quantity < line_total * 0.98:
            return float("-inf")
        ratio = line_total / (price * quantity)
        if not 0.75 <= ratio <= 1.05:
            score -= abs(ratio - 0.95) * 40
        else:
            score += 8 - abs(ratio - 0.95) * 40
        if price >= 100:
            score += 1.5
        else:
            score -= 4
    return score


def select_axb_batch_prices(
    quantities: list[float],
    amount_batch: list[float],
    total_slice: list[float],
) -> list[float]:
    batch_size = len(quantities)
    if batch_size == 0 or not amount_batch:
        return []

    candidate_sequences: list[list[float]] = []
    if len(amount_batch) >= batch_size:
        candidate_sequences.append(amount_batch[:batch_size])
    if len(amount_batch) >= batch_size * 3:
        candidate_sequences.append([amount_batch[index * 3] for index in range(batch_size)])

    best_sequence: list[float] = []
    best_score = float("-inf")
    for sequence in candidate_sequences:
        score = score_axb_price_sequence(sequence, quantities, total_slice[: len(sequence)])
        if score > best_score:
            best_score = score
            best_sequence = sequence

    return best_sequence


def extract_axb_invoice_items(text: str) -> dict[str, list[dict[str, object]]]:
    normalize_line_value = normalize_line
    is_article_candidate = _is_axb_article_candidate
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    collapse_name_lines = collapse_axb_name_lines
    parse_quantity_candidate = parse_axb_quantity_candidate
    parse_amount_value = parse_amount
    is_header_line = is_axb_invoice_header_line
    is_stop_line = is_axb_invoice_stop_line
    infer_quantity = _infer_axb_quantity
    infer_price = _infer_axb_price
    invoice_fragment = extract_axb_invoice_fragment(text)
    if not invoice_fragment:
        return {"works": [], "parts": []}

    lines = [normalize_line_value(line) for line in invoice_fragment.splitlines() if normalize_line_value(line)]
    totals, expected_count = extract_axb_invoice_totals(lines)
    if expected_count == 0:
        return {"works": [], "parts": []}

    try:
        names_start = next(index for index, line in enumerate(lines) if line.lower() == "товар")
        article_header_index = next(
            index for index, line in enumerate(lines[names_start + 1 :], start=names_start + 1) if line.lower() == "артикул"
        )
        quantity_header_index = next(
            index for index, line in enumerate(lines[article_header_index + 1 :], start=article_header_index + 1) if line.lower().startswith("кол-во")
        )
    except StopIteration:
        return {"works": [], "parts": []}

    pending_codes: list[str] = []
    trailing_name_lines: list[str] = []
    seen_non_article_after_header = False
    for line in lines[article_header_index + 1 : quantity_header_index]:
        if not seen_non_article_after_header and is_article_candidate(line):
            normalized_code = normalize_article(line) or normalize_text_value(line)
            if normalized_code:
                pending_codes.append(normalized_code)
            continue
        seen_non_article_after_header = True
        if is_article_candidate(line):
            continue
        trailing_name_lines.append(line)

    names = collapse_name_lines(
        lines[names_start + 1 : article_header_index] + trailing_name_lines,
        expected_count,
    )
    if len(names) != expected_count:
        return {"works": [], "parts": []}

    body_lines = lines[quantity_header_index + 1 :]
    total_marker_index = next((index for index, line in enumerate(body_lines) if line.lower() == "всего"), len(body_lines))
    body_lines = body_lines[:total_marker_index]
    invoice_total_index = next(
        (index for index, line in enumerate(body_lines) if normalize_line_value(line).lower().startswith("итого rub")),
        len(body_lines),
    )
    body_lines = body_lines[:invoice_total_index]

    normalized_body_lines: list[str] = []
    index = 0
    while index < len(body_lines):
        current_line = body_lines[index]
        if (
            current_line.endswith("-")
            and index + 1 < len(body_lines)
            and not is_header_line(body_lines[index + 1])
            and not is_stop_line(body_lines[index + 1])
            and not parse_quantity_candidate(body_lines[index + 1])
            and parse_amount_value(body_lines[index + 1]) is None
        ):
            normalized_body_lines.append(normalize_line_value(f"{current_line}{body_lines[index + 1]}"))
            index += 2
            continue
        normalized_body_lines.append(current_line)
        index += 1

    rows: list[dict[str, object]] = []
    body_index = 0
    trailing_amounts: list[float] = []

    while body_index < len(normalized_body_lines) and len(rows) < expected_count:
        current_line = normalized_body_lines[body_index]
        if is_header_line(current_line) or is_stop_line(current_line):
            body_index += 1
            continue
        if is_article_candidate(current_line):
            normalized_code = normalize_article(current_line) or normalize_text_value(current_line)
            if normalized_code:
                pending_codes.append(normalized_code)
            body_index += 1
            continue

        quantity_candidate = parse_quantity_candidate(current_line)
        if quantity_candidate is None:
            body_index += 1
            continue

        qty_batch: list[tuple[float, Optional[str]]] = []
        while body_index < len(normalized_body_lines):
            quantity_candidate = parse_quantity_candidate(normalized_body_lines[body_index])
            if quantity_candidate is None:
                break
            qty_batch.append(quantity_candidate)
            body_index += 1

        amount_batch: list[float] = []
        non_amount_streak = 0
        while body_index < len(normalized_body_lines):
            current_line = normalized_body_lines[body_index]
            if is_header_line(current_line) or is_stop_line(current_line):
                break
            if is_article_candidate(current_line) or parse_quantity_candidate(current_line) is not None:
                break

            amount_value = parse_amount_value(current_line)
            body_index += 1
            if amount_value is None:
                if amount_batch:
                    non_amount_streak += 1
                    if non_amount_streak >= 2:
                        break
                continue
            amount_batch.append(amount_value)
            non_amount_streak = 0

        current_row_index = len(rows)
        batch_quantities = [quantity for quantity, _raw_unit in qty_batch]
        batch_prices = select_axb_batch_prices(
            batch_quantities,
            amount_batch,
            totals[current_row_index : current_row_index + len(qty_batch)],
        )
        trailing_amounts = amount_batch[len(batch_prices) :]

        for batch_index, (quantity, raw_unit) in enumerate(qty_batch):
            if len(rows) >= expected_count:
                break
            row_payload: dict[str, object] = {
                "quantity": quantity,
                "raw_unit": raw_unit,
            }
            if batch_index < len(batch_prices):
                row_payload["price"] = batch_prices[batch_index]
            if pending_codes:
                row_payload["code"] = pending_codes.pop(0)
            rows.append(row_payload)

    missing_rows = expected_count - len(rows)
    if missing_rows > 0 and trailing_amounts:
        trailing_prices = [trailing_amounts[index] for index in range(len(trailing_amounts) - 3, -1, -3)]
        trailing_prices.reverse()
        for price in trailing_prices[-missing_rows:]:
            rows.append({"price": price})
            if len(rows) >= expected_count:
                break

    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []

    for index, (name, line_total) in enumerate(zip(names, totals)):
        row_payload = rows[index] if index < len(rows) else {}
        quantity = float(row_payload["quantity"]) if row_payload.get("quantity") is not None else None
        price = float(row_payload["price"]) if row_payload.get("price") is not None else None
        explicit_unit = normalize_axb_explicit_unit(str(row_payload.get("raw_unit")) if row_payload.get("raw_unit") else None)

        if quantity is None and price is not None:
            quantity = infer_quantity(line_total, price)
        if price is None and quantity is not None:
            price = infer_price(line_total, quantity)
        if quantity is None or price is None:
            continue

        item_kind = infer_axb_item_kind(name, unit_name=explicit_unit, quantity=quantity)
        unit_name = explicit_unit
        if unit_name is None:
            if item_kind == "works":
                unit_name = "ч"
            elif abs(quantity - round(quantity)) <= 0.001:
                unit_name = "шт"

        code_value = str(row_payload.get("code")) if row_payload.get("code") else None
        if item_kind == "works":
            works.append(
                {
                    "work_code": normalize_article(code_value),
                    "work_name": name[:500],
                    "quantity": quantity,
                    "unit_name": unit_name,
                    "price": price,
                    "line_total": float(line_total),
                }
            )
            continue

        parts.append(
            {
                "article": normalize_article(code_value),
                "part_name": name[:500],
                "quantity": quantity,
                "unit_name": unit_name,
                "price": price,
                "line_total": float(line_total),
            }
        )

    return {"works": works, "parts": parts}
