from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.application.manual_review_labels import MANUAL_REVIEW_REASON_LABELS
from app.application.documents.actions import ensure_document_is_operational, ensure_document_visible_to_user
from app.application.documents.document_versions import get_latest_document_version
from app.application.services.visibility import get_repair_visibility_clause
from app.application.review.queue_support import (
    REVIEWABLE_DOCUMENT_KINDS,
    REVIEWABLE_DOCUMENT_STATUSES,
    REVIEWABLE_REPAIR_STATUSES,
    build_reviewable_documents_filter,
    build_suspicious_checks_exist_expr,
    count_blocking_unresolved_checks,
    has_blocking_unresolved_checks,
)
from app.application.review.rules import (
    apply_bucket_override,
    build_review_rule_map,
    get_review_rule,
    humanize_review_code,
    normalize_rule_code,
)
from app.constants.vehicles import PLACEHOLDER_EXTERNAL_ID
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import CheckSeverity, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus
from app.models.repair import Repair, RepairCheck
from app.models.review_rule import ReviewRule
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.review import ReviewActionResponse, ReviewQueueResponse

REVIEW_ACTIONS = {"employee_confirm", "confirm", "send_to_review"}
REVIEW_QUEUE_CATEGORIES = {
    "all",
    "suspicious",
    "ocr_error",
    "partial_recognition",
    "employee_confirmation",
    "manual_review",
}


def build_review_queue_category_expression() -> object:
    suspicious_checks_exist = build_suspicious_checks_exist_expr()
    return case(
        (
            or_(Document.status == DocumentStatus.OCR_ERROR, Repair.status == RepairStatus.OCR_ERROR),
            "ocr_error",
        ),
        (
            or_(Repair.status == RepairStatus.SUSPICIOUS, suspicious_checks_exist),
            "suspicious",
        ),
        (Repair.status == RepairStatus.EMPLOYEE_CONFIRMED, "employee_confirmation"),
        (
            or_(
                Document.status == DocumentStatus.PARTIALLY_RECOGNIZED,
                Repair.is_partially_recognized.is_(True),
            ),
            "partial_recognition",
        ),
        else_="manual_review",
    )


def load_document_for_review(db: Session, document_id: int) -> Optional[Document]:
    stmt = (
        select(Document)
        .join(Document.repair)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).joinedload(Repair.service),
            joinedload(Document.repair).selectinload(Repair.checks),
            selectinload(Document.versions),
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
        fallback_label = MANUAL_REVIEW_REASON_LABELS.get(code)
        if fallback_label is not None:
            labels.append(fallback_label)
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
    ensure_document_visible_to_user(db, current_user, document)
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
    if document.status == DocumentStatus.OCR_ERROR or document.repair.status == RepairStatus.OCR_ERROR:
        return "ocr_error"
    if document.repair.status == RepairStatus.SUSPICIOUS:
        return "suspicious"
    if has_blocking_unresolved_checks(unresolved_checks):
        return "suspicious"
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


def is_document_in_review_queue(document: Document) -> bool:
    if document.repair is None:
        return False
    if document.status == DocumentStatus.UPLOADED:
        return False
    if document.repair.vehicle is None or document.repair.vehicle.status == VehicleStatus.ARCHIVED:
        return False
    if document.repair.service is not None and document.repair.service.status == ServiceStatus.ARCHIVED:
        return False

    has_unresolved_checks = any(not item.is_resolved for item in document.repair.checks)
    return (
        document.kind in REVIEWABLE_DOCUMENT_KINDS
        and document.status != DocumentStatus.ARCHIVED
        and document.repair.status != RepairStatus.ARCHIVED
        and (
            document.status in REVIEWABLE_DOCUMENT_STATUSES
            or document.repair.status in REVIEWABLE_REPAIR_STATUSES
            or document.repair.is_partially_recognized
            or has_unresolved_checks
        )
    )


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


def collect_unresolved_confirmation_findings(document: Document) -> list[str]:
    unresolved_checks = [item for item in document.repair.checks if not item.is_resolved]
    findings: list[str] = []
    for check in unresolved_checks:
        title = check.title.strip() if isinstance(check.title, str) else ""
        if title and title not in findings:
            findings.append(title)
    return findings


def apply_review_action(document: Document, action: str, comment: Optional[str], current_user: User) -> str:
    if action == "employee_confirm":
        document.status = DocumentStatus.CONFIRMED
        document.review_queue_priority = 60
        document.repair.status = RepairStatus.EMPLOYEE_CONFIRMED
        document.repair.is_preliminary = True
        document.repair.is_partially_recognized = False
        message = "Заказ-наряд подтверждён сотрудником и отправлен администратору"
    elif action == "confirm":
        document.status = DocumentStatus.CONFIRMED
        document.review_queue_priority = 20
        document.repair.status = RepairStatus.CONFIRMED
        document.repair.is_preliminary = False
        document.repair.is_partially_recognized = False
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
    latest_version = get_latest_document_version(document)
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
            "suspicious_checks_total": count_blocking_unresolved_checks(unresolved_checks),
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


def build_review_queue_response(
    db: Session,
    *,
    current_user: User,
    limit: int,
    offset: int,
    category: str,
) -> ReviewQueueResponse:
    if category not in REVIEW_QUEUE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported review category")

    review_filter = build_reviewable_documents_filter()
    category_expression = build_review_queue_category_expression()

    stmt = (
        select(Document)
        .join(Document.repair)
        .options(
            joinedload(Document.repair).joinedload(Repair.vehicle),
            joinedload(Document.repair).selectinload(Repair.checks),
            selectinload(Document.versions),
        )
        .where(
            Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
            review_filter,
            Document.status != DocumentStatus.UPLOADED,
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
            Repair.vehicle.has(Vehicle.status != VehicleStatus.ARCHIVED),
            or_(Repair.service_id.is_(None), Repair.service.has(Service.status != ServiceStatus.ARCHIVED)),
        )
    )
    counts_stmt = (
        select(category_expression.label("category"), func.count(Document.id).label("total"))
        .join(Document.repair)
        .where(
            Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
            review_filter,
            Document.status != DocumentStatus.UPLOADED,
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
            Repair.vehicle.has(Vehicle.status != VehicleStatus.ARCHIVED),
            or_(Repair.service_id.is_(None), Repair.service.has(Service.status != ServiceStatus.ARCHIVED)),
        )
        .group_by(category_expression)
    )

    if current_user.role != UserRole.ADMIN:
        visibility_clause = get_repair_visibility_clause(current_user)
        stmt = stmt.where(visibility_clause)
        counts_stmt = counts_stmt.where(visibility_clause)

    counts = {name: 0 for name in REVIEW_QUEUE_CATEGORIES}
    for row in db.execute(counts_stmt):
        counts[str(row.category)] = int(row.total)
    counts["all"] = sum(value for key, value in counts.items() if key != "all")

    if category != "all":
        stmt = stmt.where(category_expression == category)

    documents = db.execute(stmt).unique().scalars().all()
    rule_map = build_review_rule_map(db)
    serialized_items = [serialize_review_item(document, rule_map) for document in documents]
    items = serialized_items
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
        total=counts[category] if category != "all" else counts["all"],
        limit=limit,
        offset=offset,
    )


def execute_review_action_response(
    db: Session,
    *,
    current_user: User,
    document_id: int,
    action: str,
    comment: Optional[str],
) -> ReviewActionResponse:
    if action not in REVIEW_ACTIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported review action")

    if action == "employee_confirm" and current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee confirmation is only available for employees")

    if action == "confirm" and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    document = get_visible_document(db, current_user, document_id)
    ensure_document_is_operational(document)
    if not is_document_in_review_queue(document):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Document is not in review queue")

    if action == "employee_confirm" and document.repair.status == RepairStatus.EMPLOYEE_CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repair is already confirmed by employee and is waiting for admin review",
        )

    if action in {"employee_confirm", "confirm"}:
        missing_fields = collect_missing_confirmation_fields(document)
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Нельзя подтвердить документ. Заполните обязательные поля: {', '.join(missing_fields)}",
            )
        unresolved_findings = collect_unresolved_confirmation_findings(document)
        if unresolved_findings:
            preview = ", ".join(unresolved_findings[:3])
            if len(unresolved_findings) > 3:
                preview = f"{preview} и ещё {len(unresolved_findings) - 3}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Нельзя подтвердить документ. Сначала разберите все предупреждения и несоответствия: "
                    f"{preview}"
                ),
            )
    old_snapshot = build_repair_state_snapshot(document)
    message = apply_review_action(document, action, comment, current_user)

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
    if is_document_in_review_queue(refreshed_document):
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
