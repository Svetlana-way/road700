from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin, get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogItemRead, AuditLogListResponse


router = APIRouter(prefix="/audit", tags=["audit"])


def coerce_json_object(value: object) -> dict:
    return dict(value) if isinstance(value, dict) else {}


def build_audit_filters(
    *,
    entity_type: Optional[str],
    action_type: Optional[str],
    user_id: Optional[int],
    search: Optional[str],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
):
    filters = []
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)

    if action_type:
        filters.append(AuditLog.action_type == action_type)

    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)

    if search:
        normalized_query = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(AuditLog.entity_type).like(normalized_query),
                func.lower(AuditLog.entity_id).like(normalized_query),
                func.lower(AuditLog.action_type).like(normalized_query),
            )
        )

    if date_from is not None:
        filters.append(AuditLog.created_at >= date_from)

    if date_to is not None:
        upper_bound = date_to + timedelta(days=1)
        filters.append(AuditLog.created_at < upper_bound)

    return filters


@router.get("", response_model=AuditLogListResponse)
def list_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    entity_type: Optional[str] = Query(default=None),
    action_type: Optional[str] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> AuditLogListResponse:
    _ = current_admin
    filters = build_audit_filters(
        entity_type=entity_type,
        action_type=action_type,
        user_id=user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )

    items = db.execute(
        select(AuditLog)
        .options(joinedload(AuditLog.user))
        .where(*filters)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
    ).scalars().all()
    metadata_rows = db.execute(
        select(
            AuditLog.action_type.label("action_type"),
            AuditLog.entity_type.label("entity_type"),
        )
        .distinct()
        .where(*filters)
        .order_by(AuditLog.action_type.asc(), AuditLog.entity_type.asc())
    ).all()

    return AuditLogListResponse(
        items=[
            AuditLogItemRead(
                id=item.id,
                created_at=item.created_at,
                user_id=item.user_id,
                user_name=item.user.full_name if item.user is not None else None,
                entity_type=item.entity_type,
                entity_id=item.entity_id,
                action_type=item.action_type,
                old_value=coerce_json_object(item.old_value) if item.old_value is not None else None,
                new_value=coerce_json_object(item.new_value) if item.new_value is not None else None,
            )
            for item in items
        ],
        total=db.scalar(select(func.count(AuditLog.id)).where(*filters)) or 0,
        limit=limit,
        offset=offset,
        action_types=sorted({row.action_type for row in metadata_rows if row.action_type}),
        entity_types=sorted({row.entity_type for row in metadata_rows if row.entity_type}),
    )
