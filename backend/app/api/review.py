from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.document import Document, DocumentVersion
from app.models.enums import CheckSeverity, DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair, RepairCheck
from app.models.user import User
from app.schemas.review import ReviewQueueResponse


router = APIRouter(prefix="/review", tags=["review"])

REVIEWABLE_DOCUMENT_STATUSES = (
    DocumentStatus.UPLOADED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.OCR_ERROR,
)
REVIEWABLE_REPAIR_STATUSES = (
    RepairStatus.IN_REVIEW,
    RepairStatus.SUSPICIOUS,
    RepairStatus.OCR_ERROR,
)
MANUAL_REVIEW_REASON_LABELS = {
    "order_number_missing": "Не найден номер заказ-наряда",
    "repair_date_missing": "Не найдена дата ремонта",
    "repair_date_invalid": "Дата ремонта распознана с ошибкой",
    "mileage_missing": "Не найден пробег",
    "text_not_found": "Текст документа не извлечён",
    "image_text_not_found": "На изображении не удалось распознать текст",
    "pdf_text_not_found": "В PDF не удалось распознать текст",
    "pdf_ocr_unavailable": "OCR для PDF недоступен",
    "image_ocr_unavailable": "OCR для изображений недоступен",
}
DOCUMENT_STATUS_LABELS = {
    DocumentStatus.UPLOADED: "Документ ждёт обработки",
    DocumentStatus.PARTIALLY_RECOGNIZED: "Документ распознан частично",
    DocumentStatus.NEEDS_REVIEW: "Документ отправлен на ручную проверку",
    DocumentStatus.OCR_ERROR: "Ошибка автоматической обработки документа",
}
REPAIR_STATUS_LABELS = {
    RepairStatus.IN_REVIEW: "Ремонт ждёт проверки",
    RepairStatus.SUSPICIOUS: "Ремонт помечен как подозрительный",
    RepairStatus.OCR_ERROR: "Ремонт требует ручного восстановления после OCR",
}


def latest_document_version(document: Document) -> Optional[DocumentVersion]:
    if not document.versions:
        return None
    return max(document.versions, key=lambda version: version.version_number)


def normalize_manual_review_reasons(raw_reasons: object) -> list[str]:
    if not isinstance(raw_reasons, list):
        return []
    reasons: list[str] = []
    for item in raw_reasons:
        if not isinstance(item, str):
            continue
        reasons.append(MANUAL_REVIEW_REASON_LABELS.get(item, item.replace("_", " ")))
    return reasons


def append_issue(issues: list[str], issue: Optional[str]) -> None:
    if issue and issue not in issues:
        issues.append(issue)


def build_priority(document: Document, unresolved_checks: list[RepairCheck], manual_review_reasons: list[str]) -> tuple[int, str]:
    score = int(document.review_queue_priority or 0)
    bucket = "review"

    if document.repair.status == RepairStatus.SUSPICIOUS:
        score += 200
        bucket = "suspicious"

    if any(check.severity == CheckSeverity.SUSPICIOUS for check in unresolved_checks):
        score += 180
        bucket = "suspicious"

    if any(check.severity == CheckSeverity.ERROR for check in unresolved_checks):
        score += 140
        if bucket != "suspicious":
            bucket = "critical"

    if document.status == DocumentStatus.OCR_ERROR or document.repair.status == RepairStatus.OCR_ERROR:
        score += 130
        if bucket == "review":
            bucket = "critical"

    if document.status == DocumentStatus.PARTIALLY_RECOGNIZED:
        score += 80
    elif document.status == DocumentStatus.NEEDS_REVIEW:
        score += 70
    elif document.status == DocumentStatus.UPLOADED:
        score += 50

    if document.repair.status == RepairStatus.IN_REVIEW:
        score += 40

    if document.repair.is_partially_recognized:
        score += 25

    if manual_review_reasons:
        score += min(len(manual_review_reasons) * 8, 32)

    if document.ocr_confidence is not None:
        score += max(0, round((1 - float(document.ocr_confidence)) * 40))

    return score, bucket


def serialize_review_item(document: Document) -> dict:
    repair = document.repair
    vehicle = repair.vehicle
    latest_version = latest_document_version(document)
    parsed_payload = latest_version.parsed_payload if latest_version and latest_version.parsed_payload else {}
    extracted_fields = parsed_payload.get("extracted_fields") if isinstance(parsed_payload, dict) else {}
    unresolved_checks = sorted(
        [item for item in repair.checks if not item.is_resolved],
        key=lambda item: (item.created_at, item.id),
        reverse=True,
    )
    manual_review_reasons = normalize_manual_review_reasons(
        parsed_payload.get("manual_review_reasons") if isinstance(parsed_payload, dict) else None
    )

    issue_titles: list[str] = []
    append_issue(issue_titles, DOCUMENT_STATUS_LABELS.get(document.status))
    append_issue(issue_titles, REPAIR_STATUS_LABELS.get(repair.status))
    for reason in manual_review_reasons:
        append_issue(issue_titles, reason)
    for check in unresolved_checks:
        append_issue(issue_titles, check.title)

    priority_score, priority_bucket = build_priority(document, unresolved_checks, manual_review_reasons)

    grand_total = None
    if isinstance(extracted_fields, dict):
        raw_grand_total = extracted_fields.get("grand_total")
        if isinstance(raw_grand_total, (int, float)):
            grand_total = float(raw_grand_total)

    extracted_order_number = None
    if isinstance(extracted_fields, dict):
        raw_order_number = extracted_fields.get("order_number")
        if raw_order_number is not None:
            extracted_order_number = str(raw_order_number)

    return {
        "priority_score": priority_score,
        "priority_bucket": priority_bucket,
        "issue_count": len(issue_titles),
        "issue_titles": issue_titles,
        "manual_review_reasons": manual_review_reasons,
        "extracted_order_number": extracted_order_number,
        "extracted_grand_total": grand_total,
        "document": {
            "id": document.id,
            "original_filename": document.original_filename,
            "source_type": document.source_type,
            "status": document.status,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
            "ocr_confidence": document.ocr_confidence,
            "review_queue_priority": document.review_queue_priority,
        },
        "repair": {
            "id": repair.id,
            "order_number": repair.order_number,
            "repair_date": repair.repair_date,
            "mileage": repair.mileage,
            "status": repair.status,
            "is_partially_recognized": repair.is_partially_recognized,
            "unresolved_checks_total": len(unresolved_checks),
            "suspicious_checks_total": len(
                [
                    check
                    for check in unresolved_checks
                    if check.severity in {CheckSeverity.SUSPICIOUS, CheckSeverity.ERROR}
                ]
            ),
        },
        "vehicle": {
            "id": vehicle.id,
            "vehicle_type": vehicle.vehicle_type,
            "plate_number": vehicle.plate_number,
            "brand": vehicle.brand,
            "model": vehicle.model,
        },
    }


@router.get("/queue", response_model=ReviewQueueResponse)
def get_review_queue(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReviewQueueResponse:
    unresolved_repair_ids = select(RepairCheck.repair_id).where(RepairCheck.is_resolved.is_(False))
    review_filter = or_(
        Document.status.in_(REVIEWABLE_DOCUMENT_STATUSES),
        Repair.status.in_(REVIEWABLE_REPAIR_STATUSES),
        Repair.is_partially_recognized.is_(True),
        Repair.id.in_(unresolved_repair_ids),
    )

    stmt = (
        select(Document)
        .join(Document.repair)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).joinedload(Repair.checks),
            joinedload(Document.versions),
        )
        .where(review_filter)
    )
    count_stmt = select(func.count(Document.id)).join(Document.repair).where(review_filter)

    if current_user.role != UserRole.ADMIN:
        visible_vehicle_ids = get_allowed_vehicle_ids_query(current_user)
        stmt = stmt.where(Repair.vehicle_id.in_(visible_vehicle_ids))
        count_stmt = count_stmt.where(Repair.vehicle_id.in_(visible_vehicle_ids))

    total = db.scalar(count_stmt) or 0
    documents = db.execute(stmt).unique().scalars().all()
    items = [serialize_review_item(document) for document in documents]
    items.sort(
        key=lambda item: (
            item["priority_score"],
            item["repair"]["suspicious_checks_total"],
            item["document"]["created_at"],
            item["document"]["id"],
        ),
        reverse=True,
    )

    paged_items = items[offset : offset + limit]
    return ReviewQueueResponse(
        items=paged_items,
        total=total,
        limit=limit,
        offset=offset,
    )
