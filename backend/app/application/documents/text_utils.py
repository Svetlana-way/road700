from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

from app.application.documents.config import (
    RUSSIAN_MONTHS,
    TEXT_CHAR_REPLACEMENTS,
    TEXT_KEYWORD_PATTERN,
)


def normalize_text(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


def normalize_multiline_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_line(line: str) -> str:
    return normalize_text(line.replace("\xa0", " "))


def score_text_quality(text: str) -> tuple[int, int, int]:
    cyrillic_count = len(re.findall(r"[А-Яа-я]", text))
    alnum_count = len(re.findall(r"[А-Яа-яA-Za-z0-9]", text))
    keyword_hits = len(TEXT_KEYWORD_PATTERN.findall(text))
    return (keyword_hits, cyrillic_count, alnum_count)


def clean_text_lines(text: str) -> str:
    text = text.translate(TEXT_CHAR_REPLACEMENTS).replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(normalize_line(line) for line in text.splitlines() if normalize_line(line))


def generate_text_variants(text: str) -> list[str]:
    base = clean_text_lines(text)
    variants: list[str] = [base]
    seen = {base}

    for source_encoding, target_encoding in (
        ("latin1", "cp1251"),
        ("cp1252", "cp1251"),
        ("latin1", "utf-8"),
        ("cp1252", "utf-8"),
    ):
        try:
            repaired = base.encode(source_encoding, errors="ignore").decode(target_encoding, errors="ignore")
        except (LookupError, UnicodeError):
            continue
        cleaned = clean_text_lines(repaired)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            variants.append(cleaned)

    return variants


def select_best_text_variant(text: str) -> str:
    variants = generate_text_variants(text)
    if not variants:
        return ""

    best_variant = variants[0]
    best_score = score_text_quality(best_variant)
    for candidate in variants[1:]:
        candidate_score = score_text_quality(candidate)
        if candidate_score > best_score:
            best_variant = candidate
            best_score = candidate_score
    return best_variant


def score_tesseract_ocr_variant(text: str) -> tuple[int, int, int, int, int]:
    normalized_text = select_best_text_variant(text)
    keyword_hits, cyrillic_count, alnum_count = score_text_quality(normalized_text)
    amount_hits = len(re.findall(r"\d[\d\s]*(?:[.,]\d{2})", normalized_text))
    table_hits = len(
        re.findall(
            r"(?:ремонт|итого|всего|артикул|наименование|кол[-. ]?во|норма|гос\.?\s*номер|vin|пробег)",
            normalized_text,
            re.IGNORECASE,
        )
    )
    return (table_hits, amount_hits, keyword_hits, cyrillic_count, alnum_count)


def select_best_tesseract_ocr_variant(candidates: list[str]) -> str:
    non_empty_candidates = [candidate for candidate in candidates if candidate and candidate.strip()]
    if not non_empty_candidates:
        return ""

    best_variant = select_best_text_variant(non_empty_candidates[0])
    best_score = score_tesseract_ocr_variant(non_empty_candidates[0])
    for candidate in non_empty_candidates[1:]:
        candidate_variant = select_best_text_variant(candidate)
        candidate_score = score_tesseract_ocr_variant(candidate)
        if candidate_score > best_score:
            best_variant = candidate_variant
            best_score = candidate_score
    return best_variant


def parse_amount(value: str) -> Optional[float]:
    cleaned = value.replace(" ", "").replace("\xa0", "").replace("'", "").replace("|", "").replace(",", ".")
    cleaned = re.sub(r"(?<=\d)-(?=\d{2}$)", ".", cleaned)
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def parse_decimal_value(value: str) -> Optional[float]:
    normalized = value.replace(" ", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return None


def parse_date_value(value: str) -> Optional[date]:
    normalized_value = normalize_text(value).strip().lower()
    for fmt in (
        "%d.%m.%Y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%Y.%m.%d",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ):
        try:
            return datetime.strptime(normalized_value, fmt).date()
        except ValueError:
            continue
    textual_match = re.search(r"(\d{1,2})\s+([а-я]+)\s+(\d{4})", normalized_value)
    if textual_match is not None:
        day = int(textual_match.group(1))
        month = RUSSIAN_MONTHS.get(textual_match.group(2))
        year = int(textual_match.group(3))
        if month is not None:
            try:
                return date(year, month, day)
            except ValueError:
                return None
    return None


def normalize_identifier_token(value: str | None) -> Optional[str]:
    if not value:
        return None
    normalized = re.sub(r"[^A-Za-zА-Яа-я0-9]+", "", value).upper()
    return normalized or None


def is_plausible_order_number(value: str | None) -> bool:
    if not value:
        return False
    normalized = normalize_text(value)
    if len(normalized) < 3:
        return False
    return any(char.isdigit() for char in normalized)
