from __future__ import annotations

import re
from typing import Optional

from app.application.documents.parser_helpers import normalize_ocr_code_token
from app.application.documents.runtime_text import normalize_text
from app.application.documents.text_utils import normalize_identifier_token, normalize_line
from app.application.documents.config import (
    CHASSIS_LABEL_PATTERNS,
    MILEAGE_LABEL_PATTERN,
    MILEAGE_SECTION_PATTERNS,
    ODOMETER_LABEL_PATTERN,
    PLATE_LABEL_PATTERNS,
    PLATE_PATTERNS,
    SERVICE_CANDIDATE_PATTERNS,
    VEHICLE_ROW_MILEAGE_PATTERNS,
    VEHICLE_SECTION_START_PATTERN,
    VEHICLE_SECTION_STOP_PATTERN,
    VIN_LABEL_PATTERNS,
    VIN_PATTERNS,
)


def first_match(patterns: list[str], text: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return normalize_text(match.group(1))
    return None


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


def normalize_plate_compare_token(value: str | None) -> Optional[str]:
    normalized = normalize_compare_token(value)
    if not normalized:
        return None

    if re.fullmatch(r"[A-Z]\d{3}[A-Z]{2}\d{2,3}", normalized):
        return normalized

    shifted_match = re.fullmatch(r"(\d{3})([A-Z]{3})(\d{2,3})", normalized)
    if shifted_match is None:
        return normalized

    digits, letters, region = shifted_match.groups()
    return f"{letters[0]}{digits}{letters[1:]}{region}"


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


def find_chassis_candidate(value: str | None) -> Optional[str]:
    if not value:
        return None
    normalized_value = normalize_ocr_code_token(normalize_text(value)).upper()
    for pattern in CHASSIS_LABEL_PATTERNS:
        match = re.search(pattern, normalized_value, re.IGNORECASE | re.MULTILINE)
        if match is None:
            continue
        normalized = normalize_identifier_token(match.group("value"))
        if normalized and 6 <= len(normalized) <= 17:
            return normalized
    standalone_match = re.search(r"(?<![A-Z0-9])([A-Z]\d{6,8})(?![A-Z0-9])", normalized_value)
    if standalone_match is not None:
        normalized = normalize_identifier_token(standalone_match.group(1))
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


def has_explicit_missing_mileage(text: str) -> bool:
    return bool(
        re.search(
            rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\s*[:№]?\s*[-—]+(?:\s|$)",
            text,
            re.IGNORECASE | re.MULTILINE,
        )
    )


def has_logistics_blank_mileage_field(text: str) -> bool:
    section_text = extract_vehicle_section_text(text)
    return bool(
        re.search(
            rf"(?:{MILEAGE_LABEL_PATTERN}|{ODOMETER_LABEL_PATTERN})(?:\s*\([^)]*\))?\s*[:№]?\s*(?:\r?\n\s*)?(?=Цена\s+автомототранспортного\s+средства)",
            section_text,
            re.IGNORECASE | re.MULTILINE,
        )
    )


def is_logistics_trailer_vehicle_context(text: str) -> bool:
    section_text = extract_vehicle_section_text(text)
    return bool(
        re.search(
            r"\b(?:п/п|полуприцеп|прицеп|koluman|orthaus|schmitz)\b",
            section_text,
            re.IGNORECASE,
        )
    )


def is_gruzovye_rezervy_invoice_only_document(text: str) -> bool:
    header_text = extract_header_text(text, limit=4000)
    if not re.search(r"(?:^|\n)\s*счет(?:\s+на\s+оплату)?\b", header_text, re.IGNORECASE):
        return False
    if re.search(r"\b(?:заказ[- ]наряд|наряд[- ]заказ|акт(?:\s+выполненных\s+работ)?)\b", text, re.IGNORECASE):
        return False
    if re.search(r"(?:^|\n)\s*виды\s+работ:\s*$", text, re.IGNORECASE | re.MULTILINE):
        return False
    return True


def is_leader_trak_invoice_only_document(text: str) -> bool:
    header_text = extract_header_text(text, limit=5000)
    if not (
        re.search(r"внимание!\s*оплата\s+данного\s+счета\s+означает", header_text, re.IGNORECASE)
        or re.search(r"(?:^|\n)\s*счет(?:\s+на\s+оплату)?\b", header_text, re.IGNORECASE)
    ):
        return False
    if re.search(r"\bнаряд[- ]заказ\b", text, re.IGNORECASE):
        return False
    if re.search(
        r"выполненные\s+сервисные\s+услуги\s+и\s+использованные\s+материалы",
        text,
        re.IGNORECASE,
    ):
        return False
    return True


def extract_vehicle_identifiers_from_section(text: str) -> tuple[Optional[str], Optional[str], Optional[int]]:
    section_text = extract_vehicle_section_text(text)
    plate_number = find_plate_candidate(find_pattern_value(PLATE_LABEL_PATTERNS, section_text))
    if plate_number is None:
        plate_number = find_plate_candidate(section_text)

    vin = find_vin_candidate(find_pattern_value(VIN_LABEL_PATTERNS, section_text))
    if vin is None:
        vin = find_vin_candidate(section_text)

    mileage: Optional[int] = None
    if not has_explicit_missing_mileage(section_text):
        for pattern in MILEAGE_SECTION_PATTERNS:
            match = re.search(pattern, section_text, re.IGNORECASE | re.MULTILINE)
            if match is None:
                continue
            mileage = parse_mileage_candidate(match.group("value"))
            if mileage is not None:
                break

        if mileage is None:
            vehicle_lines = [
                normalize_line(line)
                for line in section_text.splitlines()
                if normalize_line(line)
            ]
            for index, line in enumerate(vehicle_lines):
                window = line
                if re.search(r"пробег|одометр", line, re.IGNORECASE) and index + 1 < len(vehicle_lines):
                    window = f"{line} {vehicle_lines[index + 1]}"
                mileage_window = re.split(r"(?:пробег|одометр)", window, maxsplit=1, flags=re.IGNORECASE)
                search_window = mileage_window[1] if len(mileage_window) > 1 else window
                for pattern in VEHICLE_ROW_MILEAGE_PATTERNS:
                    match = re.search(pattern, search_window, re.IGNORECASE | re.MULTILINE)
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


def extract_ets_act_late_fragment(text: str) -> str:
    pattern = re.compile(r"Акт\s+выполненных\s+работ", re.IGNORECASE)
    matches = list(pattern.finditer(text))
    for match in reversed(matches):
        fragment = text[match.start(): match.start() + 5000]
        if re.search(r"Модель\s+автомобиля|Пробег\s*\(м/ч\)|VIN|Гос\.\s*номер", fragment, re.IGNORECASE):
            return fragment
    return ""
