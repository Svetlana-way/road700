from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.ocr_rule import OcrRule
from app.models.user import User
from app.schemas.ocr_rule import OcrRuleCreate, OcrRuleListResponse, OcrRuleRead, OcrRuleUpdate
from app.services.document_processing import ensure_default_ocr_rules, normalize_ocr_rule_code


router = APIRouter(prefix="/ocr-rules", tags=["ocr-rules"])


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def normalize_required_text(value: str | None, detail: str) -> str:
    normalized = normalize_optional_text(value)
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    return normalized


def get_ocr_rule_or_404(db: Session, rule_id: int) -> OcrRule:
    item = db.scalar(select(OcrRule).where(OcrRule.id == rule_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR-правило не найдено")
    return item


def check_rule_duplicate(
    db: Session,
    *,
    profile_scope: str,
    target_field: str,
    pattern: str,
    exclude_id: int | None = None,
) -> None:
    stmt = select(OcrRule).where(
        OcrRule.profile_scope == profile_scope,
        OcrRule.target_field == target_field,
        OcrRule.pattern == pattern,
    )
    if exclude_id is not None:
        stmt = stmt.where(OcrRule.id != exclude_id)
    duplicate = db.scalar(stmt)
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Такое OCR-правило уже существует")


@router.get("", response_model=OcrRuleListResponse)
def list_ocr_rules(
    profile_scope: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OcrRuleListResponse:
    _ = current_user
    ensure_default_ocr_rules(db)
    db.flush()

    stmt = select(OcrRule).order_by(OcrRule.profile_scope.asc(), OcrRule.target_field.asc(), OcrRule.priority.asc(), OcrRule.id.asc())
    if profile_scope:
        stmt = stmt.where(OcrRule.profile_scope == profile_scope)
    items = db.scalars(stmt).all()
    profile_scopes = db.scalars(select(distinct(OcrRule.profile_scope)).order_by(OcrRule.profile_scope.asc())).all()
    target_fields = db.scalars(select(distinct(OcrRule.target_field)).order_by(OcrRule.target_field.asc())).all()
    return OcrRuleListResponse(
        items=[OcrRuleRead.model_validate(item) for item in items],
        profile_scopes=[item for item in profile_scopes if item],
        target_fields=[item for item in target_fields if item],
    )


@router.post("", response_model=OcrRuleRead)
def create_ocr_rule(
    payload: OcrRuleCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> OcrRuleRead:
    _ = current_admin
    ensure_default_ocr_rules(db)
    profile_scope = normalize_ocr_rule_code(payload.profile_scope) or "default"
    target_field = normalize_required_text(payload.target_field, "Поле назначения обязательно")
    pattern = normalize_required_text(payload.pattern, "Regex-шаблон обязателен")
    value_parser = normalize_ocr_rule_code(payload.value_parser) or "raw"
    check_rule_duplicate(db, profile_scope=profile_scope, target_field=target_field, pattern=pattern)

    item = OcrRule(
        profile_scope=profile_scope,
        target_field=target_field,
        pattern=pattern,
        value_parser=value_parser,
        confidence=float(payload.confidence),
        priority=int(payload.priority),
        is_active=payload.is_active,
        notes=normalize_optional_text(payload.notes),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return OcrRuleRead.model_validate(item)


@router.patch("/{rule_id}", response_model=OcrRuleRead)
def update_ocr_rule(
    rule_id: int,
    payload: OcrRuleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> OcrRuleRead:
    _ = current_admin
    ensure_default_ocr_rules(db)
    item = get_ocr_rule_or_404(db, rule_id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return OcrRuleRead.model_validate(item)

    new_profile_scope = normalize_ocr_rule_code(update_data.get("profile_scope", item.profile_scope)) or "default"
    new_target_field = normalize_required_text(update_data.get("target_field", item.target_field), "Поле назначения обязательно")
    new_pattern = normalize_required_text(update_data.get("pattern", item.pattern), "Regex-шаблон обязателен")
    check_rule_duplicate(
        db,
        profile_scope=new_profile_scope,
        target_field=new_target_field,
        pattern=new_pattern,
        exclude_id=item.id,
    )

    item.profile_scope = new_profile_scope
    item.target_field = new_target_field
    item.pattern = new_pattern
    if "value_parser" in update_data:
        item.value_parser = normalize_ocr_rule_code(update_data["value_parser"]) or item.value_parser
    if "confidence" in update_data:
        item.confidence = float(update_data["confidence"])
    if "priority" in update_data:
        item.priority = int(update_data["priority"])
    if "is_active" in update_data:
        item.is_active = bool(update_data["is_active"])
    if "notes" in update_data:
        item.notes = normalize_optional_text(update_data["notes"])

    db.add(item)
    db.commit()
    db.refresh(item)
    return OcrRuleRead.model_validate(item)
