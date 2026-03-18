from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover - optional dependency during bootstrap
    Image = None
    ImageChops = None

from pypdf import PdfReader, PdfWriter
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.document import Document, DocumentVersion
from app.models.enums import (
    CatalogStatus,
    CheckSeverity,
    DocumentKind,
    DocumentStatus,
    ImportStatus,
    RepairStatus,
)
from app.models.imports import ImportJob
from app.models.ocr_profile_matcher import OcrProfileMatcher
from app.models.ocr_rule import OcrRule
from app.models.repair import Repair, RepairCheck, RepairPart, RepairWork
from app.models.service import Service
from app.models.vehicle import Vehicle
from app.services.service_catalog import find_service_name_in_text, normalize_service_key, resolve_service_by_name
from app.services.labor_norms import (
    LaborNormApplicability,
    LaborNormEnrichmentSummary,
    assess_labor_norm_applicability,
    build_normalized_name,
    find_best_labor_norm_match,
    normalize_labor_norm_code,
)
from app.core.paths import STORAGE_ROOT


LOCAL_STORAGE_ROOT = STORAGE_ROOT
VISION_OCR_SCRIPT = Path(__file__).with_name("vision_ocr.swift")

OCR_CONFUSABLE_CHARSETS = {
    "а": "аa4@",
    "б": "б6b",
    "в": "вb8",
    "г": "гgr",
    "д": "дdg",
    "е": "еe",
    "з": "з3",
    "и": "иu",
    "к": "кk",
    "м": "мm",
    "н": "нh",
    "о": "оo0",
    "п": "пnp",
    "р": "рpr",
    "с": "сc",
    "т": "тt",
    "у": "уy",
    "х": "хx",
}
SOURCE_PATH_KEY = "source_path"
RUSSIAN_MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}
FILENAME_SERVICE_PREFIXES = (
    "заказ наряды",
    "заказ-наряды",
    "заказ наряды ",
    "заказ-наряд",
)


def fuzzy_char_pattern(char: str) -> str:
    lower_char = char.lower()
    charset = OCR_CONFUSABLE_CHARSETS.get(lower_char)
    if charset is None:
        return re.escape(char)
    return f"[{re.escape(charset)}]"


def fuzzy_word_pattern(word: str) -> str:
    return "".join(fuzzy_char_pattern(char) for char in word)


def fuzzy_phrase_pattern(*words: str) -> str:
    return r"[\s-]*".join(fuzzy_word_pattern(word) for word in words)


ORDER_LABEL_PATTERN = fuzzy_phrase_pattern("заказ", "наряд")
REVERSED_ORDER_LABEL_PATTERN = fuzzy_phrase_pattern("наряд", "заказ")
ACT_LABEL_PATTERN = fuzzy_word_pattern("акт")
ACT_WORKS_LABEL_PATTERN = fuzzy_phrase_pattern("акт", "выполненных", "работ")
DOCUMENT_LABEL_PATTERN = fuzzy_word_pattern("документ")
NUMBER_MARKER_PATTERN = r"(?:№|N[Ooº°]?|#)"
DATE_CLOSED_LABEL_PATTERN = fuzzy_phrase_pattern("дата", "закрытия")
DATE_COMPLETED_LABEL_PATTERN = fuzzy_phrase_pattern("дата", "окончания", "работ")
DATE_LABEL_PATTERN = fuzzy_word_pattern("дата")
FROM_LABEL_PATTERN = fuzzy_word_pattern("от")
MILEAGE_LABEL_PATTERN = fuzzy_word_pattern("пробег")
ODOMETER_LABEL_PATTERN = fuzzy_word_pattern("одометр")
SERVICE_LABEL_PATTERN = "|".join(
    [
        fuzzy_word_pattern("поставщик"),
        fuzzy_word_pattern("исполнитель"),
        fuzzy_word_pattern("подрядчик"),
        fuzzy_word_pattern("контрагент"),
    ]
)
WORK_TOTAL_LABEL_PATTERN = "|".join(
    [
        fuzzy_phrase_pattern("работы", "итого"),
        fuzzy_phrase_pattern("стоимость", "работ"),
        fuzzy_phrase_pattern("итого", "работ"),
    ]
)
PARTS_TOTAL_LABEL_PATTERN = "|".join(
    [
        fuzzy_phrase_pattern("запчасти", "итого"),
        fuzzy_phrase_pattern("материалы", "итого"),
        fuzzy_phrase_pattern("стоимость", "запчастей"),
        fuzzy_phrase_pattern("стоимость", "материалов"),
        fuzzy_word_pattern("запчасти"),
        fuzzy_word_pattern("материалы"),
    ]
)
VAT_LABEL_PATTERN = fuzzy_word_pattern("ндс")
GRAND_TOTAL_LABEL_PATTERN = "|".join(
    [
        fuzzy_phrase_pattern("итого", "к", "оплате"),
        fuzzy_phrase_pattern("к", "оплате"),
        fuzzy_word_pattern("итого"),
        fuzzy_word_pattern("всего"),
    ]
)

ORDER_PATTERNS = [
    rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN})\s*{NUMBER_MARKER_PATTERN}?\s*([A-Za-zА-Яа-я0-9/_-]{{3,}})",
    rf"(?:{ACT_WORKS_LABEL_PATTERN}|{ACT_LABEL_PATTERN})\s*{NUMBER_MARKER_PATTERN}?\s*([A-Za-zА-Яа-я0-9/_-]{{3,}})",
    rf"\b{NUMBER_MARKER_PATTERN}\s*([A-Za-zА-Яа-я0-9/_-]{{4,}})",
    r"\b([A-Z]{2,}[A-Z0-9/_-]*-\d{2,})\b",
]
DATE_PATTERNS = [
    rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN}|{ACT_WORKS_LABEL_PATTERN}|{ACT_LABEL_PATTERN}|{DOCUMENT_LABEL_PATTERN})"
    rf"[^\n\r]{{0,80}}?(?:{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})",
    rf"(?:{ORDER_LABEL_PATTERN}|{REVERSED_ORDER_LABEL_PATTERN}|{ACT_WORKS_LABEL_PATTERN}|{ACT_LABEL_PATTERN}|{DOCUMENT_LABEL_PATTERN})"
    rf"[^\n\r]{{0,80}}?(?:{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})",
    rf"(?:{DATE_CLOSED_LABEL_PATTERN}|{DATE_COMPLETED_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})",
    rf"(?:{DATE_CLOSED_LABEL_PATTERN}|{DATE_COMPLETED_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})",
    rf"(?:{DATE_LABEL_PATTERN}|{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{2}}[./-]\d{{2}}[./-]\d{{2,4}})",
    rf"(?:{DATE_LABEL_PATTERN}|{FROM_LABEL_PATTERN})\s*[:№]?\s*(\d{{1,2}}\s+[А-Яа-я]+\s+\d{{4}})",
    r"\b(\d{2}[./-]\d{2}[./-]\d{2,4})\b",
]
MILEAGE_PATTERNS = [
    rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\D{{0,40}}(\d[\d\s]{{1,}})",
]
PLATE_PATTERNS = [
    r"([А-ЯA-Z]\s*\d{3}\s*[А-ЯA-Z]{2}\s*\d{2,3})(?!\d)",
    r"(\d{3}\s*[А-ЯA-Z]{3}\s*\d{2,3})(?!\d)",
    r"([А-ЯA-Z]{2}\s*\d{4}\s*\d{2,3})(?!\d)",
    r"(\d{4}\s*[А-ЯA-Z]{2}\s*\d{2,3})(?!\d)",
]
VIN_PATTERNS = [
    r"(?<![A-HJ-NPR-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-HJ-NPR-Z0-9])",
]
PLATE_LABEL_PATTERNS = [
    rf"(?:гос\.?\s*(?:номер|ном\.?\s*знак)|госномер|г/н|г\.\s*н\.)\s*[:№]?\s*(?P<value>[^\n\r]{{0,48}})",
]
VIN_LABEL_PATTERNS = [
    rf"(?:\bvin\b|vin)\s*[:№]?\s*(?P<value>[A-HJ-NPR-Z0-9]{{17}})",
]
MILEAGE_SECTION_PATTERNS = [
    rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\s*[:№]?\s*(?P<value>\d[\d\s]{{0,}})",
]
VEHICLE_ROW_MILEAGE_PATTERNS = [
    r"\b(\d{3}(?:\s\d{3}){0,3})\b(?=\s+(?:закрыт|открыт|rub|rur|руб|usd|eur)\b)",
    r"\b(\d{3}(?:\s\d{3}){0,3})\b(?=\s+(?:vin|вид\s+ремонта|дата\s+приема)\b)",
]
VEHICLE_SECTION_START_PATTERN = re.compile(
    r"(?:TC|ТС|Автомобиль|ТРАНСПОРТНОЕ\s+СРЕДСТВО|Модель автомобиля|Марка:)\b",
    re.IGNORECASE,
)
VEHICLE_SECTION_STOP_PATTERN = re.compile(
    r"(?:^|\n)\s*(?:ВЛАДЕЛЕЦ|Заказчик|ЗАКАЗЧИК|ПЛАТЕЛЬЩИК|Плательщик|Причина(?:\s+обращения)?|Вид ремонта|"
    r"Выполненные работы|ДОГОВОР|Контактное\s+лицо)\b",
    re.IGNORECASE,
)
SERVICE_PATTERNS = [
    rf"(?:{SERVICE_LABEL_PATTERN})\b\s*[:№]?\s*(.+?)(?=(?:\b(?:инн|кпп|адрес|тел(?:ефон)?|заказчик|плательщик|автомобиль|шасси|vin|договор|документ|заказ[- ]наряд|акт)\b)|$)",
]
SERVICE_CANDIDATE_PATTERNS = [
    re.compile(
        rf"(?:^|\n)\s*(?:{SERVICE_LABEL_PATTERN})\b\s*[:№]?\s*(?P<value>.+?)(?=(?:\b(?:инн|кпп|адрес|тел(?:ефон)?|заказчик|плательщик|автомобиль|шасси|vin|договор|документ|заказ[- ]наряд|акт)\b)|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    ),
    re.compile(
        r"^(?:официальный\s+дилер[^\n\r]{0,80})?(?P<value>.+?)(?=(?:\b(?:инн|кпп|адрес|тел(?:ефон)?|цех|заказ[- ]наряд|акт\s+выполненных\s+работ|документ)\b)|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    ),
]
TOTAL_PATTERNS = {
    "work_total": [
        rf"(?:{WORK_TOTAL_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:запчаст|материал|ндс|итого|сервис|сто|$))",
    ],
    "parts_total": [
        rf"(?:{PARTS_TOTAL_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:ндс|итого|сервис|сто|$))",
    ],
    "vat_total": [
        rf"(?:{VAT_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:итого|сервис|сто|$))",
    ],
    "grand_total": [
        rf"(?:{GRAND_TOTAL_LABEL_PATTERN})\b[^\d\r\n]{{0,20}}(\d[\d\s]*(?:[.,]\d{{2}})?)(?=\s*(?:сервис|сто|$))",
    ],
}
LINE_ITEM_PATTERN = re.compile(
    r"^(?P<name>[^\d].*?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>[A-Za-zА-Яа-я./-]{1,8}))?"
    r"\s+(?P<price>\d[\d\s]*(?:[.,]\d{2})?)"
    r"\s+(?P<total>\d[\d\s]*(?:[.,]\d{2})?)$",
    re.IGNORECASE,
)
PART_LINE_WITH_ARTICLE_PATTERN = re.compile(
    r"^(?P<article>[A-Za-zА-Яа-я0-9-]{3,})\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>[A-Za-zА-Яа-я./-]{1,8}))?"
    r"\s+(?P<price>\d[\d\s]*(?:[.,]\d{2})?)"
    r"\s+(?P<total>\d[\d\s]*(?:[.,]\d{2})?)$",
    re.IGNORECASE,
)
WORK_SECTION_MARKERS = ("работы", "услуги", "работа:")
PART_SECTION_MARKERS = ("запчасти", "материалы", "запчасть:")
SECTION_FOOTER_MARKERS = (
    "стоимость работ",
    "работы итого",
    "итого работ",
    "запчасти итого",
    "материалы итого",
    "стоимость запчастей",
    "стоимость материалов",
    "ндс",
    "итого к оплате",
    "к оплате",
    "всего",
    "сервис",
    "сто",
    "исполнитель",
    "подрядчик",
)
ITEM_UNIT_MARKERS = {
    "шт",
    "нч",
    "ч",
    "час",
    "часа",
    "часов",
    "компл",
    "усл",
    "ед",
    "л",
    "кг",
    "м",
    "к-т",
}
ARTICLE_TOKEN_PATTERN = re.compile(r"^(?=.*[\d-])[A-Za-zА-Яа-я0-9/_-]{3,}$")
WORK_CODE_TOKEN_PATTERN = re.compile(r"^(?=.*\d)(?=.*[A-Za-zА-Яа-я])[A-Za-zА-Яа-я0-9/_-]{3,}$")
TEXT_KEYWORD_PATTERN = re.compile(
    "|".join(
        [
            fuzzy_word_pattern("заказ"),
            fuzzy_word_pattern("наряд"),
            fuzzy_word_pattern("дата"),
            fuzzy_word_pattern("госномер"),
            fuzzy_word_pattern("пробег"),
            fuzzy_word_pattern("работ"),
            fuzzy_word_pattern("запчаст"),
            fuzzy_word_pattern("итого"),
            fuzzy_word_pattern("сервис"),
            fuzzy_word_pattern("ндс"),
        ]
    ),
    re.IGNORECASE,
)
TEXT_CHAR_REPLACEMENTS = str.maketrans(
    {
        "\xa0": " ",
        "¹": "№",
        "–": "-",
        "—": "-",
        "«": '"',
        "»": '"',
    }
)
SERVICE_NAME_BLOCKLIST = (
    "стоимость",
    "работ",
    "запчаст",
    "материал",
    "ндс",
    "итого",
    "к оплате",
    "пробег",
    "госномер",
    "заказ",
    "наряд",
    "дата",
)
OCR_RULE_TARGET_FIELDS = (
    "order_number",
    "repair_date",
    "mileage",
    "plate_number",
    "vin",
    "service_name",
    "work_total",
    "parts_total",
    "vat_total",
    "grand_total",
)
OCR_RULE_VALUE_PARSERS = {
    "raw",
    "date",
    "amount",
    "digits_int",
}
OCR_TOKEN_CHAR_REPLACEMENTS = str.maketrans(
    {
        "О": "O",
        "о": "o",
        "о": "o",
        "А": "A",
        "а": "a",
        "В": "B",
        "в": "b",
        "Е": "E",
        "е": "e",
        "К": "K",
        "к": "k",
        "М": "M",
        "м": "m",
        "Н": "H",
        "н": "h",
        "Р": "P",
        "р": "p",
        "С": "C",
        "с": "c",
        "Т": "T",
        "т": "t",
        "У": "Y",
        "у": "y",
        "Х": "X",
        "х": "x",
        "І": "I",
        "і": "i",
        "—": "-",
        "–": "-",
        "−": "-",
        "‑": "-",
    }
)
UNIT_ALIASES = {
    "шт": "шт",
    "шг": "шт",
    "шt": "шт",
    "шт.": "шт",
    "ед": "ед",
    "ед.": "ед",
    "компл": "компл",
    "компл.": "компл",
    "к-т": "компл",
    "кт": "компл",
    "усл": "усл",
    "усл.": "усл",
    "л": "л",
    "л.": "л",
    "кг": "кг",
    "кг.": "кг",
    "м": "м",
    "м.": "м",
    "ч": "ч",
    "ч.": "ч",
    "час": "ч",
    "часа": "ч",
    "часов": "ч",
    "нч": "нч",
    "н.ч": "нч",
    "н/ч": "нч",
    "hч": "нч",
    "h.ч": "нч",
    "h/ч": "нч",
}


@dataclass
class ProcessingResult:
    document: Document
    job: ImportJob
    message: str


@dataclass(frozen=True)
class OcrProfileSelection:
    profile_scope: str
    source: str
    reason: str


DEFAULT_OCR_RULE_DEFINITIONS: list[dict[str, object]] = [
    {"profile_scope": "default", "target_field": "order_number", "pattern": pattern, "value_parser": "raw", "confidence": 0.74, "priority": (index + 1) * 10}
    for index, pattern in enumerate(ORDER_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "repair_date", "pattern": pattern, "value_parser": "date", "confidence": 0.7, "priority": (index + 1) * 10}
    for index, pattern in enumerate(DATE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "mileage", "pattern": pattern, "value_parser": "digits_int", "confidence": 0.82, "priority": (index + 1) * 10}
    for index, pattern in enumerate(MILEAGE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "plate_number", "pattern": pattern, "value_parser": "raw", "confidence": 0.77, "priority": (index + 1) * 10}
    for index, pattern in enumerate(PLATE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "vin", "pattern": pattern, "value_parser": "raw", "confidence": 0.88, "priority": (index + 1) * 10}
    for index, pattern in enumerate(VIN_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": "service_name", "pattern": pattern, "value_parser": "raw", "confidence": 0.58, "priority": (index + 1) * 10}
    for index, pattern in enumerate(SERVICE_PATTERNS)
] + [
    {"profile_scope": "default", "target_field": target_field, "pattern": pattern, "value_parser": "amount", "confidence": 0.8 if target_field == "grand_total" else 0.72, "priority": (index + 1) * 10}
    for target_field, patterns in TOTAL_PATTERNS.items()
    for index, pattern in enumerate(patterns)
]


def get_storage_path(storage_key: str) -> Path:
    return LOCAL_STORAGE_ROOT / storage_key


def normalize_text(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


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


def is_vision_ocr_available() -> bool:
    return shutil.which("swift") is not None and VISION_OCR_SCRIPT.exists()


def is_pillow_available() -> bool:
    return Image is not None and ImageChops is not None


def parse_amount(value: str) -> Optional[float]:
    cleaned = value.replace(" ", "").replace("\xa0", "").replace(",", ".")
    try:
        return round(float(cleaned), 2)
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


def extract_document_source_path(document: Document) -> Optional[str]:
    candidates: list[tuple[int, str]] = []
    for version in document.versions:
        payload = version.parsed_payload if isinstance(version.parsed_payload, dict) else {}
        source_path = payload.get(SOURCE_PATH_KEY)
        if isinstance(source_path, str) and source_path.strip():
            candidates.append((version.version_number, source_path.strip()))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def derive_service_name_from_source_path(source_path: str | None) -> Optional[str]:
    if not source_path:
        return None
    parent_name = Path(source_path).parent.name.strip()
    if not parent_name:
        return None
    normalized = parent_name.replace("_", " ").strip()
    lowered = normalized.lower()
    for prefix in FILENAME_SERVICE_PREFIXES:
        if lowered.startswith(prefix):
            normalized = normalized[len(prefix):].strip(" -_")
            break
    return normalized.strip() or None


def build_document_hint_text(document: Document) -> str:
    parts = [document.original_filename or ""]
    source_path = extract_document_source_path(document)
    if source_path:
        parts.append(source_path)
        service_hint = derive_service_name_from_source_path(source_path)
        if service_hint:
            parts.append(service_hint)
    return " | ".join(part for part in parts if part)


def remove_manual_review_reason(reasons: list[str], value: str) -> None:
    while value in reasons:
        reasons.remove(value)


def apply_document_metadata_fallbacks(
    document: Document,
    *,
    extracted_fields: dict[str, object],
    confidence_map: dict[str, float],
    manual_review_reasons: list[str],
    normalization_notes: list[str],
) -> None:
    hint_text = build_document_hint_text(document)
    if not hint_text:
        return

    if "plate_number" not in extracted_fields:
        plate_number = first_match(PLATE_PATTERNS, hint_text)
        normalized_plate = normalize_identifier_token(plate_number)
        if normalized_plate:
            extracted_fields["plate_number"] = normalized_plate
            confidence_map["plate_number"] = max(confidence_map.get("plate_number", 0.0), 0.55)
            normalization_notes.append("Госномер дополнен по имени файла или пути источника.")

    if "vin" not in extracted_fields:
        vin = first_match(VIN_PATTERNS, hint_text)
        normalized_vin = normalize_identifier_token(vin)
        if normalized_vin:
            extracted_fields["vin"] = normalized_vin
            confidence_map["vin"] = max(confidence_map.get("vin", 0.0), 0.6)
            normalization_notes.append("VIN дополнен по имени файла или пути источника.")

    if "order_number" not in extracted_fields:
        order_number = first_match(ORDER_PATTERNS, hint_text)
        if order_number:
            extracted_fields["order_number"] = order_number
            confidence_map["order_number"] = max(confidence_map.get("order_number", 0.0), 0.5)
            remove_manual_review_reason(manual_review_reasons, "order_number_missing")
            normalization_notes.append("Номер документа дополнен по имени файла или пути источника.")

    if "repair_date" not in extracted_fields:
        raw_date = first_match(DATE_PATTERNS, hint_text)
        parsed_date = parse_date_value(raw_date) if raw_date else None
        if parsed_date is not None:
            extracted_fields["repair_date"] = parsed_date.isoformat()
            confidence_map["repair_date"] = max(confidence_map.get("repair_date", 0.0), 0.48)
            remove_manual_review_reason(manual_review_reasons, "repair_date_missing")
            remove_manual_review_reason(manual_review_reasons, "repair_date_invalid")
            normalization_notes.append("Дата ремонта дополнена по имени файла или пути источника.")

    if "service_name" not in extracted_fields:
        service_name = derive_service_name_from_source_path(extract_document_source_path(document))
        if service_name and not is_service_name_suspicious(service_name):
            extracted_fields["service_name"] = service_name[:120]
            confidence_map["service_name"] = max(confidence_map.get("service_name", 0.0), 0.45)
            normalization_notes.append("Сервис дополнен по папке источника документа.")


def enrich_vehicle_fields_from_repair(
    repair: Repair,
    *,
    extracted_fields: dict[str, object],
    confidence_map: dict[str, float],
    normalization_notes: list[str],
) -> None:
    vehicle = repair.vehicle
    if vehicle is None or vehicle.external_id == "__batch_import_placeholder__":
        return

    if "plate_number" not in extracted_fields and vehicle.plate_number:
        normalized_plate = normalize_identifier_token(vehicle.plate_number)
        if normalized_plate:
            extracted_fields["plate_number"] = normalized_plate
            confidence_map["plate_number"] = max(confidence_map.get("plate_number", 0.0), 0.35)
            normalization_notes.append("Госномер дополнен по карточке техники.")

    if "vin" not in extracted_fields and vehicle.vin:
        normalized_vin = normalize_identifier_token(vehicle.vin)
        if normalized_vin:
            extracted_fields["vin"] = normalized_vin
            confidence_map["vin"] = max(confidence_map.get("vin", 0.0), 0.35)
            normalization_notes.append("VIN дополнен по карточке техники.")


def find_vehicle_by_identifiers(
    db: Session,
    *,
    plate_number: str | None,
    vin: str | None,
) -> Vehicle | None:
    normalized_plate = normalize_compare_token(plate_number)
    normalized_vin = normalize_compare_token(vin)
    if not normalized_plate and not normalized_vin:
        return None

    vehicles = db.scalars(select(Vehicle)).all()
    exact_matches: dict[int, Vehicle] = {}
    partial_plate_matches: dict[int, Vehicle] = {}

    for vehicle in vehicles:
        if vehicle.external_id == "__batch_import_placeholder__":
            continue
        vehicle_plate = normalize_compare_token(vehicle.plate_number)
        vehicle_vin = normalize_compare_token(vehicle.vin)
        if normalized_vin and vehicle_vin == normalized_vin:
            exact_matches[vehicle.id] = vehicle
            continue
        if normalized_plate and vehicle_plate == normalized_plate:
            exact_matches[vehicle.id] = vehicle
            continue
        if (
            normalized_plate
            and vehicle_plate
            and len(normalized_plate) >= 6
            and (
                vehicle_plate.startswith(normalized_plate)
                or normalized_plate.startswith(vehicle_plate)
            )
        ):
            partial_plate_matches[vehicle.id] = vehicle

    if len(exact_matches) == 1:
        return next(iter(exact_matches.values()))
    if len(exact_matches) > 1:
        return None
    if len(partial_plate_matches) == 1:
        return next(iter(partial_plate_matches.values()))
    return None


def enrich_vehicle_fields_from_registry(
    db: Session,
    *,
    extracted_fields: dict[str, object],
    confidence_map: dict[str, float],
    normalization_notes: list[str],
) -> None:
    vehicle = find_vehicle_by_identifiers(
        db,
        plate_number=str(extracted_fields.get("plate_number")) if extracted_fields.get("plate_number") else None,
        vin=str(extracted_fields.get("vin")) if extracted_fields.get("vin") else None,
    )
    if vehicle is None:
        return

    if "plate_number" not in extracted_fields and vehicle.plate_number:
        normalized_plate = normalize_identifier_token(vehicle.plate_number)
        if normalized_plate:
            extracted_fields["plate_number"] = normalized_plate
            confidence_map["plate_number"] = max(confidence_map.get("plate_number", 0.0), 0.4)
            normalization_notes.append("Госномер дополнен по совпадению с реестром техники.")

    if "vin" not in extracted_fields and vehicle.vin:
        normalized_vin = normalize_identifier_token(vehicle.vin)
        if normalized_vin:
            extracted_fields["vin"] = normalized_vin
            confidence_map["vin"] = max(confidence_map.get("vin", 0.0), 0.4)
            normalization_notes.append("VIN дополнен по совпадению с реестром техники.")


def auto_link_repair_vehicle_from_registry(
    db: Session,
    repair: Repair,
    *,
    extracted_fields: dict[str, object],
    normalization_notes: list[str],
) -> None:
    vehicle = repair.vehicle
    if vehicle is None or vehicle.external_id != "__batch_import_placeholder__":
        return

    matched_vehicle = find_vehicle_by_identifiers(
        db,
        plate_number=str(extracted_fields.get("plate_number")) if extracted_fields.get("plate_number") else None,
        vin=str(extracted_fields.get("vin")) if extracted_fields.get("vin") else None,
    )
    if matched_vehicle is None or matched_vehicle.id == repair.vehicle_id:
        return

    repair.vehicle_id = matched_vehicle.id
    repair.vehicle = matched_vehicle
    normalization_notes.append(
        f"Ремонт автоматически перепривязан к технике {matched_vehicle.plate_number or matched_vehicle.id} по совпадению с реестром."
    )


def parse_decimal_value(value: str) -> Optional[float]:
    normalized = value.replace(" ", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return None


def normalize_ocr_rule_code(value: str | None) -> Optional[str]:
    if value is None:
        return None
    normalized = normalize_text(str(value)).lower()
    normalized = re.sub(r"[^a-z0-9_:-]+", "_", normalized)
    normalized = normalized.strip("_")
    return normalized or None


def ensure_default_ocr_rules(db: Session) -> None:
    existing_count = db.scalar(select(func.count(OcrRule.id))) or 0
    if existing_count > 0:
        return
    for item in DEFAULT_OCR_RULE_DEFINITIONS:
        db.add(
            OcrRule(
                profile_scope=str(item["profile_scope"]),
                target_field=str(item["target_field"]),
                pattern=str(item["pattern"]),
                value_parser=str(item["value_parser"]),
                confidence=float(item["confidence"]),
                priority=int(item["priority"]),
                is_active=True,
            )
        )
    db.flush()


def load_active_ocr_rules(db: Session, *, profile_scope: str | None = None) -> list[OcrRule]:
    ensure_default_ocr_rules(db)
    stmt = (
        select(OcrRule)
        .where(OcrRule.is_active.is_(True))
        .order_by(OcrRule.profile_scope.asc(), OcrRule.target_field.asc(), OcrRule.priority.asc(), OcrRule.id.asc())
    )
    normalized_profile_scope = normalize_ocr_rule_code(profile_scope) if profile_scope else None
    if normalized_profile_scope:
        stmt = stmt.where(OcrRule.profile_scope.in_(("default", normalized_profile_scope)))
    return db.scalars(stmt).all()


def load_active_ocr_profile_matchers(db: Session) -> list[OcrProfileMatcher]:
    stmt = (
        select(OcrProfileMatcher)
        .where(OcrProfileMatcher.is_active.is_(True))
        .order_by(OcrProfileMatcher.priority.asc(), OcrProfileMatcher.id.asc())
    )
    return db.scalars(stmt).all()


def extract_profile_history_scope(document: Document) -> Optional[str]:
    repair = document.repair
    if repair is None:
        return None
    candidate_versions = []
    for sibling in repair.documents:
        if sibling.id == document.id:
            continue
        for version in sibling.versions:
            payload = version.parsed_payload if isinstance(version.parsed_payload, dict) else {}
            profile_scope = payload.get("ocr_profile_scope")
            if isinstance(profile_scope, str) and profile_scope.strip():
                candidate_versions.append((version.created_at, profile_scope.strip()))
    if not candidate_versions:
        return None
    candidate_versions.sort(key=lambda item: item[0], reverse=True)
    return candidate_versions[0][1]


def profile_matcher_applies(
    matcher: OcrProfileMatcher,
    *,
    document: Document,
    text: str,
) -> bool:
    if matcher.source_type and matcher.source_type != document.source_type:
        return False

    filename = document.original_filename or ""
    if matcher.filename_pattern:
        try:
            if re.search(matcher.filename_pattern, filename, re.IGNORECASE | re.MULTILINE) is None:
                return False
        except re.error:
            return False

    if matcher.text_pattern:
        try:
            if re.search(matcher.text_pattern, text, re.IGNORECASE | re.MULTILINE) is None:
                return False
        except re.error:
            return False

    if matcher.service_name_pattern:
        service_name = document.repair.service.name if document.repair and document.repair.service else ""
        try:
            if re.search(matcher.service_name_pattern, service_name, re.IGNORECASE | re.MULTILINE) is None:
                return False
        except re.error:
            return False

    return True


def select_ocr_profile_scope(db: Session, document: Document, text: str) -> OcrProfileSelection:
    history_scope = extract_profile_history_scope(document)
    matchers = load_active_ocr_profile_matchers(db)
    matched = [item for item in matchers if profile_matcher_applies(item, document=document, text=text)]
    if matched:
        matched.sort(key=lambda item: (item.priority, item.id))
        best = matched[0]
        runner_up = matched[1] if len(matched) > 1 else None
        if (
            runner_up is not None
            and runner_up.priority == best.priority
            and runner_up.profile_scope != best.profile_scope
        ):
            if history_scope:
                return OcrProfileSelection(
                    profile_scope=history_scope,
                    source="history_fallback",
                    reason="Есть несколько одинаково подходящих matcher-правил, выбран последний профиль ремонта",
                )
            return OcrProfileSelection(
                profile_scope="default",
                source="ambiguous_fallback",
                reason="Есть несколько одинаково подходящих matcher-правил, выбран default-профиль",
            )
        return OcrProfileSelection(
            profile_scope=best.profile_scope,
            source="matcher",
            reason=best.title,
        )

    if history_scope:
        return OcrProfileSelection(
            profile_scope=history_scope,
            source="history",
            reason="Использован последний OCR-профиль из истории ремонта",
        )

    return OcrProfileSelection(
        profile_scope="default",
        source="default",
        reason="Подходящий профиль не найден, использован default",
    )


def group_ocr_rules_by_field(rules: list[OcrRule]) -> dict[str, list[OcrRule]]:
    grouped: dict[str, list[OcrRule]] = {}
    for rule in rules:
        grouped.setdefault(rule.target_field, []).append(rule)
    return grouped


def match_custom_ocr_rule(text: str, rules: list[OcrRule]) -> tuple[Optional[str], Optional[float], Optional[OcrRule]]:
    for rule in rules:
        try:
            match = re.search(rule.pattern, text, re.IGNORECASE | re.MULTILINE)
        except re.error:
            continue
        if not match:
            continue
        captured = match.group(1) if match.groups() else match.group(0)
        return normalize_text(captured), float(rule.confidence), rule
    return None, None, None


def parse_ocr_rule_value(raw_value: str, value_parser: str) -> Optional[object]:
    if value_parser == "date":
        parsed_date = parse_date_value(raw_value)
        return parsed_date.isoformat() if parsed_date else None
    if value_parser == "amount":
        return parse_amount(raw_value)
    if value_parser == "digits_int":
        digits_only = re.sub(r"\D", "", raw_value)
        return int(digits_only) if digits_only else None
    return raw_value


def extract_header_field(
    text: str,
    *,
    target_field: str,
    fallback_patterns: list[str],
    fallback_parser: str,
    fallback_confidence: float,
    rule_map: dict[str, list[OcrRule]],
) -> tuple[Optional[object], Optional[float], bool]:
    rules = rule_map.get(target_field, [])
    custom_match, custom_confidence, matched_rule = match_custom_ocr_rule(text, rules)
    if custom_match is not None:
        parser_name = matched_rule.value_parser if matched_rule is not None else fallback_parser
        parsed_value = parse_ocr_rule_value(custom_match, parser_name)
        if parsed_value is not None:
            return parsed_value, custom_confidence, False
        return None, None, True

    fallback_match = first_match(fallback_patterns, text)
    if fallback_match is None:
        return None, None, False
    parsed_value = parse_ocr_rule_value(fallback_match, fallback_parser)
    if parsed_value is None:
        return None, None, True
    return parsed_value, fallback_confidence, False


def first_match(patterns: list[str], text: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return normalize_text(match.group(1))
    return None


def normalize_line(line: str) -> str:
    return normalize_text(line.replace("\xa0", " "))


def normalize_service_candidate(value: str | None) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_text(str(value).replace("\n", " ").replace("\r", " "))
    normalized_value = re.sub(r"\s+", " ", normalized_value).strip(" -:;,")
    return normalized_value or None


def extract_header_text(text: str, limit: int = 2500) -> str:
    return text[:limit]


def extract_vehicle_section_text(text: str, limit: int = 1800) -> str:
    head = text[:3000]
    match = VEHICLE_SECTION_START_PATTERN.search(head)
    if match is None:
        return extract_header_text(text, limit=limit)

    fragment = head[match.start(): match.start() + limit]
    stop_match = VEHICLE_SECTION_STOP_PATTERN.search(fragment[1:])
    if stop_match is not None:
        fragment = fragment[: stop_match.start() + 1]
    return fragment


def normalize_compare_token(value: str | None) -> Optional[str]:
    if not value:
        return None
    normalized = normalize_identifier_token(normalize_ocr_code_token(value))
    return normalized or None


def find_pattern_value(patterns: list[str], text: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match is None:
            continue
        captured = match.group("value") if "value" in match.groupdict() else match.group(1)
        normalized = normalize_text(captured)
        if normalized:
            return normalized
    return None


def find_plate_candidate(value: str | None) -> Optional[str]:
    if not value:
        return None

    search_variants = [normalize_text(value)]
    translated_variant = normalize_text(normalize_ocr_code_token(value))
    if translated_variant and translated_variant not in search_variants:
        search_variants.append(translated_variant)

    for candidate_text in search_variants:
        for pattern in PLATE_PATTERNS:
            match = re.search(pattern, candidate_text, re.IGNORECASE | re.MULTILINE)
            if match is None:
                continue
            normalized = normalize_identifier_token(match.group(1))
            if normalized:
                return normalized
    return None


def find_vin_candidate(value: str | None) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_ocr_code_token(normalize_text(value)).upper()
    for pattern in VIN_PATTERNS:
        match = re.search(pattern, normalized_value, re.IGNORECASE | re.MULTILINE)
        if match is None:
            continue
        normalized = normalize_identifier_token(match.group(1))
        if normalized:
            return normalized
    return None


def parse_mileage_candidate(value: str | None) -> Optional[int]:
    if not value:
        return None
    digits_only = re.sub(r"\D", "", value)
    if not digits_only:
        return None
    try:
        mileage = int(digits_only)
    except ValueError:
        return None
    if mileage < 1:
        return None
    return mileage


def extract_vehicle_identifiers_from_section(text: str) -> tuple[Optional[str], Optional[str], Optional[int]]:
    section_text = extract_vehicle_section_text(text)
    plate_number = find_plate_candidate(find_pattern_value(PLATE_LABEL_PATTERNS, section_text))
    if plate_number is None:
        plate_number = find_plate_candidate(section_text)

    vin = find_vin_candidate(find_pattern_value(VIN_LABEL_PATTERNS, section_text))
    if vin is None:
        vin = find_vin_candidate(section_text)

    mileage: Optional[int] = None
    for pattern in MILEAGE_SECTION_PATTERNS:
        match = re.search(pattern, section_text, re.IGNORECASE | re.MULTILINE)
        if match is None:
            continue
        mileage = parse_mileage_candidate(match.group("value"))
        if mileage is not None:
            break

    if mileage is None:
        vehicle_lines = [normalize_line(line) for line in section_text.splitlines() if normalize_line(line)]
        for index, line in enumerate(vehicle_lines):
            window = line
            if re.search(r"пробег|одометр", line, re.IGNORECASE) and index + 1 < len(vehicle_lines):
                window = f"{line} {vehicle_lines[index + 1]}"
            for pattern in VEHICLE_ROW_MILEAGE_PATTERNS:
                match = re.search(pattern, window, re.IGNORECASE | re.MULTILINE)
                if match is None:
                    continue
                mileage = parse_mileage_candidate(match.group(1))
                if mileage is not None:
                    break
            if mileage is not None:
                break

    return plate_number, vin, mileage


def extract_service_candidate_from_text(text: str) -> Optional[str]:
    text_head = text[:2000]
    for pattern in SERVICE_CANDIDATE_PATTERNS:
        match = pattern.search(text_head)
        if match is None:
            continue
        candidate = normalize_service_candidate(match.group("value"))
        if not candidate:
            continue
        candidate = re.split(
            r"\b(?:инн|кпп|адрес|тел(?:ефон)?|заказчик|плательщик|автомобиль|шасси|vin|договор|документ|заказ[- ]наряд|акт)\b",
            candidate,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip(" ,.;:-")
        if candidate:
            return candidate[:200]
    return None


def build_section_body_pattern(markers: tuple[str, ...], stop_markers: tuple[str, ...]) -> re.Pattern[str]:
    marker_pattern = "|".join(re.escape(marker.rstrip(":")) + ":?" for marker in markers)
    stop_pattern = "|".join(re.escape(marker) for marker in stop_markers)
    return re.compile(
        rf"(?:^|\b)(?:{marker_pattern})\b\s*(?P<body>.+?)(?=(?:\b(?:{stop_pattern})\b)|$)",
        re.IGNORECASE | re.DOTALL,
    )


def tokenize_inline_section(section_text: str) -> list[str]:
    return [token for token in re.split(r"\s+", normalize_line(section_text)) if token]


def normalize_token_for_unit(token: str) -> str:
    return token.lower().strip(".,;:!?)(")


def normalize_ocr_code_token(value: str) -> str:
    return normalize_text(value).translate(OCR_TOKEN_CHAR_REPLACEMENTS)


def normalize_unit_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_token_for_unit(value)
    compact_value = normalized_value.replace(" ", "")
    translated_value = normalize_ocr_code_token(compact_value).lower()
    translated_value = translated_value.replace(".", ".").replace("/", "/")
    return (
        UNIT_ALIASES.get(compact_value)
        or UNIT_ALIASES.get(translated_value)
        or compact_value
        or None
    )


def normalize_article_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_ocr_code_token(value).upper()
    normalized_value = re.sub(r"[^A-Z0-9/_-]+", "", normalized_value)
    return normalized_value or None


def split_work_code_and_name(value: str) -> tuple[Optional[str], str]:
    normalized_value = normalize_text(value)
    parts = normalized_value.split(maxsplit=1)
    if len(parts) == 2 and WORK_CODE_TOKEN_PATTERN.fullmatch(parts[0]):
        return normalize_article_value(parts[0]), parts[1]
    return None, normalized_value


def is_quantity_token(token: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:[.,]\d+)?", token))


def is_amount_token(token: str) -> bool:
    return parse_amount(token) is not None


def parse_inline_item_sequence(section_text: str, target: str) -> list[dict[str, object]]:
    tokens = tokenize_inline_section(section_text)
    items: list[dict[str, object]] = []
    start_index = 0

    while start_index < len(tokens):
        matched = False
        for quantity_index in range(start_index + 1, len(tokens)):
            if not is_quantity_token(tokens[quantity_index]):
                continue

            amount_start_index = quantity_index + 1
            unit_token: Optional[str] = None
            normalized_candidate_unit = (
                normalize_unit_name(tokens[amount_start_index]) if amount_start_index < len(tokens) else None
            )
            if normalized_candidate_unit in ITEM_UNIT_MARKERS:
                unit_token = normalized_candidate_unit
                amount_start_index += 1

            if amount_start_index + 1 >= len(tokens):
                continue
            if not is_amount_token(tokens[amount_start_index]) or not is_amount_token(tokens[amount_start_index + 1]):
                continue

            prefix_tokens = tokens[start_index:quantity_index]
            if not prefix_tokens:
                continue

            payload_text = " ".join(prefix_tokens)
            if any(marker in payload_text.lower() for marker in SECTION_FOOTER_MARKERS):
                return items

            quantity = parse_decimal_value(tokens[quantity_index])
            price = parse_amount(tokens[amount_start_index])
            total = parse_amount(tokens[amount_start_index + 1])
            if quantity is None or price is None or total is None:
                continue

            payload: Optional[dict[str, object]]
            if target == "works":
                work_code, work_name = split_work_code_and_name(payload_text)
                payload = {
                    "work_code": work_code,
                    "work_name": work_name[:500],
                    "quantity": quantity,
                    "unit_name": normalize_unit_name(unit_token),
                    "price": price,
                    "line_total": total,
                }
            else:
                article = None
                name_tokens = prefix_tokens
                if len(prefix_tokens) > 1 and ARTICLE_TOKEN_PATTERN.fullmatch(prefix_tokens[0]):
                    article = normalize_article_value(prefix_tokens[0])
                    name_tokens = prefix_tokens[1:]
                part_name = " ".join(name_tokens).strip()
                if not part_name:
                    continue
                payload = {
                    "article": article,
                    "part_name": part_name[:500],
                    "quantity": quantity,
                    "unit_name": normalize_unit_name(unit_token),
                    "price": price,
                    "line_total": total,
                }

            items.append(payload)
            start_index = amount_start_index + 2
            matched = True
            break

        if not matched:
            break

    return items


def extract_inline_section_items(text: str) -> dict[str, list[dict[str, object]]]:
    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    normalized_text = normalize_line(text.replace("\n", " "))

    work_pattern = build_section_body_pattern(
        WORK_SECTION_MARKERS,
        PART_SECTION_MARKERS + SECTION_FOOTER_MARKERS,
    )
    part_pattern = build_section_body_pattern(
        PART_SECTION_MARKERS,
        SECTION_FOOTER_MARKERS,
    )

    work_match = work_pattern.search(normalized_text)
    if work_match:
        works = parse_inline_item_sequence(work_match.group("body"), "works")

    part_match = part_pattern.search(normalized_text)
    if part_match:
        parts = parse_inline_item_sequence(part_match.group("body"), "parts")

    return {"works": works, "parts": parts}


def extract_line_items(text: str) -> dict[str, list[dict[str, object]]]:
    works: list[dict[str, object]] = []
    parts: list[dict[str, object]] = []
    current_section: Optional[str] = None

    for raw_line in text.splitlines():
        line = normalize_line(raw_line)
        if not line:
            continue

        lower_line = line.lower()
        if any(marker in lower_line for marker in WORK_SECTION_MARKERS):
            current_section = "works"
            if lower_line.startswith("работа:"):
                payload = parse_work_line(line.split(":", 1)[1].strip())
                if payload:
                    works.append(payload)
            continue

        if any(marker in lower_line for marker in PART_SECTION_MARKERS):
            current_section = "parts"
            if lower_line.startswith("запчасть:"):
                payload = parse_part_line(line.split(":", 1)[1].strip())
                if payload:
                    parts.append(payload)
            continue

        if current_section == "works":
            payload = parse_work_line(line)
            if payload:
                works.append(payload)
                continue

        if current_section == "parts":
            payload = parse_part_line(line)
            if payload:
                parts.append(payload)
                continue

        if lower_line.startswith("работа:"):
            payload = parse_work_line(line.split(":", 1)[1].strip())
            if payload:
                works.append(payload)
            continue

        if lower_line.startswith("запчасть:"):
            payload = parse_part_line(line.split(":", 1)[1].strip())
            if payload:
                parts.append(payload)

    if works or parts:
        return {"works": works, "parts": parts}

    inline_items = extract_inline_section_items(text)
    return inline_items


def parse_work_line(line: str) -> Optional[dict[str, object]]:
    match = LINE_ITEM_PATTERN.match(line)
    if not match:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    total = parse_amount(match.group("total"))
    work_code, name = split_work_code_and_name(normalize_text(match.group("name")))
    if quantity is None or price is None or total is None or not name:
        return None

    return {
        "work_code": work_code,
        "work_name": name[:500],
        "quantity": quantity,
        "unit_name": normalize_unit_name(match.group("unit")),
        "price": price,
        "line_total": total,
    }


def parse_part_line(line: str) -> Optional[dict[str, object]]:
    match = PART_LINE_WITH_ARTICLE_PATTERN.match(line)
    article = None
    if match is None:
        match = LINE_ITEM_PATTERN.match(line)
    else:
        article = normalize_text(match.group("article"))

    if match is None:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    total = parse_amount(match.group("total"))
    name = normalize_text(match.group("name"))
    if quantity is None or price is None or total is None or not name:
        return None

    return {
        "article": normalize_article_value(article),
        "part_name": name[:500],
        "quantity": quantity,
        "unit_name": normalize_unit_name(match.groupdict().get("unit")),
        "price": price,
        "line_total": total,
    }


def is_service_name_suspicious(value: str) -> bool:
    normalized_value = normalize_line(value).lower()
    if not normalized_value:
        return True
    if any(marker in normalized_value for marker in SERVICE_NAME_BLOCKLIST):
        return True
    if len(re.findall(r"\d", normalized_value)) >= 6:
        return True
    if re.search(r"\d[\d\s]*(?:[.,]\d{2})", normalized_value):
        return True
    return False


def summarize_line_totals(extracted_items: dict[str, list[dict[str, object]]]) -> tuple[Optional[float], Optional[float]]:
    works = extracted_items.get("works") or []
    parts = extracted_items.get("parts") or []
    works_total = round(sum(float(item["line_total"]) for item in works), 2) if works else None
    parts_total = round(sum(float(item["line_total"]) for item in parts), 2) if parts else None
    return works_total, parts_total


def amounts_match(left: Optional[float], right: Optional[float], tolerance: float = 0.01) -> bool:
    if left is None or right is None:
        return False
    return abs(left - right) <= tolerance


def reconcile_header_totals_with_line_items(
    extracted_fields: dict[str, object],
    extracted_items: dict[str, list[dict[str, object]]],
    confidence_map: dict[str, float],
) -> list[str]:
    notes: list[str] = []
    works_total_from_lines, parts_total_from_lines = summarize_line_totals(extracted_items)

    if works_total_from_lines is not None and "work_total" not in extracted_fields:
        extracted_fields["work_total"] = works_total_from_lines
        confidence_map["work_total"] = 0.68
        notes.append("work_total_restored_from_lines")

    if parts_total_from_lines is not None and "parts_total" not in extracted_fields:
        extracted_fields["parts_total"] = parts_total_from_lines
        confidence_map["parts_total"] = 0.68
        notes.append("parts_total_restored_from_lines")

    grand_total = float(extracted_fields["grand_total"]) if "grand_total" in extracted_fields else None
    vat_total = float(extracted_fields.get("vat_total", 0) or 0) if "vat_total" in extracted_fields else 0.0
    if grand_total is None:
        return notes

    if works_total_from_lines is not None and parts_total_from_lines is not None:
        inferred_grand_total = round(works_total_from_lines + parts_total_from_lines + vat_total, 2)
        if amounts_match(inferred_grand_total, grand_total):
            current_work_total = float(extracted_fields["work_total"]) if "work_total" in extracted_fields else None
            current_parts_total = float(extracted_fields["parts_total"]) if "parts_total" in extracted_fields else None

            if not amounts_match(current_work_total, works_total_from_lines):
                extracted_fields["work_total"] = works_total_from_lines
                confidence_map["work_total"] = max(confidence_map.get("work_total", 0), 0.68)
                notes.append("work_total_aligned_with_lines")

            if not amounts_match(current_parts_total, parts_total_from_lines):
                extracted_fields["parts_total"] = parts_total_from_lines
                confidence_map["parts_total"] = max(confidence_map.get("parts_total", 0), 0.68)
                notes.append("parts_total_aligned_with_lines")

    return notes


def enrich_work_payloads_with_labor_norms(
    db: Session,
    works_payload: list[dict[str, object]],
    applicability: LaborNormApplicability,
) -> tuple[list[str], LaborNormEnrichmentSummary]:
    notes: list[str] = []
    matched_count = 0
    unmatched_count = 0
    for item in works_payload:
        work_name = str(item.get("work_name") or "").strip()
        if not work_name:
            continue

        work_code = normalize_labor_norm_code(str(item.get("work_code"))) if item.get("work_code") else None
        if work_code:
            item["work_code"] = work_code

        reference_payload = item.get("reference_payload")
        if not isinstance(reference_payload, dict):
            reference_payload = {}
        reference_payload["normalized_work_name"] = build_normalized_name(work_name)
        reference_payload["labor_norm_applicable"] = applicability.eligible
        reference_payload["labor_norm_scope"] = applicability.scope
        reference_payload["labor_norm_applicability_reason_code"] = applicability.reason_code
        reference_payload["labor_norm_applicability_reason"] = applicability.reason
        if applicability.catalog_name:
            reference_payload["labor_norm_catalog_name"] = applicability.catalog_name
        if applicability.brand_family:
            reference_payload["labor_norm_brand_family"] = applicability.brand_family
        if item.get("standard_hours") is not None:
            try:
                reference_payload["document_standard_hours"] = float(item["standard_hours"])
            except (TypeError, ValueError):
                reference_payload.pop("document_standard_hours", None)

        if not applicability.eligible:
            item["reference_payload"] = reference_payload
            continue

        match = find_best_labor_norm_match(
            db,
            work_code=work_code,
            work_name=work_name,
            scope=applicability.scope,
        )
        if match is None:
            item["reference_payload"] = reference_payload
            unmatched_count += 1
            continue

        if not item.get("work_code"):
            item["work_code"] = match.norm.code
        reference_payload.update(
            {
                "labor_norm_id": match.norm.id,
                "labor_norm_code": match.norm.code,
                "labor_norm_scope": match.norm.scope,
                "labor_norm_catalog_name": match.norm.catalog_name,
                "labor_norm_brand_family": match.norm.brand_family,
                "labor_norm_name": match.norm.name_ru,
                "labor_norm_category": match.norm.category,
                "labor_norm_standard_hours": float(match.norm.standard_hours),
                "labor_norm_match_score": match.score,
                "labor_norm_matched_by": match.matched_by,
            }
        )
        item["reference_payload"] = reference_payload
        notes.append(f"labor_norm_match:{match.norm.code}")
        matched_count += 1

    if works_payload and not applicability.eligible:
        notes.append(f"labor_norm_skipped:{applicability.reason_code}")
    elif works_payload and matched_count == 0:
        notes.append("labor_norm_match_missing")

    return notes, LaborNormEnrichmentSummary(
        matched_count=matched_count,
        unmatched_count=unmatched_count,
    )


def build_standard_hours_checks(
    works_payload: list[dict[str, object]],
) -> list[dict[str, object]]:
    checks: list[dict[str, object]] = []
    for item in works_payload:
        reference_payload = item.get("reference_payload")
        if not isinstance(reference_payload, dict):
            reference_payload = {}
        normalized_unit_name = normalize_unit_name(str(item.get("unit_name")) if item.get("unit_name") else None)
        actual_hours = item.get("actual_hours")
        if actual_hours is None and normalized_unit_name in {"нч", "ч"} and item.get("quantity") is not None:
            actual_hours = float(item["quantity"])
        document_standard_hours = reference_payload.get("document_standard_hours")
        if document_standard_hours is None:
            document_standard_hours = item.get("standard_hours")
        catalog_standard_hours = reference_payload.get("labor_norm_standard_hours")

        actual_value: Optional[float] = None
        if actual_hours is not None:
            try:
                actual_value = float(actual_hours)
            except (TypeError, ValueError):
                actual_value = None

        document_standard_value: Optional[float] = None
        if document_standard_hours is not None:
            try:
                document_standard_value = float(document_standard_hours)
            except (TypeError, ValueError):
                document_standard_value = None

        catalog_standard_value: Optional[float] = None
        if catalog_standard_hours is not None:
            try:
                catalog_standard_value = float(catalog_standard_hours)
            except (TypeError, ValueError):
                catalog_standard_value = None

        comparison_standard_value = document_standard_value if document_standard_value is not None else catalog_standard_value
        if (
            actual_value is not None
            and comparison_standard_value is not None
            and comparison_standard_value > 0
            and actual_value > round(comparison_standard_value * 1.1, 2)
        ):
            checks.append(
                {
                    "check_type": "ocr_standard_hours_exceeded",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Фактические часы превышают норматив",
                    "details": (
                        f"{item.get('work_name', 'Работа')} · факт {actual_value:.2f} ч, "
                        f"норма {comparison_standard_value:.2f} ч"
                    ),
                    "payload": {
                        "work_code": item.get("work_code"),
                        "work_name": item.get("work_name"),
                        "actual_hours": actual_value,
                        "standard_hours": comparison_standard_value,
                        "document_standard_hours": document_standard_value,
                        "catalog_standard_hours": catalog_standard_value,
                        "reference_payload": reference_payload,
                    },
                }
            )

        if (
            document_standard_value is not None
            and catalog_standard_value is not None
            and document_standard_value - catalog_standard_value > 0.01
        ):
            checks.append(
                {
                    "check_type": "ocr_document_standard_hours_exceeded",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Норма в заказ-наряде выше нормы справочника",
                    "details": (
                        f"{item.get('work_name', 'Работа')} · в документе {document_standard_value:.2f} ч, "
                        f"в справочнике {catalog_standard_value:.2f} ч"
                    ),
                    "payload": {
                        "work_code": item.get("work_code"),
                        "work_name": item.get("work_name"),
                        "document_standard_hours": document_standard_value,
                        "catalog_standard_hours": catalog_standard_value,
                        "reference_payload": reference_payload,
                    },
                }
            )
    return checks


def decode_pdf_literal(raw_text: bytes) -> bytes:
    return (
        raw_text.replace(b"\\(", b"(")
        .replace(b"\\)", b")")
        .replace(b"\\n", b"\n")
        .replace(b"\\r", b"\r")
        .replace(b"\\t", b"\t")
        .replace(b"\\\\", b"\\")
    )


def extract_pdf_stream_text(page) -> str:
    content = page.get_contents()
    if content is None:
        return ""

    contents = content if isinstance(content, list) else [content]
    literals = []
    for item in contents:
        raw = item.get_data()
        matches = re.findall(rb"\((?:\\.|[^\\)])*\)", raw)
        for match in matches:
            literals.append(decode_pdf_literal(match[1:-1]))

    decoded_variants = []
    for encoding in ("utf-8", "cp1251", "latin1"):
        try:
            decoded_variants.append("\n".join(part.decode(encoding, errors="ignore") for part in literals))
        except LookupError:
            continue

    scored_variants = sorted(
        decoded_variants,
        key=lambda item: (
            len(re.findall(r"[А-Яа-яA-Za-z0-9]", item)),
            len(item),
        ),
        reverse=True,
    )
    return scored_variants[0].strip() if scored_variants else ""


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(path.as_posix())
    chunks = []
    for page in reader.pages:
        page_text = (page.extract_text() or "").strip()
        stream_text = extract_pdf_stream_text(page)
        if score_text_quality(stream_text) > score_text_quality(page_text):
            chunks.append(stream_text)
        else:
            chunks.append(page_text)
    return "\n".join(filter(None, chunks)).strip()


def run_vision_ocr(image_paths: list[Path]) -> dict[str, str]:
    if not image_paths:
        return {}
    if not is_vision_ocr_available():
        raise RuntimeError("Apple Vision OCR is not available in the current environment")

    command = ["swift", VISION_OCR_SCRIPT.as_posix(), *[path.as_posix() for path in image_paths]]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Vision OCR command failed")

    payload = json.loads(result.stdout)
    return {item["path"]: item["text"] for item in payload.get("results", [])}


def save_pillow_optimized_image(source_path: Path, output_path: Path) -> bool:
    if not is_pillow_available():
        return False

    try:
        with Image.open(source_path) as image:
            rgba_image = image.convert("RGBA")
            alpha_channel = rgba_image.getchannel("A")
            alpha_bbox = alpha_channel.getbbox()

            background = Image.new("RGBA", rgba_image.size, (255, 255, 255, 255))
            rgb_image = Image.alpha_composite(background, rgba_image).convert("RGB")

            grayscale_image = rgb_image.convert("L")
            diff_image = ImageChops.difference(grayscale_image, Image.new("L", grayscale_image.size, 255))
            content_bbox = diff_image.point(lambda value: 255 if value > 12 else 0).getbbox()

            if alpha_bbox is not None:
                content_bbox = alpha_bbox if content_bbox is None else (
                    min(alpha_bbox[0], content_bbox[0]),
                    min(alpha_bbox[1], content_bbox[1]),
                    max(alpha_bbox[2], content_bbox[2]),
                    max(alpha_bbox[3], content_bbox[3]),
                )

            if content_bbox is not None:
                left, top, right, bottom = content_bbox
                padding = max(24, int(max(rgb_image.size) * 0.03))
                crop_box = (
                    max(0, left - padding),
                    max(0, top - padding),
                    min(rgb_image.width, right + padding),
                    min(rgb_image.height, bottom + padding),
                )
                rgb_image = rgb_image.crop(crop_box)

            longest_side = max(rgb_image.size)
            if longest_side and longest_side < 2400:
                scale = 2400 / float(longest_side)
                resized_size = (
                    max(1, int(round(rgb_image.width * scale))),
                    max(1, int(round(rgb_image.height * scale))),
                )
                rgb_image = rgb_image.resize(resized_size, Image.Resampling.LANCZOS)

            rgb_image.save(output_path, format="JPEG", quality=95, optimize=True)
            return True
    except Exception:
        return False


def optimize_existing_image_for_ocr(path: Path) -> None:
    temporary_output_path = path.with_name(f"{path.stem}_optimized.jpg")
    if save_pillow_optimized_image(path, temporary_output_path):
        temporary_output_path.replace(path)


def preprocess_image_for_ocr(path: Path) -> tuple[tempfile.TemporaryDirectory, Path]:
    temp_dir = tempfile.TemporaryDirectory()
    processed_path = Path(temp_dir.name) / f"{path.stem}_ocr.jpg"
    if save_pillow_optimized_image(path, processed_path):
        return temp_dir, processed_path

    command = [
        "sips",
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        "best",
        "-Z",
        "2400",
        path.as_posix(),
        "--out",
        processed_path.as_posix(),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        temp_dir.cleanup()
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Failed to preprocess image for OCR")

    optimize_existing_image_for_ocr(processed_path)
    return temp_dir, processed_path


def extract_image_text(path: Path) -> str:
    temp_dir, processed_path = preprocess_image_for_ocr(path)
    try:
        ocr_results = run_vision_ocr([processed_path])
        return select_best_text_variant(ocr_results.get(processed_path.as_posix(), ""))
    finally:
        temp_dir.cleanup()


def render_pdf_pages_for_ocr(path: Path, max_pages: int = 5) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    temp_dir = tempfile.TemporaryDirectory()
    image_paths: list[Path] = []
    reader = PdfReader(path.as_posix())
    page_count = max(1, min(len(reader.pages), max_pages))
    for page_index in range(page_count):
        single_page_pdf_path = Path(temp_dir.name) / f"ocr_page_{page_index + 1}.pdf"
        image_path = Path(temp_dir.name) / f"ocr_page_{page_index + 1}.jpg"
        writer = PdfWriter()
        writer.add_page(reader.pages[page_index])
        with single_page_pdf_path.open("wb") as output_stream:
            writer.write(output_stream)
        command = [
            "sips",
            "-s",
            "format",
            "jpeg",
            "-s",
            "formatOptions",
            "best",
            "-Z",
            "2400",
            single_page_pdf_path.as_posix(),
            "--out",
            image_path.as_posix(),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            temp_dir.cleanup()
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Failed to render PDF page for OCR")
        image_paths.append(image_path)

    return temp_dir, image_paths


def extract_scanned_pdf_text(path: Path) -> str:
    temp_dir, image_paths = render_pdf_pages_for_ocr(path)
    try:
        ocr_results = run_vision_ocr(image_paths)
        chunks = [select_best_text_variant(ocr_results.get(image_path.as_posix(), "")) for image_path in image_paths]
        return "\n".join(filter(None, chunks)).strip()
    finally:
        temp_dir.cleanup()


def extract_document_text(path: Path, source_type: str) -> tuple[str, str, Optional[str]]:
    if source_type == "image":
        if not is_vision_ocr_available():
            return "", "manual_review", "image_ocr_unavailable"
        text = extract_image_text(path)
        return text, "image_vision_ocr", None if text else "image_text_not_found"

    text = select_best_text_variant(extract_pdf_text(path))
    extracted_from = "pdf_text"
    failure_reason = None

    if score_text_quality(text)[0] >= 2 or score_text_quality(text)[1] >= 6:
        return text, extracted_from, None

    if not is_vision_ocr_available():
        return text, extracted_from, "pdf_ocr_unavailable" if not text else None

    scanned_text = extract_scanned_pdf_text(path)
    if score_text_quality(scanned_text) > score_text_quality(text):
        return scanned_text, "pdf_vision_ocr", None if scanned_text else "pdf_text_not_found"

    if not text and not scanned_text:
        failure_reason = "pdf_text_not_found"
    return text or scanned_text, extracted_from if text else "pdf_vision_ocr", failure_reason


def parse_document_text(text: str, db: Session | None = None, *, profile_scope: str | None = None) -> dict[str, object]:
    text = select_best_text_variant(text)
    header_text = extract_header_text(text)
    vehicle_section_text = extract_vehicle_section_text(text)
    field_search_texts: list[str] = []
    for candidate in (vehicle_section_text, header_text):
        normalized_candidate = normalize_text(candidate)
        if normalized_candidate and normalized_candidate not in field_search_texts:
            field_search_texts.append(normalized_candidate)
    extracted_fields = {}
    confidence_map = {}
    manual_review_reasons = []
    normalization_notes = []
    extracted_items = extract_line_items(text)
    rule_map = group_ocr_rules_by_field(load_active_ocr_rules(db, profile_scope=profile_scope)) if db is not None else {}
    section_plate_number, section_vin, section_mileage = extract_vehicle_identifiers_from_section(text)

    order_number, order_number_confidence, _ = extract_header_field(
        header_text,
        target_field="order_number",
        fallback_patterns=ORDER_PATTERNS,
        fallback_parser="raw",
        fallback_confidence=0.74,
        rule_map=rule_map,
    )
    if isinstance(order_number, str) and is_plausible_order_number(order_number):
        extracted_fields["order_number"] = order_number
        confidence_map["order_number"] = float(order_number_confidence or 0.74)
    else:
        manual_review_reasons.append("order_number_missing")

    repair_date, repair_date_confidence, repair_date_invalid = extract_header_field(
        header_text,
        target_field="repair_date",
        fallback_patterns=DATE_PATTERNS,
        fallback_parser="date",
        fallback_confidence=0.7,
        rule_map=rule_map,
    )
    if isinstance(repair_date, str) and repair_date:
        extracted_fields["repair_date"] = repair_date
        confidence_map["repair_date"] = float(repair_date_confidence or 0.7)
    elif repair_date_invalid:
        manual_review_reasons.append("repair_date_invalid")
    else:
        manual_review_reasons.append("repair_date_missing")

    if section_mileage is not None:
        extracted_fields["mileage"] = section_mileage
        confidence_map["mileage"] = 0.9
    else:
        mileage_found = False
        for field_text in field_search_texts:
            mileage, mileage_confidence, _ = extract_header_field(
                field_text,
                target_field="mileage",
                fallback_patterns=MILEAGE_PATTERNS,
                fallback_parser="digits_int",
                fallback_confidence=0.82,
                rule_map=rule_map,
            )
            if isinstance(mileage, int):
                extracted_fields["mileage"] = mileage
                confidence_map["mileage"] = float(mileage_confidence or 0.82)
                mileage_found = True
                break
        if not mileage_found:
            manual_review_reasons.append("mileage_missing")

    if section_plate_number:
        extracted_fields["plate_number"] = section_plate_number
        confidence_map["plate_number"] = 0.9
    else:
        for field_text in field_search_texts:
            plate_number, plate_number_confidence, _ = extract_header_field(
                field_text,
                target_field="plate_number",
                fallback_patterns=PLATE_PATTERNS,
                fallback_parser="raw",
                fallback_confidence=0.77,
                rule_map=rule_map,
            )
            if isinstance(plate_number, str) and plate_number:
                normalized_plate = find_plate_candidate(plate_number) or normalize_identifier_token(plate_number)
                if normalized_plate:
                    extracted_fields["plate_number"] = normalized_plate
                    confidence_map["plate_number"] = float(plate_number_confidence or 0.77)
                    break

    if section_vin:
        extracted_fields["vin"] = section_vin
        confidence_map["vin"] = 0.92
    else:
        for field_text in field_search_texts:
            vin, vin_confidence, _ = extract_header_field(
                field_text,
                target_field="vin",
                fallback_patterns=VIN_PATTERNS,
                fallback_parser="raw",
                fallback_confidence=0.88,
                rule_map=rule_map,
            )
            if isinstance(vin, str) and vin:
                normalized_vin = find_vin_candidate(vin) or normalize_identifier_token(vin)
                if normalized_vin:
                    extracted_fields["vin"] = normalized_vin
                    confidence_map["vin"] = float(vin_confidence or 0.88)
                    break

    resolved_service_match = find_service_name_in_text(text, db=db) if db is not None else find_service_name_in_text(text)
    service_name, service_name_confidence, _ = extract_header_field(
        text,
        target_field="service_name",
        fallback_patterns=SERVICE_PATTERNS,
        fallback_parser="raw",
        fallback_confidence=0.58,
        rule_map=rule_map,
    )
    service_candidate = normalize_service_candidate(service_name) if isinstance(service_name, str) else None
    labeled_service_candidate = extract_service_candidate_from_text(text)
    if labeled_service_candidate and (service_candidate is None or not normalize_service_key(service_candidate)):
        service_candidate = labeled_service_candidate

    if resolved_service_match is not None:
        extracted_fields["service_name"] = resolved_service_match[0]
        confidence_map["service_name"] = 0.92
        normalization_notes.append(f"Сервис распознан по тексту документа: {resolved_service_match[1]}")
    elif service_candidate:
        if is_service_name_suspicious(service_candidate):
            manual_review_reasons.append("service_name_suspicious")
        else:
            extracted_fields["service_name"] = service_candidate[:120]
            confidence_map["service_name"] = float(service_name_confidence or 0.58)

    for field_name, patterns in TOTAL_PATTERNS.items():
        amount, amount_confidence, _ = extract_header_field(
            text,
            target_field=field_name,
            fallback_patterns=patterns,
            fallback_parser="amount",
            fallback_confidence=0.8 if field_name == "grand_total" else 0.72,
            rule_map=rule_map,
        )
        if not isinstance(amount, (int, float)):
            continue
        extracted_fields[field_name] = float(amount)
        confidence_map[field_name] = float(amount_confidence or (0.8 if field_name == "grand_total" else 0.72))

    normalization_notes.extend(
        reconcile_header_totals_with_line_items(
            extracted_fields=extracted_fields,
            extracted_items=extracted_items,
            confidence_map=confidence_map,
        )
    )

    return {
        "extracted_fields": extracted_fields,
        "extracted_items": extracted_items,
        "confidence_map": confidence_map,
        "manual_review_reasons": manual_review_reasons,
        "normalization_notes": normalization_notes,
    }


def load_document_for_processing(db: Session, document_id: int) -> Optional[Document]:
    stmt = (
        select(Document)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.versions),
        )
        .where(Document.id == document_id)
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def average_confidence(confidence_map: dict[str, float]) -> Optional[float]:
    if not confidence_map:
        return None
    return round(sum(confidence_map.values()) / len(confidence_map), 2)


def resolve_service(db: Session, service_name: str) -> Service:
    service = resolve_service_by_name(db, service_name)
    if service is None:
        raise ValueError(f"Unknown service: {service_name}")
    return service


def replace_ocr_checks(db: Session, repair_id: int, checks: list[dict[str, object]]) -> None:
    db.execute(delete(RepairCheck).where(RepairCheck.repair_id == repair_id, RepairCheck.check_type.like("ocr_%")))
    for item in checks:
        db.add(
            RepairCheck(
                repair_id=repair_id,
                check_type=str(item["check_type"]),
                severity=item["severity"],
                title=str(item["title"]),
                details=item.get("details"),
                calculation_payload=item.get("payload"),
            )
        )


def replace_repair_lines(
    db: Session,
    repair: Repair,
    works_payload: list[dict[str, object]],
    parts_payload: list[dict[str, object]],
) -> None:
    db.execute(delete(RepairWork).where(RepairWork.repair_id == repair.id))
    db.execute(delete(RepairPart).where(RepairPart.repair_id == repair.id))

    for item in works_payload:
        normalized_unit_name = normalize_unit_name(str(item.get("unit_name")) if item.get("unit_name") else None)
        reference_payload = item.get("reference_payload")
        if not isinstance(reference_payload, dict):
            reference_payload = {}
        reference_payload.update(
            {
                "source": "ocr",
                "unit_name": normalized_unit_name,
                "normalized": True,
            }
        )
        db.add(
            RepairWork(
                repair_id=repair.id,
                work_code=str(item["work_code"]) if item.get("work_code") else None,
                work_name=str(item["work_name"]),
                quantity=float(item["quantity"]),
                actual_hours=float(item["quantity"]) if normalized_unit_name in {"нч", "ч"} else None,
                standard_hours=float(item["standard_hours"]) if item.get("standard_hours") is not None else None,
                price=float(item["price"]),
                line_total=float(item["line_total"]),
                status=CatalogStatus.PRELIMINARY,
                reference_payload=reference_payload,
            )
        )

    for item in parts_payload:
        normalized_unit_name = normalize_unit_name(str(item["unit_name"]) if item.get("unit_name") else None)
        db.add(
            RepairPart(
                repair_id=repair.id,
                article=normalize_article_value(str(item["article"])) if item.get("article") else None,
                part_name=str(item["part_name"]),
                quantity=float(item["quantity"]),
                unit_name=normalized_unit_name,
                price=float(item["price"]),
                line_total=float(item["line_total"]),
                status=CatalogStatus.PRELIMINARY,
            )
        )


def process_document(db: Session, document_id: int) -> ProcessingResult:
    document = load_document_for_processing(db, document_id)
    if document is None or document.repair is None:
        raise ValueError("Document not found or repair relation is incomplete")

    storage_path = get_storage_path(document.storage_key)
    job = ImportJob(
        document_id=document.id,
        import_type="document_ocr",
        source_filename=document.original_filename,
        status=ImportStatus.PROCESSING,
        summary={"document_id": document.id, "stage": "started"},
    )
    db.add(job)
    db.flush()

    try:
        if not storage_path.exists():
            raise FileNotFoundError(f"Source document file not found: {storage_path}")

        if document.kind in {DocumentKind.ATTACHMENT, DocumentKind.CONFIRMATION}:
            document.status = DocumentStatus.CONFIRMED
            document.review_queue_priority = 0
            document.ocr_confidence = None

            version_number = max([version.version_number for version in document.versions], default=0) + 1
            parsed_payload = {
                "processor": "document_storage_only_v1",
                "document_kind": document.kind.value,
                "ocr_skipped": True,
            }
            db.add(
                DocumentVersion(
                    document_id=document.id,
                    version_number=version_number,
                    storage_key=document.storage_key,
                    parsed_payload=parsed_payload,
                    field_confidence_map={},
                    change_summary="Stored without OCR",
                )
            )
            job.status = ImportStatus.COMPLETED
            job.summary = {
                "document_id": document.id,
                "document_kind": document.kind.value,
                "document_status": document.status.value,
                "ocr_skipped": True,
            }
            job.error_message = None
            db.commit()

            refreshed_document = load_document_for_processing(db, document.id)
            if refreshed_document is None:
                raise ValueError("Processed document could not be reloaded")
            return ProcessingResult(
                document=refreshed_document,
                job=job,
                message="Document stored without OCR",
            )

        text, extracted_from, extraction_failure_reason = extract_document_text(storage_path, document.source_type)
        profile_selection = select_ocr_profile_scope(db, document, text) if text else OcrProfileSelection(
            profile_scope="default",
            source="default",
            reason="Текст не извлечён, использован default",
        )
        parsed = parse_document_text(text, db=db, profile_scope=profile_selection.profile_scope) if text else {
            "extracted_fields": {},
            "extracted_items": {"works": [], "parts": []},
            "confidence_map": {},
            "manual_review_reasons": [extraction_failure_reason or "text_not_found"],
            "normalization_notes": [],
        }

        extracted_fields = parsed["extracted_fields"]
        extracted_items = parsed["extracted_items"]
        confidence_map = parsed["confidence_map"]
        manual_review_reasons = parsed["manual_review_reasons"]
        normalization_notes = parsed.get("normalization_notes", [])
        apply_document_metadata_fallbacks(
            document,
            extracted_fields=extracted_fields,
            confidence_map=confidence_map,
            manual_review_reasons=manual_review_reasons,
            normalization_notes=normalization_notes,
        )
        repair = document.repair
        auto_link_repair_vehicle_from_registry(
            db,
            repair,
            extracted_fields=extracted_fields,
            normalization_notes=normalization_notes,
        )
        enrich_vehicle_fields_from_repair(
            repair,
            extracted_fields=extracted_fields,
            confidence_map=confidence_map,
            normalization_notes=normalization_notes,
        )
        enrich_vehicle_fields_from_registry(
            db,
            extracted_fields=extracted_fields,
            confidence_map=confidence_map,
            normalization_notes=normalization_notes,
        )
        labor_norm_applicability = assess_labor_norm_applicability(db, repair.vehicle)
        labor_norm_notes, labor_norm_summary = enrich_work_payloads_with_labor_norms(
            db,
            extracted_items["works"],
            labor_norm_applicability,
        )
        normalization_notes.extend(labor_norm_notes)
        checks = []

        if "order_number" in extracted_fields:
            repair.order_number = str(extracted_fields["order_number"])
        if "repair_date" in extracted_fields:
            parsed_repair_date = parse_date_value(str(extracted_fields["repair_date"]).replace("-", "."))
            if parsed_repair_date is not None:
                repair.repair_date = parsed_repair_date
        if "mileage" in extracted_fields:
            repair.mileage = int(extracted_fields["mileage"])
        if "work_total" in extracted_fields:
            repair.work_total = float(extracted_fields["work_total"])
        if "parts_total" in extracted_fields:
            repair.parts_total = float(extracted_fields["parts_total"])
        if "vat_total" in extracted_fields:
            repair.vat_total = float(extracted_fields["vat_total"])
        if "grand_total" in extracted_fields:
            repair.grand_total = float(extracted_fields["grand_total"])
        if "service_name" in extracted_fields:
            service = resolve_service_by_name(db, str(extracted_fields["service_name"]))
            if service is not None:
                extracted_fields["service_name"] = service.name
                repair.service_id = service.id
            else:
                if "service_not_found" not in manual_review_reasons:
                    manual_review_reasons.append("service_not_found")
                normalization_notes.append(
                    f"Сервис из документа не найден в справочнике: {extracted_fields['service_name']}"
                )
        elif "service_name_missing" not in manual_review_reasons:
            manual_review_reasons.append("service_name_missing")

        replace_repair_lines(
            db,
            repair,
            works_payload=extracted_items["works"],
            parts_payload=extracted_items["parts"],
        )

        if "plate_number" in extracted_fields and repair.vehicle.plate_number:
            extracted_plate_compare = normalize_compare_token(str(extracted_fields["plate_number"]))
            vehicle_plate_compare = normalize_compare_token(repair.vehicle.plate_number)
            if extracted_plate_compare and vehicle_plate_compare and extracted_plate_compare != vehicle_plate_compare:
                checks.append(
                    {
                        "check_type": "ocr_vehicle_plate_mismatch",
                        "severity": CheckSeverity.WARNING,
                        "title": "Госномер в документе не совпадает с карточкой техники",
                        "details": (
                            f"В документе найден {extracted_fields['plate_number']}, "
                            f"в системе {repair.vehicle.plate_number}"
                        ),
                        "payload": {
                            "document_plate_number": extracted_fields["plate_number"],
                            "vehicle_plate_number": repair.vehicle.plate_number,
                        },
                    }
                )

        works_sum = round(sum(float(item["line_total"]) for item in extracted_items["works"]), 2)
        parts_sum = round(sum(float(item["line_total"]) for item in extracted_items["parts"]), 2)
        checks.extend(build_standard_hours_checks(extracted_items["works"]))
        if extracted_items["works"] and "work_total" in extracted_fields:
            if abs(works_sum - float(extracted_fields["work_total"])) > 0.01:
                checks.append(
                    {
                        "check_type": "ocr_work_lines_total_mismatch",
                        "severity": CheckSeverity.SUSPICIOUS,
                        "title": "Сумма строк работ не совпадает с итогом работ",
                        "details": "Нужна ручная проверка работ в заказ-наряде",
                        "payload": {
                            "lines_total": works_sum,
                            "header_total": float(extracted_fields["work_total"]),
                        },
                    }
                )

        if extracted_items["parts"] and "parts_total" in extracted_fields:
            if abs(parts_sum - float(extracted_fields["parts_total"])) > 0.01:
                checks.append(
                    {
                        "check_type": "ocr_part_lines_total_mismatch",
                        "severity": CheckSeverity.SUSPICIOUS,
                        "title": "Сумма строк запчастей не совпадает с итогом материалов",
                        "details": "Нужна ручная проверка состава материалов",
                        "payload": {
                            "lines_total": parts_sum,
                            "header_total": float(extracted_fields["parts_total"]),
                        },
                    }
                )

        if "grand_total" in extracted_fields:
            work_total = float(extracted_fields.get("work_total", 0) or 0)
            parts_total = float(extracted_fields.get("parts_total", 0) or 0)
            vat_total = float(extracted_fields.get("vat_total", 0) or 0)
            grand_total = float(extracted_fields["grand_total"])
            if work_total + parts_total + vat_total > grand_total + 0.01:
                checks.append(
                    {
                        "check_type": "ocr_total_mismatch",
                        "severity": CheckSeverity.SUSPICIOUS,
                        "title": "Сумма строк превышает итоговую сумму",
                        "details": "Нужна ручная проверка итогов заказ-наряда",
                        "payload": {
                            "work_total": work_total,
                            "parts_total": parts_total,
                            "vat_total": vat_total,
                            "grand_total": grand_total,
                        },
                    }
                )

        for reason in manual_review_reasons:
            checks.append(
                {
                    "check_type": f"ocr_{reason}",
                    "severity": CheckSeverity.WARNING,
                    "title": "Нужна ручная проверка OCR",
                    "details": reason,
                    "payload": {"reason": reason},
                }
            )

        replace_ocr_checks(db, repair.id, checks)

        recognized_fields_count = len(confidence_map)
        repair.is_preliminary = True
        repair.is_partially_recognized = recognized_fields_count < 4
        repair.status = RepairStatus.IN_REVIEW if recognized_fields_count else RepairStatus.OCR_ERROR

        if recognized_fields_count >= 4:
            document.status = DocumentStatus.RECOGNIZED
            message = "Document processed automatically"
        elif recognized_fields_count > 0:
            document.status = DocumentStatus.PARTIALLY_RECOGNIZED
            message = "Document processed partially and sent for review"
        elif document.source_type == "pdf":
            document.status = DocumentStatus.OCR_ERROR
            message = "Document processing did not extract text"
        else:
            document.status = DocumentStatus.NEEDS_REVIEW
            message = "Image uploaded; manual review is required"

        document.ocr_confidence = average_confidence(confidence_map)
        document.review_queue_priority = 100 if document.status != DocumentStatus.RECOGNIZED else 20

        version_number = max([version.version_number for version in document.versions], default=0) + 1
        text_excerpt = normalize_text(text.replace("\n", " "))[:500] if text else None
        parsed_payload = {
            "processor": "hybrid_document_ocr_v2",
            "ocr_profile_scope": profile_selection.profile_scope,
            "ocr_profile_source": profile_selection.source,
            "ocr_profile_reason": profile_selection.reason,
            "document_kind": document.kind.value,
            "extracted_from": extracted_from,
            "text_length": len(text),
            "text_excerpt": text_excerpt,
            "extracted_fields": extracted_fields,
            "extracted_items": extracted_items,
            "manual_review_reasons": manual_review_reasons,
            "normalization_notes": normalization_notes,
            "labor_norm_applicability": {
                "eligible": labor_norm_applicability.eligible,
                "scope": labor_norm_applicability.scope,
                "reason_code": labor_norm_applicability.reason_code,
                "reason": labor_norm_applicability.reason,
                "brand_family": labor_norm_applicability.brand_family,
                "catalog_name": labor_norm_applicability.catalog_name,
                "matched_count": labor_norm_summary.matched_count,
                "unmatched_count": labor_norm_summary.unmatched_count,
            },
        }
        db.add(
            DocumentVersion(
                document_id=document.id,
                version_number=version_number,
                storage_key=document.storage_key,
                parsed_payload=parsed_payload,
                field_confidence_map=confidence_map,
                change_summary=message,
            )
        )

        job.status = (
            ImportStatus.COMPLETED
            if document.status == DocumentStatus.RECOGNIZED
            else ImportStatus.COMPLETED_WITH_CONFLICTS
        )
        job.summary = {
            "document_id": document.id,
            "document_status": document.status.value,
            "recognized_fields_count": recognized_fields_count,
            "works_count": len(extracted_items["works"]),
            "parts_count": len(extracted_items["parts"]),
            "manual_review_reasons": manual_review_reasons,
            "normalization_notes": normalization_notes,
            "confidence": document.ocr_confidence,
        }
        job.error_message = None

        db.commit()
    except Exception as exc:
        document.status = DocumentStatus.OCR_ERROR
        document.review_queue_priority = 100
        document.ocr_confidence = 0
        document.repair.status = RepairStatus.OCR_ERROR
        replace_ocr_checks(
            db,
            document.repair.id,
            [
                {
                    "check_type": "ocr_processing_failed",
                    "severity": CheckSeverity.ERROR,
                    "title": "Ошибка автоматической обработки документа",
                    "details": str(exc),
                    "payload": {"error": str(exc)},
                }
            ],
        )
        job.status = ImportStatus.FAILED
        job.summary = {"document_id": document.id, "document_status": document.status.value}
        job.error_message = str(exc)
        db.commit()
        message = "Document processing failed"

    refreshed_document = load_document_for_processing(db, document.id)
    if refreshed_document is None:
        raise ValueError("Processed document could not be reloaded")
    return ProcessingResult(document=refreshed_document, job=job, message=message)
