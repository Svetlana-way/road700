from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.documents.field_extractors import (
    extract_vehicle_section_text,
    find_chassis_candidate,
    find_plate_candidate,
    find_vin_candidate,
    normalize_compare_token,
    normalize_plate_compare_token,
)
from app.models.document import Document
from app.models.enums import VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.vehicle import Vehicle
from app.application.documents.text_utils import normalize_identifier_token
from app.application.documents.config import PLACEHOLDER_VEHICLE_EXTERNAL_ID


def find_vehicle_by_identifiers(
    db: Session,
    *,
    plate_number: str | None,
    vin: str | None,
    chassis_number: str | None = None,
) -> Vehicle | None:
    normalized_plate = normalize_plate_compare_token(plate_number)
    normalized_vin = normalize_compare_token(vin)
    normalized_chassis = normalize_compare_token(chassis_number)
    if not normalized_plate and not normalized_vin and not normalized_chassis:
        return None

    vehicles = db.scalars(select(Vehicle)).all()
    exact_matches: dict[int, Vehicle] = {}
    partial_plate_matches: dict[int, Vehicle] = {}

    for vehicle in vehicles:
        if vehicle.external_id == PLACEHOLDER_VEHICLE_EXTERNAL_ID:
            continue
        if vehicle.status == VehicleStatus.ARCHIVED:
            continue
        vehicle_plate = normalize_plate_compare_token(vehicle.plate_number)
        vehicle_vin = normalize_compare_token(vehicle.vin)
        if normalized_vin and vehicle_vin == normalized_vin:
            exact_matches[vehicle.id] = vehicle
            continue
        if normalized_chassis and vehicle_vin and vehicle_vin.endswith(normalized_chassis):
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
        chassis_number=str(extracted_fields.get("chassis_number")) if extracted_fields.get("chassis_number") else None,
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
    if vehicle is None or vehicle.external_id != PLACEHOLDER_VEHICLE_EXTERNAL_ID:
        return

    matched_vehicle = find_vehicle_by_identifiers(
        db,
        plate_number=str(extracted_fields.get("plate_number")) if extracted_fields.get("plate_number") else None,
        vin=str(extracted_fields.get("vin")) if extracted_fields.get("vin") else None,
        chassis_number=str(extracted_fields.get("chassis_number")) if extracted_fields.get("chassis_number") else None,
    )
    if matched_vehicle is None or matched_vehicle.id == repair.vehicle_id:
        return

    repair.vehicle_id = matched_vehicle.id
    repair.vehicle = matched_vehicle
    normalization_notes.append(
        f"Ремонт автоматически перепривязан к технике {matched_vehicle.plate_number or matched_vehicle.id} по совпадению с реестром."
    )


def infer_vehicle_type_from_document_text(text: str) -> VehicleType:
    vehicle_section = extract_vehicle_section_text(text)
    if re.search(
        r"\b(?:п/п|полуприцеп|прицеп|schmitz|cargobull|koluman|orthaus|krone|kogel|wielton|тонар|рефрижератор)\b",
        vehicle_section,
        re.IGNORECASE,
    ):
        return VehicleType.TRAILER
    return VehicleType.TRUCK


def extract_vehicle_year_from_document_text(text: str) -> Optional[int]:
    vehicle_section = extract_vehicle_section_text(text)
    match = re.search(r"год\s+вып\.?\s*(?P<value>20\d{2}|19\d{2})", vehicle_section, re.IGNORECASE)
    if match is None:
        return None
    try:
        return int(match.group("value"))
    except ValueError:
        return None


def extract_vehicle_brand_model_from_document_text(text: str) -> tuple[Optional[str], Optional[str]]:
    vehicle_section = extract_vehicle_section_text(text)
    descriptor_match = re.search(
        r"(?:ТС|Автомобиль)\s*:\s*(?P<value>.*?)(?=\b(?:гос\.?\s*номер|vin|пробег|год\s+вып)\b|$)",
        vehicle_section,
        re.IGNORECASE | re.DOTALL,
    )
    if descriptor_match is None:
        return None, None

    descriptor = descriptor_match.group("value").replace("\n", " ").replace("\r", " ").strip(" ,.;:-")
    descriptor = re.sub(r"\s+", " ", descriptor)
    if not descriptor:
        return None, None

    descriptor = re.sub(r"\b(?:п/п|полуприцеп|прицеп)\b\s*", "", descriptor, flags=re.IGNORECASE).strip(" ,.;:-")
    if not descriptor:
        return None, None

    tokens = descriptor.split()
    if not tokens:
        return None, None

    brand = tokens[0].upper()
    model = " ".join(tokens[1:]).strip() or None
    return brand[:120], model[:255] if model else None


def auto_create_repair_vehicle_from_document(
    repair: Repair,
    document: Document,
    *,
    extracted_fields: dict[str, object],
    text: str,
    normalization_notes: list[str],
) -> bool:
    vehicle = repair.vehicle
    if vehicle is None or vehicle.external_id != PLACEHOLDER_VEHICLE_EXTERNAL_ID:
        return False

    plate_number = str(extracted_fields.get("plate_number")) if extracted_fields.get("plate_number") else None
    vin = str(extracted_fields.get("vin")) if extracted_fields.get("vin") else None
    chassis_number = str(extracted_fields.get("chassis_number")) if extracted_fields.get("chassis_number") else None

    normalized_plate = find_plate_candidate(plate_number) or normalize_identifier_token(plate_number)
    normalized_vin = find_vin_candidate(vin) or normalize_identifier_token(vin)
    normalized_chassis = find_chassis_candidate(chassis_number) or normalize_identifier_token(chassis_number)

    if not normalized_vin and not normalized_chassis:
        return False

    vehicle_type = infer_vehicle_type_from_document_text(text)
    brand, model = extract_vehicle_brand_model_from_document_text(text)
    year = extract_vehicle_year_from_document_text(text)

    created_vehicle = Vehicle(
        external_id=None,
        vehicle_type=vehicle_type,
        vin=normalized_vin,
        plate_number=normalized_plate,
        brand=brand,
        model=model,
        year=year,
        status=VehicleStatus.ACTIVE,
        comment="Карточка техники автоматически создана из OCR документа.",
        source_payload={
            "created_from": "document_ocr_auto_create",
            "created_from_document_id": document.id,
            "created_from_repair_id": repair.id,
            "plate_number": normalized_plate,
            "vin": normalized_vin,
            "chassis_number": normalized_chassis,
            "brand": brand,
            "model": model,
            "year": year,
        },
    )
    repair.vehicle = created_vehicle
    normalization_notes.append(
        "Для техники не найдено совпадение в реестре, создана новая карточка по OCR документа."
    )
    return True
