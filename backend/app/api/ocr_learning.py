from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, func, select, true
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.models.ocr_learning_signal import OcrLearningSignal
from app.models.user import User
from app.schemas.ocr_learning import (
    OcrLearningSignalListResponse,
    OcrLearningSignalRead,
    OcrLearningSignalUpdate,
    OcrLearningSummaryRead,
)


router = APIRouter(prefix="/ocr-learning", tags=["ocr-learning"])

ALLOWED_SIGNAL_STATUSES = {"new", "reviewed", "applied", "rejected"}


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def get_signal_or_404(db: Session, signal_id: int) -> OcrLearningSignal:
    item = db.scalar(select(OcrLearningSignal).where(OcrLearningSignal.id == signal_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR-сигнал обучения не найден")
    return item


def build_learning_summaries(items: list[OcrLearningSignal]) -> list[OcrLearningSummaryRead]:
    grouped: dict[tuple[str, str | None, str], list[OcrLearningSignal]] = defaultdict(list)
    for item in items:
        grouped[(item.target_field, item.ocr_profile_scope, item.signal_type)].append(item)

    summaries: list[OcrLearningSummaryRead] = []
    for (target_field, profile_scope, signal_type), group_items in sorted(
        grouped.items(),
        key=lambda item: (len(item[1]), item[0][0], item[0][1] or "", item[0][2]),
        reverse=True,
    ):
        if signal_type == "missing":
            suggestion = f"Добавить или усилить OCR-правило для поля `{target_field}`"
        else:
            suggestion = f"Уточнить OCR-правило для поля `{target_field}` или выделить отдельный профиль"
        if profile_scope and profile_scope != "default":
            suggestion = f"{suggestion} в профиле `{profile_scope}`"
        elif profile_scope == "default":
            suggestion = f"{suggestion}; возможно, документу нужен отдельный профиль вместо `default`"

        services = list(dict.fromkeys(item.service_name for item in group_items if item.service_name))[:3]
        filenames = list(dict.fromkeys(item.document_filename for item in group_items if item.document_filename))[:3]
        summaries.append(
            OcrLearningSummaryRead(
                target_field=target_field,
                ocr_profile_scope=profile_scope,
                signal_type=signal_type,
                count=len(group_items),
                suggestion_summary=suggestion,
                example_services=services,
                example_filenames=filenames,
            )
        )
    return summaries


@router.get("/signals", response_model=OcrLearningSignalListResponse)
def list_ocr_learning_signals(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status_filter: str | None = Query(default=None, alias="status"),
    target_field: str | None = Query(default=None),
    profile_scope: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> OcrLearningSignalListResponse:
    _ = current_admin
    stmt = select(OcrLearningSignal)
    count_stmt = select(func.count(OcrLearningSignal.id))

    if status_filter:
        stmt = stmt.where(OcrLearningSignal.status == status_filter)
        count_stmt = count_stmt.where(OcrLearningSignal.status == status_filter)
    else:
        stmt = stmt.where(OcrLearningSignal.status != "rejected")
        count_stmt = count_stmt.where(OcrLearningSignal.status != "rejected")

    if target_field:
        stmt = stmt.where(OcrLearningSignal.target_field == target_field)
        count_stmt = count_stmt.where(OcrLearningSignal.target_field == target_field)
    if profile_scope:
        stmt = stmt.where(OcrLearningSignal.ocr_profile_scope == profile_scope)
        count_stmt = count_stmt.where(OcrLearningSignal.ocr_profile_scope == profile_scope)

    stmt = stmt.order_by(OcrLearningSignal.created_at.desc(), OcrLearningSignal.id.desc())
    total = db.scalar(count_stmt) or 0
    items = db.scalars(stmt.offset(offset).limit(limit)).all()

    summary_stmt = select(OcrLearningSignal)
    if status_filter:
        summary_stmt = summary_stmt.where(OcrLearningSignal.status == status_filter)
    else:
        summary_stmt = summary_stmt.where(OcrLearningSignal.status != "rejected")
    if target_field:
        summary_stmt = summary_stmt.where(OcrLearningSignal.target_field == target_field)
    if profile_scope:
        summary_stmt = summary_stmt.where(OcrLearningSignal.ocr_profile_scope == profile_scope)
    summary_items = db.scalars(summary_stmt).all()

    statuses = db.scalars(select(distinct(OcrLearningSignal.status)).order_by(OcrLearningSignal.status.asc())).all()
    target_fields = db.scalars(
        select(distinct(OcrLearningSignal.target_field))
        .where(OcrLearningSignal.status == status_filter if status_filter else true())
        .order_by(OcrLearningSignal.target_field.asc())
    ).all()
    profile_scopes = db.scalars(
        select(distinct(OcrLearningSignal.ocr_profile_scope))
        .where(
            OcrLearningSignal.ocr_profile_scope.is_not(None),
            OcrLearningSignal.status == status_filter if status_filter else true(),
        )
        .order_by(OcrLearningSignal.ocr_profile_scope.asc())
    ).all()

    return OcrLearningSignalListResponse(
        items=[OcrLearningSignalRead.model_validate(item) for item in items],
        summaries=build_learning_summaries(summary_items),
        total=total,
        statuses=[item for item in statuses if item],
        target_fields=[item for item in target_fields if item],
        profile_scopes=[item for item in profile_scopes if item],
    )


@router.patch("/signals/{signal_id}", response_model=OcrLearningSignalRead)
def update_ocr_learning_signal(
    signal_id: int,
    payload: OcrLearningSignalUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> OcrLearningSignalRead:
    _ = current_admin
    item = get_signal_or_404(db, signal_id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return OcrLearningSignalRead.model_validate(item)

    if "status" in update_data:
        normalized_status = normalize_optional_text(update_data["status"])
        if normalized_status not in ALLOWED_SIGNAL_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный статус OCR-сигнала")
        item.status = normalized_status or item.status
    if "notes" in update_data:
        item.notes = normalize_optional_text(update_data["notes"])

    db.add(item)
    db.commit()
    db.refresh(item)
    return OcrLearningSignalRead.model_validate(item)
