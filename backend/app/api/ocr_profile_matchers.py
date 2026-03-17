from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.ocr_profile_matcher import OcrProfileMatcher
from app.models.user import User
from app.schemas.ocr_profile_matcher import (
    OcrProfileMatcherCreate,
    OcrProfileMatcherListResponse,
    OcrProfileMatcherRead,
    OcrProfileMatcherUpdate,
)
from app.services.document_processing import normalize_ocr_rule_code


router = APIRouter(prefix="/ocr-profile-matchers", tags=["ocr-profile-matchers"])

ALLOWED_SOURCE_TYPES = {"pdf", "image"}


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


def validate_pattern(value: str | None, field_name: str) -> str | None:
    normalized = normalize_optional_text(value)
    if normalized is None:
        return None
    try:
        re.compile(normalized, re.IGNORECASE | re.MULTILINE)
    except re.error as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Некорректный regex в поле `{field_name}`: {error}",
        )
    return normalized


def normalize_source_type(value: str | None) -> str | None:
    normalized = normalize_optional_text(value)
    if normalized is None:
        return None
    normalized = normalized.lower()
    if normalized not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный source_type matcher")
    return normalized


def get_matcher_or_404(db: Session, matcher_id: int) -> OcrProfileMatcher:
    item = db.scalar(select(OcrProfileMatcher).where(OcrProfileMatcher.id == matcher_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matcher OCR-профиля не найден")
    return item


@router.get("", response_model=OcrProfileMatcherListResponse)
def list_ocr_profile_matchers(
    profile_scope: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OcrProfileMatcherListResponse:
    _ = current_user
    stmt = select(OcrProfileMatcher).order_by(
        OcrProfileMatcher.profile_scope.asc(),
        OcrProfileMatcher.priority.asc(),
        OcrProfileMatcher.id.asc(),
    )
    if profile_scope:
        stmt = stmt.where(OcrProfileMatcher.profile_scope == profile_scope)
    items = db.scalars(stmt).all()
    profile_scopes = db.scalars(
        select(distinct(OcrProfileMatcher.profile_scope)).order_by(OcrProfileMatcher.profile_scope.asc())
    ).all()
    return OcrProfileMatcherListResponse(
        items=[OcrProfileMatcherRead.model_validate(item) for item in items],
        profile_scopes=[item for item in profile_scopes if item],
    )


@router.post("", response_model=OcrProfileMatcherRead)
def create_ocr_profile_matcher(
    payload: OcrProfileMatcherCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> OcrProfileMatcherRead:
    _ = current_admin
    profile_scope = normalize_ocr_rule_code(payload.profile_scope) or "default"
    title = normalize_required_text(payload.title, "Название matcher обязательно")
    item = OcrProfileMatcher(
        profile_scope=profile_scope,
        title=title,
        source_type=normalize_source_type(payload.source_type),
        filename_pattern=validate_pattern(payload.filename_pattern, "filename_pattern"),
        text_pattern=validate_pattern(payload.text_pattern, "text_pattern"),
        service_name_pattern=validate_pattern(payload.service_name_pattern, "service_name_pattern"),
        priority=int(payload.priority),
        is_active=payload.is_active,
        notes=normalize_optional_text(payload.notes),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return OcrProfileMatcherRead.model_validate(item)


@router.patch("/{matcher_id}", response_model=OcrProfileMatcherRead)
def update_ocr_profile_matcher(
    matcher_id: int,
    payload: OcrProfileMatcherUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> OcrProfileMatcherRead:
    _ = current_admin
    item = get_matcher_or_404(db, matcher_id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return OcrProfileMatcherRead.model_validate(item)

    if "profile_scope" in update_data:
        item.profile_scope = normalize_ocr_rule_code(update_data["profile_scope"]) or "default"
    if "title" in update_data:
        item.title = normalize_required_text(update_data["title"], "Название matcher обязательно")
    if "source_type" in update_data:
        item.source_type = normalize_source_type(update_data["source_type"])
    if "filename_pattern" in update_data:
        item.filename_pattern = validate_pattern(update_data["filename_pattern"], "filename_pattern")
    if "text_pattern" in update_data:
        item.text_pattern = validate_pattern(update_data["text_pattern"], "text_pattern")
    if "service_name_pattern" in update_data:
        item.service_name_pattern = validate_pattern(update_data["service_name_pattern"], "service_name_pattern")
    if "priority" in update_data:
        item.priority = int(update_data["priority"])
    if "is_active" in update_data:
        item.is_active = bool(update_data["is_active"])
    if "notes" in update_data:
        item.notes = normalize_optional_text(update_data["notes"])

    db.add(item)
    db.commit()
    db.refresh(item)
    return OcrProfileMatcherRead.model_validate(item)
