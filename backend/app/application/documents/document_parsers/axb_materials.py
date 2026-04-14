from __future__ import annotations

import re
from collections import Counter
from typing import Optional

from app.application.documents.config import (
    ARTICLE_TOKEN_PATTERN,
    AXB_ARTICLE_TOKEN_PATTERN,
    WORK_CODE_TOKEN_PATTERN,
)
from app.application.documents.document_parsers.axb_helpers import (
    collapse_axb_name_lines,
    is_axb_invoice_header_line,
    is_axb_invoice_stop_line,
    is_axb_invoice_total_marker,
    parse_axb_quantity_candidate,
)
from app.application.documents.parser_helpers import amounts_match, normalize_article_value
from app.application.documents.text_fragments import extract_amount_candidates_from_fragment
from app.application.documents.runtime_text import normalize_text, score_text_quality
from app.application.documents.text_utils import normalize_line, parse_amount


def is_axb_article_candidate(line: str) -> bool:
    normalized_line_value_result = normalize_line(line)
    compact_line = normalized_line_value_result.replace(" ", "")
    if not compact_line:
        return False
    if is_axb_invoice_header_line(normalized_line_value_result) or is_axb_invoice_stop_line(normalized_line_value_result):
        return False
    if parse_axb_quantity_candidate(normalized_line_value_result) is not None:
        return False
    if compact_line.isdigit() and len(compact_line) >= 3:
        return True
    if compact_line.isdigit() and len(compact_line) <= 2:
        return True
    if (
        WORK_CODE_TOKEN_PATTERN.fullmatch(compact_line)
        or ARTICLE_TOKEN_PATTERN.fullmatch(compact_line)
        or AXB_ARTICLE_TOKEN_PATTERN.fullmatch(compact_line)
    ):
        return True
    if parse_amount(normalized_line_value_result) is not None:
        return False
    if normalized_line_value_result.isdigit() and len(normalized_line_value_result) == 1:
        return False
    return False


def is_axb_material_article_candidate(line: str) -> bool:
    normalized_line_value_result = normalize_line(line)
    compact_line = normalized_line_value_result.replace(" ", "").rstrip("*|")
    if not compact_line:
        return False
    if " " in normalized_line_value_result and not compact_line.isdigit():
        return False
    if compact_line.isdigit() and len(compact_line) <= 2:
        return False
    if (
        WORK_CODE_TOKEN_PATTERN.fullmatch(compact_line)
        or ARTICLE_TOKEN_PATTERN.fullmatch(compact_line)
        or AXB_ARTICLE_TOKEN_PATTERN.fullmatch(compact_line)
    ):
        return True
    return compact_line.isdigit() and len(compact_line) >= 3


def split_axb_leading_item_code(line: str) -> tuple[Optional[str], str]:
    normalize_line_value = normalize_line
    parse_amount_value = parse_amount
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    work_code_pattern = WORK_CODE_TOKEN_PATTERN
    article_pattern = ARTICLE_TOKEN_PATTERN
    axb_article_pattern = AXB_ARTICLE_TOKEN_PATTERN
    normalized_line_value_result = normalize_line_value(line)
    if not normalized_line_value_result:
        return None, ""

    match = re.fullmatch(
        r"(?:(?P<row>\d{1,2})\s+)?(?P<code>[A-Za-zА-Яа-я0-9/._*-]{3,})(?:\s+(?P<name>.+))?",
        normalized_line_value_result,
    )
    if match is None:
        return None, normalized_line_value_result

    code = (match.group("code") or "").rstrip("*|")
    inline_name = normalize_line_value(match.group("name") or "")
    compact_code = code.replace(" ", "")
    is_numeric_article = compact_code.isdigit() and len(compact_code) >= 5
    if not compact_code or (parse_amount_value(compact_code) is not None and not is_numeric_article) or not any(
        char.isdigit() for char in compact_code
    ):
        return None, normalized_line_value_result
    if inline_name.startswith(("(", "[", "{")):
        return None, normalized_line_value_result

    alpha_suffix = re.sub(r"[^A-Za-zА-Яа-я]+", "", compact_code).lower()
    if compact_code[0].isdigit() and alpha_suffix in {"мл", "ml", "л", "l", "кг", "kg", "г", "гр"}:
        return None, normalized_line_value_result
    if not (
        work_code_pattern.fullmatch(compact_code)
        or article_pattern.fullmatch(compact_code)
        or axb_article_pattern.fullmatch(compact_code)
    ):
        return None, normalized_line_value_result

    return normalize_article(code) or normalize_text_value(code), inline_name


def is_axb_material_name_header_line(line: str) -> bool:
    normalized_line_value_result = normalize_line(line).lower()
    return (
        "наимен" in normalized_line_value_result
        and ("артик" in normalized_line_value_result or "товар" in normalized_line_value_result)
        and "кол" in normalized_line_value_result
    )


def score_axb_material_entries(entries: list[dict[str, Optional[str]]]) -> int:
    score = 0
    for entry in entries:
        part_name = normalize_line(str(entry.get("part_name") or ""))
        if not part_name:
            score -= 40
            continue
        keyword_hits, cyrillic_count, alnum_count = score_text_quality(part_name)
        score += keyword_hits * 18 + min(cyrillic_count, 80) + min(alnum_count, 80)
        if entry.get("article"):
            score += 24
        if re.search(r"(?:итого|всего|насумму|на\s+сумму)", part_name, re.IGNORECASE):
            score -= 140
        score -= part_name.count("|") * 4
        if len(part_name) > 240:
            score -= 50
    score += len(entries) * 12
    return score


def has_polluted_axb_material_entry_names(entries: list[dict[str, Optional[str]]]) -> bool:
    for entry in entries:
        part_name = normalize_line(str(entry.get("part_name") or ""))
        if not part_name:
            continue
        if len(extract_amount_candidates_from_fragment(part_name)) >= 2:
            return True
    return False


def clean_axb_inline_material_name(name: str) -> str:
    cleaned = normalize_line(re.sub(r"[\[\]|_]+", " ", name)).strip(" -:;,")
    cleaned = re.sub(r"\b(?:шт|шт\.|метр|мер|едиизм|едизм|tm)\b.*$", "", cleaned, flags=re.IGNORECASE).strip(" -:;,")
    cleaned = re.sub(r"(?:\s+\d+(?:[.,]\d+)?)+\s*$", "", cleaned).strip(" -:;,")
    return normalize_line(cleaned)


def extract_axb_inline_material_entries(section_text: str) -> list[dict[str, object]]:
    normalize_line_value = normalize_line
    extract_amount_candidates = extract_amount_candidates_from_fragment
    is_material_article_candidate_fn = is_axb_material_article_candidate
    clean_inline_material_name_fn = clean_axb_inline_material_name
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    is_name_header = is_axb_material_name_header_line
    lines = [normalize_line_value(line) for line in section_text.splitlines() if normalize_line_value(line)]
    entries: list[dict[str, object]] = []

    for line in lines:
        lowered_line = line.lower()
        if lowered_line.startswith("расходная накладная"):
            continue
        if re.search(r"итого\s+материал|итого\s+по\s+странице|всего\s+по\s+причине|итого\s+по\s+заказ[- ]наряду", lowered_line):
            continue
        if is_name_header(line):
            continue

        amount_values = extract_amount_candidates(line)
        if len(amount_values) < 2:
            continue

        article_match = next(
            (
                match
                for match in re.finditer(r"[A-Za-zА-Яа-я0-9/._-]{2,}", line)
                if is_material_article_candidate_fn(match.group(0).strip("._-"))
            ),
            None,
        )
        if article_match is None:
            continue

        tail = line[article_match.end():]
        amount_match = re.search(r"\d[\d\s']*(?:[.,-]\d{2})", tail)
        if amount_match is not None:
            tail = tail[: amount_match.start()]
        part_name = clean_inline_material_name_fn(tail)
        if not part_name or not re.search(r"[A-Za-zА-Яа-я]", part_name):
            continue

        article_value = normalize_article(article_match.group(0).strip("._-")) or normalize_text_value(article_match.group(0))
        entries.append(
            {
                "article": article_value,
                "part_name": part_name[:500],
                "line_total": float(amount_values[-2]),
            }
        )

    return entries


def _extract_axb_material_section_entries_from_lines(
    lines: list[str],
    *,
    name_header_index: int,
) -> list[dict[str, Optional[str]]]:
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    is_material_article_candidate_fn = is_axb_material_article_candidate
    is_total_marker = is_axb_invoice_total_marker
    parse_quantity_candidate = parse_axb_quantity_candidate
    parse_amount_value = parse_amount
    split_leading_item_code_fn = split_axb_leading_item_code
    normalize_line_value = normalize_line
    try:
        body_lines = lines[name_header_index + 1 :]
    except IndexError:
        return []
    lookback_codes = [
        normalize_article(line) or normalize_text_value(line)
        for line in lines[max(0, name_header_index - 8) : name_header_index]
        if is_material_article_candidate_fn(line)
    ]
    body_end_index = next(
        (
            index
            for index, line in enumerate(body_lines)
            if is_total_marker(line)
            or re.search(
                r"итого\s+по\s+странице\s+материалов|итого\s+материалов|всего\s+по\s+причине|итого\s+по\s+заказ[- ]наряду",
                line,
                re.IGNORECASE,
            )
        ),
        len(body_lines),
    )

    entries: list[dict[str, object]] = []
    current_entry: Optional[dict[str, object]] = None
    for line in body_lines[:body_end_index]:
        lowered_line = line.lower()
        if lowered_line in {
            "артикул",
            "наименование",
            "кол-во",
            "ед. изм. цена",
            "1 скидка",
            "no",
        }:
            continue
        if any(marker in lowered_line for marker in ("кол-во", "ед. изм", "ед.изм", "едизм", "скидка")):
            continue
        if re.fullmatch(r"\d{1,2}", line):
            continue
        if parse_quantity_candidate(line) is not None:
            continue
        if parse_amount_value(line) is not None and not is_material_article_candidate_fn(line):
            continue
        if re.match(r"^(?:шт|шт\.|л/дмз|л/дм3|л|кг|г|м)\b", lowered_line):
            continue

        code, inline_name = split_leading_item_code_fn(line)
        if code:
            current_entry = {"article": code, "name_lines": []}
            if inline_name:
                current_entry["name_lines"].append(inline_name)
            entries.append(current_entry)
            continue

        if current_entry is None:
            seeded_code = lookback_codes.pop(0) if lookback_codes else None
            current_entry = {"article": seeded_code, "name_lines": []}
            entries.append(current_entry)

        current_entry.setdefault("name_lines", []).append(line)

    normalized_entries: list[dict[str, Optional[str]]] = []
    for entry in entries:
        part_name = normalize_line_value(" ".join(entry.get("name_lines", [])))[:500]
        if not part_name:
            continue
        normalized_entries.append(
            {
                "article": normalize_article(str(entry.get("article"))) if entry.get("article") else None,
                "part_name": part_name,
            }
        )
    return normalized_entries


def extract_axb_batched_material_section_entries_from_lines(
    lines: list[str],
    *,
    name_header_index: int,
) -> list[dict[str, Optional[str]]]:
    is_total_marker = is_axb_invoice_total_marker
    normalize_article = normalize_article_value
    normalize_text_value = normalize_text
    is_material_article_candidate_fn = is_axb_material_article_candidate
    split_leading_item_code_fn = split_axb_leading_item_code
    parse_quantity_candidate = parse_axb_quantity_candidate
    parse_amount_value = parse_amount
    collapse_name_lines_fn = collapse_axb_name_lines
    normalize_line_value = normalize_line
    try:
        body_lines = lines[name_header_index + 1 :]
    except IndexError:
        return []

    body_end_index = next(
        (
            index
            for index, line in enumerate(body_lines)
            if is_total_marker(line)
            or re.search(
                r"итого\s+по\s+странице\s+материалов|итого\s+материалов|всего\s+по\s+причине|итого\s+по\s+заказ[- ]наряду",
                line,
                re.IGNORECASE,
            )
        ),
        len(body_lines),
    )

    codes: list[str] = [
        normalize_article(line) or normalize_text_value(line)
        for line in lines[max(0, name_header_index - 8) : name_header_index]
        if is_material_article_candidate_fn(line)
    ]
    name_lines: list[str] = []
    for line in body_lines[:body_end_index]:
        lowered_line = line.lower()
        if lowered_line in {
            "артикул",
            "наименование",
            "кол-во",
            "ед. изм. цена",
            "1 скидка",
            "no",
        }:
            continue
        if any(marker in lowered_line for marker in ("кол-во", "ед. изм", "ед.изм", "едизм", "скидка")):
            continue

        code, inline_name = split_leading_item_code_fn(line)
        if code:
            codes.append(code)
            if inline_name:
                name_lines.append(inline_name)
            continue

        if re.fullmatch(r"\d{1,2}", line):
            continue
        if parse_quantity_candidate(line) is not None:
            continue
        if parse_amount_value(line) is not None and not is_material_article_candidate_fn(line):
            continue
        if re.match(r"^(?:шт|шт\.|л/дмз|л/дм3|л|кг|г|м)\b", lowered_line):
            continue
        if not re.search(r"[A-Za-zА-Яа-я]", line):
            continue

        name_lines.append(line)

    if not codes or len(name_lines) < len(codes):
        return []

    merged_names = collapse_name_lines_fn(name_lines, len(codes))
    if len(merged_names) != len(codes):
        return []

    entries: list[dict[str, Optional[str]]] = []
    for code, part_name in zip(codes, merged_names):
        normalized_name = normalize_line_value(part_name)[:500]
        if not normalized_name:
            continue
        entries.append(
            {
                "article": normalize_article(code) or normalize_text_value(code),
                "part_name": normalized_name,
            }
        )
    return entries


def extract_axb_material_section_entries(section_text: str) -> list[dict[str, Optional[str]]]:
    normalize_line_value = normalize_line
    is_name_header = is_axb_material_name_header_line
    extract_section_entries = _extract_axb_material_section_entries_from_lines
    extract_batched_entries = extract_axb_batched_material_section_entries_from_lines
    score_entries = score_axb_material_entries
    lines = [normalize_line_value(line) for line in section_text.splitlines() if normalize_line_value(line)]
    if not lines:
        return []

    header_indexes = [index for index, line in enumerate(lines) if line.lower() == "наименование" or is_name_header(line)]
    best_entries: list[dict[str, Optional[str]]] = []
    best_score = float("-inf")
    for header_index in header_indexes:
        for entries in (
            extract_section_entries(lines, name_header_index=header_index),
            extract_batched_entries(lines, name_header_index=header_index),
        ):
            entry_score = score_entries(entries)
            if entries and entry_score > best_score:
                best_entries = entries
                best_score = entry_score
    return best_entries


def extract_axb_material_section_amounts(section_text: str) -> list[float]:
    normalize_line_value = normalize_line
    is_name_header = is_axb_material_name_header_line
    is_total_marker = is_axb_invoice_total_marker
    extract_amount_candidates = extract_amount_candidates_from_fragment
    lines = [normalize_line_value(line) for line in section_text.splitlines() if normalize_line_value(line)]
    if not lines:
        return []

    header_anchor_index = -1
    for index, line in enumerate(lines):
        lowered_line = line.lower()
        if is_name_header(line) or any(marker in lowered_line for marker in ("кол-во", "ед. изм", "ед.изм", "цена", "скидка")):
            header_anchor_index = index
            break

    footer_index = next(
        (
            index
            for index, line in enumerate(lines[header_anchor_index + 1 :], start=header_anchor_index + 1)
            if line.lower().startswith("заказчик подтверждает")
            or line.lower().startswith("заказ-наряд и сч")
            or line.lower().startswith("универсальный передаточный")
        ),
        len(lines),
    )

    total_marker_indexes = [
        index
        for index, line in enumerate(lines[header_anchor_index + 1 : footer_index], start=header_anchor_index + 1)
        if is_total_marker(line)
    ]
    if not total_marker_indexes:
        return []

    best_amounts: list[float] = []
    best_score: tuple[int, int, float] | None = None
    for total_marker_index in total_marker_indexes:
        amounts: list[float] = []
        trailing_window = lines[total_marker_index + 1 : min(footer_index, total_marker_index + 25)]
        for line in trailing_window:
            amounts.extend(extract_amount_candidates(line))
        while amounts and float(amounts[0]).is_integer() and amounts[0] <= 20:
            amounts = amounts[1:]
        if not amounts:
            continue

        duplicate_count = sum(1 for count in Counter(round(float(amount), 2) for amount in amounts).values() if count >= 2)
        candidate_score = (len(amounts), duplicate_count, max(amounts))
        if best_score is None or candidate_score > best_score:
            best_amounts = amounts
            best_score = candidate_score

    return best_amounts


def choose_axb_material_line_totals(
    raw_amounts: list[float],
    *,
    expected_count: int,
    section_total: Optional[float],
) -> list[float]:
    if expected_count <= 0 or not raw_amounts:
        return []

    if expected_count == 1:
        normalized_amounts = [round(float(amount), 2) for amount in raw_amounts if float(amount) > 0]
        duplicated_amounts = [
            amount
            for amount, count in Counter(normalized_amounts).items()
            if count >= 2 and (section_total is None or amount <= float(section_total) + 0.01)
        ]
        if duplicated_amounts:
            return [max(duplicated_amounts)]

    if len(raw_amounts) == expected_count:
        return raw_amounts
    if len(raw_amounts) == expected_count + 1 and raw_amounts[-1] > max(raw_amounts[:-1]):
        return raw_amounts[:-1]

    if section_total is None:
        return []

    prefix: list[float] = []
    for amount in raw_amounts:
        if amounts_match(amount, section_total, tolerance=0.2):
            break
        prefix.append(amount)

    if len(prefix) >= expected_count:
        direct_totals = prefix[:expected_count]
        if amounts_match(round(sum(direct_totals), 2), section_total, tolerance=3.0):
            return direct_totals

    if len(prefix) < expected_count * 2:
        return []

    candidate_totals = prefix[: expected_count * 2 : 2]
    if len(candidate_totals) != expected_count:
        return []
    if not amounts_match(round(sum(candidate_totals), 2), section_total, tolerance=3.0):
        return []
    return candidate_totals


def select_axb_material_section_total(
    raw_amounts: list[float],
    *,
    expected_count: int,
    expected_parts_total: Optional[float],
) -> Optional[float]:
    if not raw_amounts:
        return None

    candidate_totals: list[float] = []
    seen_candidates: set[float] = set()
    for amount in raw_amounts:
        normalized_amount = round(float(amount), 2)
        if normalized_amount <= 0 or normalized_amount in seen_candidates:
            continue
        seen_candidates.add(normalized_amount)
        candidate_totals.append(normalized_amount)

    def candidate_sort_key(amount: float) -> tuple[int, float]:
        is_expected_total = int(
            expected_parts_total is not None and amounts_match(amount, float(expected_parts_total), tolerance=0.2)
        )
        return (is_expected_total, amount)

    for candidate_total in sorted(candidate_totals, key=candidate_sort_key, reverse=True):
        if choose_axb_material_line_totals(
            raw_amounts,
            expected_count=expected_count,
            section_total=candidate_total,
        ):
            return candidate_total

    if expected_parts_total is not None and any(
        amounts_match(amount, float(expected_parts_total), tolerance=0.2) for amount in raw_amounts
    ):
        return float(expected_parts_total)

    smaller_candidates = [
        amount
        for amount in candidate_totals
        if expected_parts_total is None or amount < float(expected_parts_total) - 0.01
    ]
    return max(smaller_candidates) if smaller_candidates else None


def extract_axb_material_parts(text: str, *, expected_parts_total: Optional[float] = None) -> list[dict[str, object]]:
    extract_section_entries = extract_axb_material_section_entries
    extract_inline_entries = extract_axb_inline_material_entries
    score_entries = score_axb_material_entries
    amounts_match_fn = amounts_match
    has_polluted_names = has_polluted_axb_material_entry_names
    extract_section_amounts = extract_axb_material_section_amounts
    select_section_total = select_axb_material_section_total
    choose_line_totals = choose_axb_material_line_totals
    normalize_line_value = normalize_line
    is_name_header = is_axb_material_name_header_line
    extract_fallback_entries = _extract_axb_material_section_entries_from_lines
    section_pattern = re.compile(
        r"Расходная\s+накладная\s+к\s+заказ[- ]наряду",
        re.IGNORECASE,
    )
    matches = list(section_pattern.finditer(text))
    if not matches:
        return []

    parts: list[dict[str, object]] = []
    for index, match in enumerate(matches):
        section_start = match.start()
        section_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        section_text = text[section_start:section_end]
        section_entries = extract_section_entries(section_text)
        inline_entries = extract_inline_entries(section_text)
        inline_totals = [
            float(entry["line_total"])
            for entry in inline_entries
            if isinstance(entry.get("line_total"), (int, float))
        ]
        inline_score = score_entries(
            [{"article": entry.get("article"), "part_name": entry.get("part_name")} for entry in inline_entries]
        )
        section_score = score_entries(section_entries)
        inline_totals_match_expected = (
            expected_parts_total is not None
            and len(inline_totals) == len(inline_entries)
            and len(inline_entries) >= 2
            and amounts_match_fn(round(sum(inline_totals), 2), float(expected_parts_total), tolerance=3.0)
        )
        use_inline_entries = bool(inline_entries) and (
            inline_score > section_score
            or inline_totals_match_expected
            or (
                len(inline_entries) > len(section_entries)
                and len(inline_totals) == len(inline_entries)
                and has_polluted_names(section_entries)
            )
        )
        if use_inline_entries:
            section_entries = [
                {"article": entry.get("article"), "part_name": entry.get("part_name")}
                for entry in inline_entries
            ]
        if not section_entries:
            continue

        raw_amounts = extract_section_amounts(section_text)
        section_total = select_section_total(
            raw_amounts,
            expected_count=len(section_entries),
            expected_parts_total=expected_parts_total,
        )
        if section_total is None and expected_parts_total is not None:
            section_total = float(expected_parts_total)
        line_totals = choose_line_totals(
            raw_amounts,
            expected_count=len(section_entries),
            section_total=section_total,
        )
        if use_inline_entries:
            if len(inline_totals) == len(section_entries):
                line_totals = inline_totals
                if section_total is not None and not amounts_match_fn(round(sum(line_totals), 2), section_total, tolerance=3.0):
                    line_totals = []

        if len(line_totals) == len(section_entries):
            for item_payload, line_total in zip(section_entries, line_totals):
                parts.append(
                    {
                        "article": item_payload["article"],
                        "part_name": str(item_payload["part_name"])[:500],
                        "quantity": 1.0,
                        "unit_name": "шт",
                        "price": float(line_total),
                        "line_total": float(line_total),
                    }
                )
            continue

        if section_total is None:
            continue

        parts.append(
            {
                "article": section_entries[0]["article"] if len(section_entries) == 1 else None,
                "part_name": "; ".join(str(item["part_name"]) for item in section_entries if item.get("part_name"))[:500],
                "quantity": 1.0,
                "unit_name": "шт",
                "price": float(section_total),
                "line_total": float(section_total),
            }
        )

    if parts:
        return parts

    lines = [normalize_line_value(line) for line in text.splitlines() if normalize_line_value(line)]
    name_header_indexes = [
        index for index, line in enumerate(lines) if line.lower() == "наименование" or is_name_header(line)
    ]
    if len(name_header_indexes) < 2:
        return parts

    fallback_name_header_index = name_header_indexes[-1]
    fallback_entries = extract_fallback_entries(lines, name_header_index=fallback_name_header_index)
    if not fallback_entries:
        return parts

    fallback_slice = "\n".join(lines[max(0, fallback_name_header_index - 8) :])
    fallback_amounts = extract_section_amounts(fallback_slice)
    fallback_total = None
    if expected_parts_total is not None and any(
        amounts_match_fn(amount, float(expected_parts_total), tolerance=0.2) for amount in fallback_amounts
    ):
        fallback_total = float(expected_parts_total)
    elif fallback_amounts:
        fallback_total = max(fallback_amounts)
    if fallback_total is None:
        return parts

    parts.append(
        {
            "article": fallback_entries[0]["article"] if len(fallback_entries) == 1 else None,
            "part_name": "; ".join(str(item["part_name"]) for item in fallback_entries if item.get("part_name"))[:500],
            "quantity": 1.0,
            "unit_name": "шт",
            "price": float(fallback_total),
            "line_total": float(fallback_total),
        }
    )
    return parts
