from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_repair_visibility_clause
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import CheckSeverity, DocumentKind, DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair, RepairCheck
from app.models.review_rule import ReviewRule
from app.models.user import User
from app.schemas.review import (
    ReviewActionRequest,
    ReviewActionResponse,
    ReviewQueueResponse,
    ReviewRuleCreate,
    ReviewRuleListResponse,
    ReviewRuleRead,
    ReviewRuleUpdate,
)


router = APIRouter(prefix="/review", tags=["review"])

REVIEWABLE_DOCUMENT_STATUSES = (
    DocumentStatus.UPLOADED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.OCR_ERROR,
)
REVIEWABLE_DOCUMENT_KINDS = (
    DocumentKind.ORDER,
    DocumentKind.REPEAT_SCAN,
)
REVIEWABLE_REPAIR_STATUSES = (
    RepairStatus.IN_REVIEW,
    RepairStatus.EMPLOYEE_CONFIRMED,
    RepairStatus.SUSPICIOUS,
    RepairStatus.OCR_ERROR,
)
PLACEHOLDER_EXTERNAL_ID = "__batch_import_placeholder__"
REVIEW_ACTIONS = {"employee_confirm", "confirm", "send_to_review"}
REVIEW_QUEUE_CATEGORIES = {
    "all",
    "suspicious",
    "ocr_error",
    "partial_recognition",
    "employee_confirmation",
    "manual_review",
}
REVIEW_BUCKET_PRIORITIES = {
    "review": 0,
    "critical": 1,
    "suspicious": 2,
}
ALLOWED_REVIEW_BUCKETS = set(REVIEW_BUCKET_PRIORITIES)
ALLOWED_REVIEW_RULE_TYPES = {
    "manual_review_reason",
    "document_status",
    "repair_status",
    "check_severity",
    "signal",
}


def normalize_rule_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized_value = value.strip()
    return normalized_value or None


def normalize_rule_code(value: str | None) -> str | None:
    normalized_value = normalize_rule_text(value)
    if not normalized_value:
        return None
    return normalized_value.lower().replace(" ", "_")


def humanize_review_code(value: str) -> str:
    return value.replace("_", " ")


def build_review_rule_map(db: Session, *, include_inactive: bool = False) -> dict[tuple[str, str], ReviewRule]:
    stmt = select(ReviewRule).order_by(ReviewRule.sort_order.asc(), ReviewRule.rule_type.asc(), ReviewRule.code.asc())
    if not include_inactive:
        stmt = stmt.where(ReviewRule.is_active.is_(True))
    rules = db.scalars(stmt).all()
    return {(rule.rule_type, rule.code): rule for rule in rules}


def get_review_rule(
    rule_map: dict[tuple[str, str], ReviewRule],
    rule_type: str,
    code: str,
) -> Optional[ReviewRule]:
    return rule_map.get((rule_type, code))


def apply_bucket_override(bucket: str, bucket_override: str | None) -> str:
    if not bucket_override:
        return bucket
    if bucket_override not in REVIEW_BUCKET_PRIORITIES:
        return bucket
    if REVIEW_BUCKET_PRIORITIES[bucket_override] > REVIEW_BUCKET_PRIORITIES[bucket]:
        return bucket_override
    return bucket


def get_review_rule_or_404(db: Session, rule_id: int) -> ReviewRule:
    rule = db.scalar(select(ReviewRule).where(ReviewRule.id == rule_id))
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Правило очереди проверки не найдено")
    return rule


def validate_review_rule_payload(
    *,
    rule_type: str | None,
    code: str | None,
    title: str | None,
    bucket_override: str | None,
) -> tuple[str | None, str | None, str | None, str | None]:
    normalized_rule_type = normalize_rule_text(rule_type)
    if normalized_rule_type is not None and normalized_rule_type not in ALLOWED_REVIEW_RULE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный тип правила")

    normalized_code = normalize_rule_code(code)
    normalized_title = normalize_rule_text(title)
    if title is not None and not normalized_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название правила обязательно")

    normalized_bucket_override = normalize_rule_text(bucket_override)
    if normalized_bucket_override is not None and normalized_bucket_override not in ALLOWED_REVIEW_BUCKETS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный bucket правила")

    return normalized_rule_type, normalized_code, normalized_title, normalized_bucket_override


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


def parse_manual_review_reason_codes(raw_reasons: object) -> list[str]:
    if not isinstance(raw_reasons, list):
        return []
    reasons: list[str] = []
    for item in raw_reasons:
        if not isinstance(item, str):
            continue
        normalized_code = normalize_rule_code(item)
        if normalized_code:
            reasons.append(normalized_code)
    return reasons


def label_manual_review_reasons(
    raw_reasons: object,
    rule_map: dict[tuple[str, str], ReviewRule],
) -> tuple[list[str], list[str]]:
    codes = parse_manual_review_reason_codes(raw_reasons)
    labels: list[str] = []
    for code in codes:
        rule = get_review_rule(rule_map, "manual_review_reason", code)
        if rule is not None:
            labels.append(rule.title)
            continue
        labels.append(humanize_review_code(code))
    return codes, labels


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


def build_priority(
    document: Document,
    unresolved_checks: list[RepairCheck],
    manual_review_reason_codes: list[str],
    rule_map: dict[tuple[str, str], ReviewRule],
) -> tuple[int, str]:
    score = int(document.review_queue_priority or 0)
    bucket = "review"

    repair_status_rule = (
        get_review_rule(rule_map, "repair_status", RepairStatus.SUSPICIOUS.value)
        if document.repair.status == RepairStatus.SUSPICIOUS
        else None
    )
    if repair_status_rule is not None:
        score += repair_status_rule.weight
        bucket = apply_bucket_override(bucket, repair_status_rule.bucket_override)

    if any(check.severity == CheckSeverity.SUSPICIOUS for check in unresolved_checks):
        suspicious_rule = get_review_rule(rule_map, "check_severity", CheckSeverity.SUSPICIOUS.value)
        if suspicious_rule is not None:
            score += suspicious_rule.weight
            bucket = apply_bucket_override(bucket, suspicious_rule.bucket_override)

    if any(check.severity == CheckSeverity.ERROR for check in unresolved_checks):
        error_rule = get_review_rule(rule_map, "check_severity", CheckSeverity.ERROR.value)
        if error_rule is not None:
            score += error_rule.weight
            bucket = apply_bucket_override(bucket, error_rule.bucket_override)

    if document.status == DocumentStatus.OCR_ERROR or document.repair.status == RepairStatus.OCR_ERROR:
        ocr_rules = [
            rule
            for rule in (
                get_review_rule(rule_map, "document_status", DocumentStatus.OCR_ERROR.value),
                get_review_rule(rule_map, "repair_status", RepairStatus.OCR_ERROR.value),
            )
            if rule is not None
        ]
        if ocr_rules:
            strongest = max(ocr_rules, key=lambda item: item.weight)
            score += strongest.weight
            bucket = apply_bucket_override(bucket, strongest.bucket_override)

    document_status_rule = get_review_rule(rule_map, "document_status", document.status.value)
    if document_status_rule is not None and document.status != DocumentStatus.OCR_ERROR:
        score += document_status_rule.weight
        bucket = apply_bucket_override(bucket, document_status_rule.bucket_override)

    if document.repair.status in {RepairStatus.IN_REVIEW, RepairStatus.EMPLOYEE_CONFIRMED}:
        repair_progress_rule = get_review_rule(rule_map, "repair_status", document.repair.status.value)
        if repair_progress_rule is not None:
            score += repair_progress_rule.weight
            bucket = apply_bucket_override(bucket, repair_progress_rule.bucket_override)

    if document.repair.is_partially_recognized:
        partial_rule = get_review_rule(rule_map, "signal", "repair_partial")
        if partial_rule is not None:
            score += partial_rule.weight
            bucket = apply_bucket_override(bucket, partial_rule.bucket_override)

    if manual_review_reason_codes:
        reason_score = 0
        reason_bucket = bucket
        for code in manual_review_reason_codes:
            reason_rule = get_review_rule(rule_map, "manual_review_reason", code)
            if reason_rule is None:
                continue
            reason_score += reason_rule.weight
            reason_bucket = apply_bucket_override(reason_bucket, reason_rule.bucket_override)
        cap_rule = get_review_rule(rule_map, "signal", "manual_review_cap")
        if cap_rule is not None and cap_rule.weight >= 0:
            reason_score = min(reason_score, cap_rule.weight)
        score += reason_score
        bucket = reason_bucket

    if document.ocr_confidence is not None:
        confidence_rule = get_review_rule(rule_map, "signal", "low_ocr_confidence")
        if confidence_rule is not None:
            score += max(0, round((1 - float(document.ocr_confidence)) * confidence_rule.weight))
            bucket = apply_bucket_override(bucket, confidence_rule.bucket_override)

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
        "document_kind": document.kind.value,
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
    if action == "employee_confirm":
        action_label = "Подтверждено сотрудником"
    elif action == "confirm":
        action_label = "Подтверждено администратором"
    else:
        action_label = "Возвращено в ручную проверку"
    note_line = f"[{action_label}] {current_user.full_name}: {normalized_comment}"
    if existing:
        return f"{existing}\n{note_line}"
    return note_line


def collect_missing_confirmation_fields(document: Document) -> list[str]:
    repair = document.repair
    missing_fields: list[str] = []

    if repair.vehicle is None or repair.vehicle.external_id == PLACEHOLDER_EXTERNAL_ID:
        missing_fields.append("машина")
    if not repair.order_number:
        missing_fields.append("номер заказ-наряда")
    if repair.repair_date is None:
        missing_fields.append("дата ремонта")
    if repair.service is None:
        missing_fields.append("сервис")
    if repair.mileage is None or int(repair.mileage) <= 0:
        missing_fields.append("пробег")
    if repair.grand_total is None or float(repair.grand_total) <= 0:
        missing_fields.append("итоговая сумма")

    return missing_fields


def apply_review_action(document: Document, action: str, comment: Optional[str], current_user: User) -> str:
    if action == "employee_confirm":
        document.status = DocumentStatus.CONFIRMED
        document.review_queue_priority = 60
        document.repair.status = RepairStatus.EMPLOYEE_CONFIRMED
        document.repair.is_preliminary = True
        document.repair.is_partially_recognized = False
        for check in document.repair.checks:
            if not check.is_resolved:
                check.is_resolved = True
        message = "Заказ-наряд подтверждён сотрудником и отправлен администратору"
    elif action == "confirm":
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


def serialize_review_item(
    document: Document,
    rule_map: dict[tuple[str, str], ReviewRule],
) -> dict:
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
    manual_review_reason_codes, manual_review_reasons = label_manual_review_reasons(
        parsed_payload.get("manual_review_reasons") if isinstance(parsed_payload, dict) else None,
        rule_map,
    )
    category = determine_review_category(document, unresolved_checks)

    issue_titles: list[str] = []
    document_status_rule = get_review_rule(rule_map, "document_status", document.status.value)
    append_issue(issue_titles, document_status_rule.title if document_status_rule is not None else None)
    repair_status_rule = get_review_rule(rule_map, "repair_status", repair.status.value)
    append_issue(issue_titles, repair_status_rule.title if repair_status_rule is not None else None)
    for reason in manual_review_reasons:
        append_issue(issue_titles, reason)
    for check in unresolved_checks:
        append_issue(issue_titles, check.title)

    priority_score, priority_bucket = build_priority(document, unresolved_checks, manual_review_reason_codes, rule_map)

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
            "kind": document.kind,
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
            "external_id": vehicle.external_id,
            "vehicle_type": vehicle.vehicle_type,
            "plate_number": vehicle.plate_number,
            "brand": vehicle.brand,
            "model": vehicle.model,
        },
    }


@router.get("/rules", response_model=ReviewRuleListResponse)
def list_review_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReviewRuleListResponse:
    _ = current_user
    stmt = select(ReviewRule).order_by(ReviewRule.sort_order.asc(), ReviewRule.rule_type.asc(), ReviewRule.code.asc())
    items = db.scalars(stmt).all()
    return ReviewRuleListResponse(
        items=[ReviewRuleRead.model_validate(item) for item in items],
        rule_types=sorted({item.rule_type for item in items}),
    )


@router.post("/rules", response_model=ReviewRuleRead)
def create_review_rule(
    payload: ReviewRuleCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ReviewRuleRead:
    _ = current_admin
    normalized_rule_type, normalized_code, normalized_title, normalized_bucket_override = validate_review_rule_payload(
        rule_type=payload.rule_type,
        code=payload.code,
        title=payload.title,
        bucket_override=payload.bucket_override,
    )
    if not normalized_rule_type or not normalized_code or not normalized_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Тип, код и название правила обязательны")

    existing = db.scalar(
        select(ReviewRule).where(
            ReviewRule.rule_type == normalized_rule_type,
            ReviewRule.code == normalized_code,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Такое правило уже существует")

    rule = ReviewRule(
        rule_type=normalized_rule_type,
        code=normalized_code,
        title=normalized_title,
        weight=payload.weight,
        bucket_override=normalized_bucket_override,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        notes=normalize_rule_text(payload.notes),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return ReviewRuleRead.model_validate(rule)


@router.patch("/rules/{rule_id}", response_model=ReviewRuleRead)
def update_review_rule(
    rule_id: int,
    payload: ReviewRuleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ReviewRuleRead:
    _ = current_admin
    rule = get_review_rule_or_404(db, rule_id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return ReviewRuleRead.model_validate(rule)

    _, _, normalized_title, normalized_bucket_override = validate_review_rule_payload(
        rule_type=None,
        code=None,
        title=update_data.get("title"),
        bucket_override=update_data.get("bucket_override"),
    )

    if "title" in update_data:
        rule.title = normalized_title or rule.title
    if "weight" in update_data:
        rule.weight = int(update_data["weight"])
    if "bucket_override" in update_data:
        rule.bucket_override = normalized_bucket_override
    if "is_active" in update_data:
        rule.is_active = bool(update_data["is_active"])
    if "sort_order" in update_data:
        rule.sort_order = int(update_data["sort_order"])
    if "notes" in update_data:
        rule.notes = normalize_rule_text(update_data["notes"])

    db.add(rule)
    db.commit()
    db.refresh(rule)
    return ReviewRuleRead.model_validate(rule)


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
        .where(
            Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
            review_filter,
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
        )
    )
    count_stmt = (
        select(func.count(Document.id))
        .join(Document.repair)
        .where(
            Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
            review_filter,
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
        )
    )

    if current_user.role != UserRole.ADMIN:
        visibility_clause = get_repair_visibility_clause(current_user)
        stmt = stmt.where(visibility_clause)
        count_stmt = count_stmt.where(visibility_clause)

    total = db.scalar(count_stmt) or 0
    documents = db.execute(stmt).unique().scalars().all()
    rule_map = build_review_rule_map(db)
    serialized_items = [serialize_review_item(document, rule_map) for document in documents]
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

    if action == "employee_confirm" and current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee confirmation is only available for employees")

    if action == "confirm" and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    document = get_visible_document(db, current_user, document_id)
    if action in {"employee_confirm", "confirm"}:
        missing_fields = collect_missing_confirmation_fields(document)
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Нельзя подтвердить документ. Заполните обязательные поля: {', '.join(missing_fields)}",
            )
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
        rule_map = build_review_rule_map(db)
        review_item = serialize_review_item(refreshed_document, rule_map)

    return ReviewActionResponse(
        message=message,
        document_id=refreshed_document.id,
        repair_id=refreshed_document.repair.id,
        document_status=refreshed_document.status,
        repair_status=refreshed_document.repair.status,
        queue_item=review_item,
    )
