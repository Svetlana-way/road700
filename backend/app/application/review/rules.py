from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.review_rule import ReviewRule
from app.schemas.review import ReviewRuleCreate, ReviewRuleListResponse, ReviewRuleRead, ReviewRuleUpdate

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


def list_review_rules_response(db: Session) -> ReviewRuleListResponse:
    stmt = select(ReviewRule).order_by(ReviewRule.sort_order.asc(), ReviewRule.rule_type.asc(), ReviewRule.code.asc())
    items = db.scalars(stmt).all()
    return ReviewRuleListResponse(
        items=[ReviewRuleRead.model_validate(item) for item in items],
        rule_types=sorted({item.rule_type for item in items}),
    )


def create_review_rule_response(
    db: Session,
    *,
    payload: ReviewRuleCreate,
) -> ReviewRuleRead:
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


def update_review_rule_response(
    db: Session,
    *,
    rule_id: int,
    payload: ReviewRuleUpdate,
) -> ReviewRuleRead:
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
