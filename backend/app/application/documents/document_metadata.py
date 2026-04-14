from __future__ import annotations

from pathlib import Path
import re
from typing import Optional

from app.models.document import Document
from app.models.repair import Repair
from app.application.documents.field_extractors import first_match
from app.application.documents.config import (
    DATE_PATTERNS,
    FILENAME_SERVICE_PREFIXES,
    ORDER_PATTERNS,
    PLACEHOLDER_VEHICLE_EXTERNAL_ID,
    PLATE_PATTERNS,
    SERVICE_NAME_BLOCKLIST,
    SOURCE_PATH_KEY,
    VIN_PATTERNS,
)
from app.application.documents.text_utils import normalize_identifier_token, normalize_line, parse_date_value


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


def add_manual_review_reason(reasons: list[str], value: str) -> None:
    if value not in reasons:
        reasons.append(value)


def _is_service_name_suspicious(value: str) -> bool:
    normalized_value = normalize_line(value).lower()
    if not normalized_value:
        return True
    if any(marker in normalized_value for marker in SERVICE_NAME_BLOCKLIST):
        return True
    return False


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
        if service_name and not _is_service_name_suspicious(service_name):
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
    if vehicle is None or vehicle.external_id == PLACEHOLDER_VEHICLE_EXTERNAL_ID:
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
