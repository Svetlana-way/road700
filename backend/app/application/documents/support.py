from __future__ import annotations

from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.application.documents.parsing_access import (
    normalize_article_value_for_application,
    normalize_unit_name_for_application,
)
from app.models.document import Document
from app.models.enums import CatalogStatus, CheckSeverity
from app.models.repair import Repair, RepairCheck, RepairPart, RepairWork
from app.models.service import Service
from app.application.services.service_catalog import resolve_service_by_name


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


def amounts_match(left: Optional[float], right: Optional[float], tolerance: float = 0.0) -> bool:
    if left is None or right is None:
        return False
    return abs(left - right) <= tolerance


def resolve_service(db: Session, service_name: str) -> Service:
    service = resolve_service_by_name(db, service_name)
    if service is None:
        raise ValueError(f"Unknown service: {service_name}")
    return service


def build_manual_review_check(
    reason: str,
    *,
    extracted_fields: dict[str, object],
) -> dict[str, object]:
    service_name = str(extracted_fields.get("service_name")).strip() if extracted_fields.get("service_name") else None
    plate_number = str(extracted_fields.get("plate_number")).strip() if extracted_fields.get("plate_number") else None
    vin = str(extracted_fields.get("vin")).strip() if extracted_fields.get("vin") else None

    if reason == "vehicle_not_found":
        identifiers = []
        if plate_number:
            identifiers.append(f"госномер {plate_number}")
        if vin:
            identifiers.append(f"VIN {vin}")
        details = "Техника из документа не найдена в базе техники."
        if identifiers:
            details = f"{details} Распознаны: {', '.join(identifiers)}."
        return {
            "check_type": "ocr_vehicle_not_found",
            "severity": CheckSeverity.WARNING,
            "title": "Техника не найдена в базе",
            "details": details,
            "payload": {
                "reason": reason,
                "plate_number": plate_number,
                "vin": vin,
            },
        }

    if reason == "vehicle_missing":
        return {
            "check_type": "ocr_vehicle_missing",
            "severity": CheckSeverity.WARNING,
            "title": "Не удалось определить технику",
            "details": "В документе не удалось надёжно определить технику. Нужна ручная привязка.",
            "payload": {"reason": reason},
        }

    if reason == "service_not_found":
        details = "Сервис из документа не найден в справочнике сервисов."
        if service_name:
            details = f"{details} Распознанное значение: {service_name}."
        return {
            "check_type": "ocr_service_not_found",
            "severity": CheckSeverity.WARNING,
            "title": "Сервис не найден в справочнике",
            "details": details,
            "payload": {
                "reason": reason,
                "service_name": service_name,
            },
        }

    if reason == "service_name_missing":
        return {
            "check_type": "ocr_service_missing",
            "severity": CheckSeverity.WARNING,
            "title": "Не удалось определить сервис",
            "details": "В документе не удалось надёжно определить сервис. Нужна ручная проверка.",
            "payload": {"reason": reason},
        }

    if reason == "text_not_found":
        return {
            "check_type": "ocr_text_not_found",
            "severity": CheckSeverity.WARNING,
            "title": "Не удалось извлечь текст из документа",
            "details": "Документ сохранён, но автоматическое распознавание не извлекло текст для проверки.",
            "payload": {"reason": reason},
        }

    if reason == "image_ocr_unavailable":
        return {
            "check_type": "ocr_image_backend_unavailable",
            "severity": CheckSeverity.WARNING,
            "title": "OCR для изображений недоступен",
            "details": "В текущем окружении не найден поддерживаемый OCR backend для изображений.",
            "payload": {"reason": reason},
        }

    if reason == "pdf_ocr_unavailable":
        return {
            "check_type": "ocr_pdf_backend_unavailable",
            "severity": CheckSeverity.WARNING,
            "title": "OCR для PDF-сканов недоступен",
            "details": "В текущем окружении не найден поддерживаемый OCR backend для PDF-сканов.",
            "payload": {"reason": reason},
        }

    if reason == "pdf_renderer_unavailable":
        return {
            "check_type": "ocr_pdf_renderer_unavailable",
            "severity": CheckSeverity.WARNING,
            "title": "Рендер PDF для OCR недоступен",
            "details": "В текущем окружении не найден поддерживаемый renderer PDF-страниц для OCR.",
            "payload": {"reason": reason},
        }

    return {
        "check_type": f"ocr_{reason}",
        "severity": CheckSeverity.WARNING,
        "title": "Нужна ручная проверка OCR",
        "details": reason,
        "payload": {"reason": reason},
    }


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
        normalized_unit_name = normalize_unit_name_for_application(
            str(item.get("unit_name")) if item.get("unit_name") else None
        )
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
        normalized_unit_name = normalize_unit_name_for_application(
            str(item["unit_name"]) if item.get("unit_name") else None
        )
        db.add(
            RepairPart(
                repair_id=repair.id,
                article=normalize_article_value_for_application(str(item["article"])) if item.get("article") else None,
                part_name=str(item["part_name"]),
                quantity=float(item["quantity"]),
                unit_name=normalized_unit_name,
                price=float(item["price"]),
                line_total=float(item["line_total"]),
                status=CatalogStatus.PRELIMINARY,
            )
        )
