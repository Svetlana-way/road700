from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import CheckSeverity, DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair, RepairCheck
from app.models.user import User
from app.schemas.review import ReviewActionRequest, ReviewActionResponse, ReviewQueueResponse


router = APIRouter(prefix="/review", tags=["review"])

REVIEWABLE_DOCUMENT_STATUSES = (
    DocumentStatus.UPLOADED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.OCR_ERROR,
)
REVIEWABLE_REPAIR_STATUSES = (
    RepairStatus.IN_REVIEW,
    RepairStatus.EMPLOYEE_CONFIRMED,
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
    RepairStatus.EMPLOYEE_CONFIRMED: "Ремонт подготовлен сотрудником и ждёт подтверждения",
    RepairStatus.SUSPICIOUS: "Ремонт помечен как подозрительный",
    RepairStatus.OCR_ERROR: "Ремонт требует ручного восстановления после OCR",
}
REVIEW_ACTIONS = {"confirm", "send_to_review"}
REVIEW_QUEUE_CATEGORIES = {
    "all",
    "suspicious",
    "ocr_error",
    "partial_recognition",
    "employee_confirmation",
    "manual_review",
}


def latest_document_version(document: Document) -> Optional[DocumentVersion]:
    if not document.versions:
        return None
    return max(document.versions, key=lambda version: version.version_number)


def load_document_for_review(db: Session, document_id: int) -> Optional[Document]:
    stmt = (
        select(Document)
        .join(Document.repair)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).joinedload(Repair.checks),
            joinedload(Document.versions),
        )
        .where(Document.id == document_id)
    )
    return db.execute(stmt).unique().scalar_one_or_none()


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


def get_visible_document(db: Session, current_user: User, document_id: int) -> Document:
    document = load_document_for_review(db, document_id)
    if document is None or document.repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if current_user.role == UserRole.ADMIN:
        return document

    visible_vehicle = get_allowed_vehicle_ids_query(current_user)
    vehicle_is_visible = db.scalar(
        select(func.count(Repair.id)).where(
            Repair.id == document.repair_id,
            Repair.vehicle_id.in_(visible_vehicle),
        )
    )
    if not vehicle_is_visible:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


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
    elif document.repair.status == RepairStatus.EMPLOYEE_CONFIRMED:
        score += 60

    if document.repair.is_partially_recognized:
        score += 25

    if manual_review_reasons:
        score += min(len(manual_review_reasons) * 8, 32)

    if document.ocr_confidence is not None:
        score += max(0, round((1 - float(document.ocr_confidence)) * 40))

    return score, bucket


def determine_review_category(document: Document, unresolved_checks: list[RepairCheck]) -> str:
    if document.repair.status == RepairStatus.SUSPICIOUS:
        return "suspicious"
    if any(check.severity in {CheckSeverity.SUSPICIOUS, CheckSeverity.ERROR} for check in unresolved_checks):
        return "suspicious"
    if document.status == DocumentStatus.OCR_ERROR or document.repair.status == RepairStatus.OCR_ERROR:
        return "ocr_error"
    if document.repair.status == RepairStatus.EMPLOYEE_CONFIRMED:
        return "employee_confirmation"
    if document.status == DocumentStatus.PARTIALLY_RECOGNIZED or document.repair.is_partially_recognized:
        return "partial_recognition"
    return "manual_review"


def build_repair_state_snapshot(document: Document) -> dict:
    repair = document.repair
    unresolved_checks = [
        {
            "id": item.id,
            "check_type": item.check_type,
            "severity": item.severity.value,
            "title": item.title,
            "is_resolved": item.is_resolved,
        }
        for item in sorted(repair.checks, key=lambda item: item.id)
    ]
    return {
        "document_status": document.status.value,
        "review_queue_priority": document.review_queue_priority,
        "document_notes": document.notes,
        "repair_status": repair.status.value,
        "is_preliminary": repair.is_preliminary,
        "is_partially_recognized": repair.is_partially_recognized,
        "unresolved_checks": unresolved_checks,
    }


def append_review_comment(existing: Optional[str], action: str, comment: Optional[str], current_user: User) -> Optional[str]:
    normalized_comment = (comment or "").strip()
    if not normalized_comment:
        return existing
    action_label = "Подтверждено администратором" if action == "confirm" else "Возвращено в ручную проверку"
    note_line = f"[{action_label}] {current_user.full_name}: {normalized_comment}"
    if existing:
        return f"{existing}\n{note_line}"
    return note_line


def apply_review_action(document: Document, action: str, comment: Optional[str], current_user: User) -> str:
    if action == "confirm":
        document.status = DocumentStatus.CONFIRMED
        document.review_queue_priority = 20
        document.repair.status = RepairStatus.CONFIRMED
        document.repair.is_preliminary = False
        document.repair.is_partially_recognized = False
        for check in document.repair.checks:
            if not check.is_resolved:
                check.is_resolved = True
        message = "Заказ-наряд подтверждён администратором"
    else:
        document.status = DocumentStatus.NEEDS_REVIEW
        document.review_queue_priority = 120
        document.repair.status = RepairStatus.IN_REVIEW
        document.repair.is_preliminary = True
        message = "Заказ-наряд возвращён в ручную проверку"

    document.notes = append_review_comment(document.notes, action, comment, current_user)
    return message


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
    category = determine_review_category(document, unresolved_checks)

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
        "category": category,
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
    category: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReviewQueueResponse:
    if category not in REVIEW_QUEUE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported review category")

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
    serialized_items = [serialize_review_item(document) for document in documents]
    counts = {name: 0 for name in REVIEW_QUEUE_CATEGORIES}
    counts["all"] = len(serialized_items)
    for item in serialized_items:
        counts[item["category"]] += 1

    items = serialized_items if category == "all" else [item for item in serialized_items if item["category"] == category]
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
        counts=counts,
        total=len(items) if category != "all" else total,
        limit=limit,
        offset=offset,
    )


@router.post("/queue/{document_id}/action", response_model=ReviewActionResponse)
def execute_review_action(
    document_id: int,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReviewActionResponse:
    action = payload.action.strip().lower()
    if action not in REVIEW_ACTIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported review action")

    if action == "confirm" and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    document = get_visible_document(db, current_user, document_id)
    old_snapshot = build_repair_state_snapshot(document)
    message = apply_review_action(document, action, payload.comment, current_user)

    db.flush()
    new_snapshot = build_repair_state_snapshot(document)
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="repair",
            entity_id=str(document.repair.id),
            action_type=f"review_{action}",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="document",
            entity_id=str(document.id),
            action_type=f"review_{action}",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.commit()

    refreshed_document = get_visible_document(db, current_user, document_id)
    review_item = None
    if refreshed_document.status in REVIEWABLE_DOCUMENT_STATUSES or refreshed_document.repair.status in REVIEWABLE_REPAIR_STATUSES:
        review_item = serialize_review_item(refreshed_document)

    return ReviewActionResponse(
        message=message,
        document_id=refreshed_document.id,
        repair_id=refreshed_document.repair.id,
        document_status=refreshed_document.status,
        repair_status=refreshed_document.repair.status,
        queue_item=review_item,
    )
