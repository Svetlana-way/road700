from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from pypdf import PdfReader
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.document import Document, DocumentVersion
from app.models.enums import CheckSeverity, DocumentStatus, ImportStatus, RepairStatus, ServiceStatus
from app.models.imports import ImportJob
from app.models.repair import Repair, RepairCheck
from app.models.service import Service


PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_STORAGE_ROOT = PROJECT_ROOT / "storage"

ORDER_PATTERNS = [
    r"(?:заказ[\s-]*наряд|наряд[\s-]*заказ)\s*(?:№|N|#)?\s*([A-Za-zА-Яа-я0-9/_-]{3,})",
    r"\b(?:№|N|#)\s*([A-Za-zА-Яа-я0-9/_-]{4,})",
]
DATE_PATTERNS = [
    r"(?:дата|от)\s*[:№]?\s*(\d{2}[./-]\d{2}[./-]\d{4})",
    r"\b(\d{2}[./-]\d{2}[./-]\d{4})\b",
]
MILEAGE_PATTERNS = [
    r"(?:пробег|одометр)\D{0,20}(\d[\d\s]{2,})",
]
PLATE_PATTERNS = [
    r"\b([А-ЯA-Z]\d{3}[А-ЯA-Z]{2}\d{2,3})\b",
]
VIN_PATTERNS = [
    r"\b([A-HJ-NPR-Z0-9]{17})\b",
]
SERVICE_PATTERNS = [
    r"(?:^|[\n\r])\s*(?:сервис|сто|исполнитель|подрядчик)\b\s*[:№]?\s*([^\n\r]{3,120})",
]
TOTAL_PATTERNS = {
    "work_total": [
        r"(?:работы|стоимость\s+работ)\D{0,20}(\d[\d\s]*(?:[,.]\d{2})?)",
    ],
    "parts_total": [
        r"(?:запчасти|материалы|стоимость\s+запчастей)\D{0,20}(\d[\d\s]*(?:[,.]\d{2})?)",
    ],
    "vat_total": [
        r"(?:ндс)\D{0,20}(\d[\d\s]*(?:[,.]\d{2})?)",
    ],
    "grand_total": [
        r"(?:итого\s+к\s+оплате|к\s+оплате|итого|всего)\D{0,20}(\d[\d\s]*(?:[,.]\d{2})?)",
    ],
}


@dataclass
class ProcessingResult:
    document: Document
    job: ImportJob
    message: str


def get_storage_path(storage_key: str) -> Path:
    return LOCAL_STORAGE_ROOT / storage_key


def normalize_text(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


def score_text_quality(text: str) -> tuple[int, int, int]:
    cyrillic_count = len(re.findall(r"[А-Яа-я]", text))
    alnum_count = len(re.findall(r"[А-Яа-яA-Za-z0-9]", text))
    keyword_hits = len(
        re.findall(
            r"(заказ|наряд|дата|госномер|пробег|работ|запчаст|итого|сервис)",
            text,
            re.IGNORECASE,
        )
    )
    return (keyword_hits, cyrillic_count, alnum_count)


def parse_amount(value: str) -> Optional[float]:
    cleaned = value.replace(" ", "").replace("\xa0", "").replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def parse_date_value(value: str) -> Optional[date]:
    for fmt in ("%d.%m.%Y", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def first_match(patterns: list[str], text: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return normalize_text(match.group(1))
    return None


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


def parse_document_text(text: str) -> dict[str, object]:
    extracted_fields = {}
    confidence_map = {}
    manual_review_reasons = []

    order_number = first_match(ORDER_PATTERNS, text)
    if order_number:
        extracted_fields["order_number"] = order_number
        confidence_map["order_number"] = 0.74
    else:
        manual_review_reasons.append("order_number_missing")

    repair_date = first_match(DATE_PATTERNS, text)
    if repair_date:
        parsed_date = parse_date_value(repair_date)
        if parsed_date:
            extracted_fields["repair_date"] = parsed_date.isoformat()
            confidence_map["repair_date"] = 0.7
        else:
            manual_review_reasons.append("repair_date_invalid")
    else:
        manual_review_reasons.append("repair_date_missing")

    mileage = first_match(MILEAGE_PATTERNS, text)
    if mileage:
        digits_only = re.sub(r"\D", "", mileage)
        if digits_only:
            extracted_fields["mileage"] = int(digits_only)
            confidence_map["mileage"] = 0.82
    else:
        manual_review_reasons.append("mileage_missing")

    plate_number = first_match(PLATE_PATTERNS, text)
    if plate_number:
        extracted_fields["plate_number"] = plate_number
        confidence_map["plate_number"] = 0.77

    vin = first_match(VIN_PATTERNS, text)
    if vin:
        extracted_fields["vin"] = vin
        confidence_map["vin"] = 0.88

    service_name = first_match(SERVICE_PATTERNS, text)
    if service_name:
        extracted_fields["service_name"] = service_name[:120]
        confidence_map["service_name"] = 0.58

    for field_name, patterns in TOTAL_PATTERNS.items():
        match = first_match(patterns, text)
        if not match:
            continue
        amount = parse_amount(match)
        if amount is None:
            continue
        extracted_fields[field_name] = amount
        confidence_map[field_name] = 0.8 if field_name == "grand_total" else 0.72

    return {
        "extracted_fields": extracted_fields,
        "confidence_map": confidence_map,
        "manual_review_reasons": manual_review_reasons,
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
    existing = db.scalar(select(Service).where(func.lower(Service.name) == service_name.lower()))
    if existing is not None:
        return existing
    service = Service(name=service_name[:255], status=ServiceStatus.PRELIMINARY)
    db.add(service)
    db.flush()
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

        text = ""
        extracted_from = "manual_review"
        if document.source_type == "pdf":
            text = extract_pdf_text(storage_path)
            extracted_from = "pdf_text"

        parsed = parse_document_text(text) if text else {
            "extracted_fields": {},
            "confidence_map": {},
            "manual_review_reasons": ["image_ocr_not_available" if document.source_type != "pdf" else "text_not_found"],
        }

        extracted_fields = parsed["extracted_fields"]
        confidence_map = parsed["confidence_map"]
        manual_review_reasons = parsed["manual_review_reasons"]
        repair = document.repair
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
            service = resolve_service(db, str(extracted_fields["service_name"]))
            repair.service_id = service.id

        if "plate_number" in extracted_fields and repair.vehicle.plate_number:
            if str(extracted_fields["plate_number"]).upper() != repair.vehicle.plate_number.upper():
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
            "processor": "pdf_text_regex_v1",
            "extracted_from": extracted_from,
            "text_length": len(text),
            "text_excerpt": text_excerpt,
            "extracted_fields": extracted_fields,
            "manual_review_reasons": manual_review_reasons,
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
            "manual_review_reasons": manual_review_reasons,
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
