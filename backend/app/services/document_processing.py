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

from pypdf import PdfReader
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.document import Document, DocumentVersion
from app.models.enums import CatalogStatus, CheckSeverity, DocumentStatus, ImportStatus, RepairStatus, ServiceStatus
from app.models.imports import ImportJob
from app.models.repair import Repair, RepairCheck, RepairPart, RepairWork
from app.models.service import Service


PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_STORAGE_ROOT = PROJECT_ROOT / "storage"
VISION_OCR_SCRIPT = Path(__file__).with_name("vision_ocr.swift")

ORDER_PATTERNS = [
    r"(?:заказ[\s-]*наряд|наряд[\s-]*заказ)\s*(?:№|N|#)?\s*([A-Za-zА-Яа-я0-9/_-]{3,})",
    r"\b(?:№|N|#)\s*([A-Za-zА-Яа-я0-9/_-]{4,})",
    r"\b([A-Z]{2,}[A-Z0-9/_-]*-\d{2,})\b",
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
        r"(?:^|[\n\r])\s*(?:работы\s+итого|стоимость\s+работ|итого\s+работ)\b[^\d\r\n]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)",
    ],
    "parts_total": [
        r"(?:^|[\n\r])\s*(?:запчасти\s+итого|материалы\s+итого|стоимость\s+запчастей|запчасти|материалы)\b[^\d\r\n]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)",
    ],
    "vat_total": [
        r"(?:^|[\n\r])\s*(?:ндс)\b[^\d\r\n]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)",
    ],
    "grand_total": [
        r"(?:^|[\n\r])\s*(?:итого\s+к\s+оплате|к\s+оплате|итого|всего)\b[^\d\r\n]{0,20}(\d[\d\s]*(?:[.,]\d{2})?)",
    ],
}
LINE_ITEM_PATTERN = re.compile(
    r"^(?P<name>[^\d].*?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>шт|нч|ч|час|часа|часов|компл|усл|ед|л|кг|м|к-т))?"
    r"\s+(?P<price>\d[\d\s]*(?:[.,]\d{2})?)"
    r"\s+(?P<total>\d[\d\s]*(?:[.,]\d{2})?)$",
    re.IGNORECASE,
)
PART_LINE_WITH_ARTICLE_PATTERN = re.compile(
    r"^(?P<article>[A-Za-zА-Яа-я0-9-]{3,})\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<qty>\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>шт|компл|усл|ед|л|кг|м|к-т))?"
    r"\s+(?P<price>\d[\d\s]*(?:[.,]\d{2})?)"
    r"\s+(?P<total>\d[\d\s]*(?:[.,]\d{2})?)$",
    re.IGNORECASE,
)
WORK_SECTION_MARKERS = ("работы", "услуги", "работа:")
PART_SECTION_MARKERS = ("запчасти", "материалы", "запчасть:")


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


def is_vision_ocr_available() -> bool:
    return shutil.which("swift") is not None and VISION_OCR_SCRIPT.exists()


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


def parse_decimal_value(value: str) -> Optional[float]:
    normalized = value.replace(" ", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return None


def first_match(patterns: list[str], text: str) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return normalize_text(match.group(1))
    return None


def normalize_line(line: str) -> str:
    return normalize_text(line.replace("\xa0", " "))


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

    return {"works": works, "parts": parts}


def parse_work_line(line: str) -> Optional[dict[str, object]]:
    match = LINE_ITEM_PATTERN.match(line)
    if not match:
        return None

    quantity = parse_decimal_value(match.group("qty"))
    price = parse_amount(match.group("price"))
    total = parse_amount(match.group("total"))
    name = normalize_text(match.group("name"))
    if quantity is None or price is None or total is None or not name:
        return None

    return {
        "work_name": name[:500],
        "quantity": quantity,
        "unit_name": match.group("unit"),
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
        "article": article,
        "part_name": name[:500],
        "quantity": quantity,
        "unit_name": match.groupdict().get("unit"),
        "price": price,
        "line_total": total,
    }


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


def preprocess_image_for_ocr(path: Path) -> tuple[tempfile.TemporaryDirectory, Path]:
    temp_dir = tempfile.TemporaryDirectory()
    processed_path = Path(temp_dir.name) / f"{path.stem}_ocr.jpg"
    command = [
        "sips",
        "-s",
        "format",
        "jpeg",
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
    return temp_dir, processed_path


def extract_image_text(path: Path) -> str:
    temp_dir, processed_path = preprocess_image_for_ocr(path)
    try:
        ocr_results = run_vision_ocr([processed_path])
        return normalize_text(ocr_results.get(processed_path.as_posix(), ""))
    finally:
        temp_dir.cleanup()


def render_pdf_pages_for_ocr(path: Path, max_pages: int = 5) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    temp_dir = tempfile.TemporaryDirectory()
    image_paths: list[Path] = []
    page_count = max(1, min(len(PdfReader(path.as_posix()).pages), max_pages))
    for page_index in range(page_count):
        image_path = Path(temp_dir.name) / f"ocr_page_{page_index + 1}.jpg"
        command = [
            "sips",
            "-s",
            "format",
            "jpeg",
            "-Z",
            "2400",
            path.as_posix(),
            "--out",
            image_path.as_posix(),
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            temp_dir.cleanup()
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Failed to render PDF page for OCR")
        image_paths.append(image_path)
        break

    return temp_dir, image_paths


def extract_scanned_pdf_text(path: Path) -> str:
    temp_dir, image_paths = render_pdf_pages_for_ocr(path)
    try:
        ocr_results = run_vision_ocr(image_paths)
        chunks = [normalize_text(ocr_results.get(image_path.as_posix(), "")) for image_path in image_paths]
        return "\n".join(filter(None, chunks)).strip()
    finally:
        temp_dir.cleanup()


def extract_document_text(path: Path, source_type: str) -> tuple[str, str, Optional[str]]:
    if source_type == "image":
        if not is_vision_ocr_available():
            return "", "manual_review", "image_ocr_unavailable"
        text = extract_image_text(path)
        return text, "image_vision_ocr", None if text else "image_text_not_found"

    text = extract_pdf_text(path)
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


def parse_document_text(text: str) -> dict[str, object]:
    extracted_fields = {}
    confidence_map = {}
    manual_review_reasons = []
    extracted_items = extract_line_items(text)

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
        "extracted_items": extracted_items,
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


def replace_repair_lines(
    db: Session,
    repair: Repair,
    works_payload: list[dict[str, object]],
    parts_payload: list[dict[str, object]],
) -> None:
    db.execute(delete(RepairWork).where(RepairWork.repair_id == repair.id))
    db.execute(delete(RepairPart).where(RepairPart.repair_id == repair.id))

    for item in works_payload:
        db.add(
            RepairWork(
                repair_id=repair.id,
                work_name=str(item["work_name"]),
                quantity=float(item["quantity"]),
                actual_hours=float(item["quantity"]) if str(item.get("unit_name") or "").lower() in {"нч", "ч", "час", "часа", "часов"} else None,
                price=float(item["price"]),
                line_total=float(item["line_total"]),
                status=CatalogStatus.PRELIMINARY,
                reference_payload={"source": "ocr", "unit_name": item.get("unit_name")},
            )
        )

    for item in parts_payload:
        db.add(
            RepairPart(
                repair_id=repair.id,
                article=str(item["article"]) if item.get("article") else None,
                part_name=str(item["part_name"]),
                quantity=float(item["quantity"]),
                unit_name=str(item["unit_name"]) if item.get("unit_name") else None,
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

        text, extracted_from, extraction_failure_reason = extract_document_text(storage_path, document.source_type)
        parsed = parse_document_text(text) if text else {
            "extracted_fields": {},
            "extracted_items": {"works": [], "parts": []},
            "confidence_map": {},
            "manual_review_reasons": [extraction_failure_reason or "text_not_found"],
        }

        extracted_fields = parsed["extracted_fields"]
        extracted_items = parsed["extracted_items"]
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

        replace_repair_lines(
            db,
            repair,
            works_payload=extracted_items["works"],
            parts_payload=extracted_items["parts"],
        )

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

        works_sum = round(sum(float(item["line_total"]) for item in extracted_items["works"]), 2)
        parts_sum = round(sum(float(item["line_total"]) for item in extracted_items["parts"]), 2)
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
            "processor": "hybrid_document_ocr_v1",
            "extracted_from": extracted_from,
            "text_length": len(text),
            "text_excerpt": text_excerpt,
            "extracted_fields": extracted_fields,
            "extracted_items": extracted_items,
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
            "works_count": len(extracted_items["works"]),
            "parts_count": len(extracted_items["parts"]),
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
