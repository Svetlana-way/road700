from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import UserRole
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.audit import AuditLogItemRead, AuditLogListResponse


router = APIRouter(prefix="/audit", tags=["audit"])


def build_audit_visibility_clause(current_user: User):
    if current_user.role == UserRole.ADMIN:
        return True

    allowed_vehicle_ids = get_allowed_vehicle_ids_query(current_user)
    repair_visible = and_(
        AuditLog.entity_type == "repair",
        AuditLog.entity_id.in_(
            select(func.cast(Repair.id, type_=AuditLog.entity_id.type)).where(Repair.vehicle_id.in_(allowed_vehicle_ids))
        ),
    )
    document_visible = and_(
        AuditLog.entity_type == "document",
        AuditLog.entity_id.in_(
            select(func.cast(Document.id, type_=AuditLog.entity_id.type))
            .join(Repair, Repair.id == Document.repair_id)
            .where(Repair.vehicle_id.in_(allowed_vehicle_ids))
        ),
    )
    vehicle_visible = and_(
        AuditLog.entity_type == "vehicle",
        AuditLog.entity_id.in_(
            select(func.cast(Vehicle.id, type_=AuditLog.entity_id.type)).where(Vehicle.id.in_(allowed_vehicle_ids))
        ),
    )
    own_entries = AuditLog.user_id == current_user.id
    return or_(repair_visible, document_visible, vehicle_visible, own_entries)


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
    current_user: User = Depends(get_current_active_user),
) -> AuditLogListResponse:
    visibility_clause = build_audit_visibility_clause(current_user)

    stmt = select(AuditLog).options(joinedload(AuditLog.user))
    count_stmt = select(func.count(AuditLog.id))
    action_types_stmt = select(distinct(AuditLog.action_type))
    entity_types_stmt = select(distinct(AuditLog.entity_type))

    for current_stmt in (stmt, count_stmt, action_types_stmt, entity_types_stmt):
        if visibility_clause is not True:
            current_stmt = current_stmt.where(visibility_clause)

    if visibility_clause is not True:
        stmt = stmt.where(visibility_clause)
        count_stmt = count_stmt.where(visibility_clause)
        action_types_stmt = action_types_stmt.where(visibility_clause)
        entity_types_stmt = entity_types_stmt.where(visibility_clause)

    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
        count_stmt = count_stmt.where(AuditLog.entity_type == entity_type)
        action_types_stmt = action_types_stmt.where(AuditLog.entity_type == entity_type)
        entity_types_stmt = entity_types_stmt.where(AuditLog.entity_type == entity_type)

    if action_type:
        stmt = stmt.where(AuditLog.action_type == action_type)
        count_stmt = count_stmt.where(AuditLog.action_type == action_type)
        action_types_stmt = action_types_stmt.where(AuditLog.action_type == action_type)
        entity_types_stmt = entity_types_stmt.where(AuditLog.action_type == action_type)

    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
        count_stmt = count_stmt.where(AuditLog.user_id == user_id)
        action_types_stmt = action_types_stmt.where(AuditLog.user_id == user_id)
        entity_types_stmt = entity_types_stmt.where(AuditLog.user_id == user_id)

    if search:
        normalized_query = f"%{search.strip().lower()}%"
        search_clause = or_(
            func.lower(AuditLog.entity_type).like(normalized_query),
            func.lower(AuditLog.entity_id).like(normalized_query),
            func.lower(AuditLog.action_type).like(normalized_query),
        )
        stmt = stmt.where(search_clause)
        count_stmt = count_stmt.where(search_clause)
        action_types_stmt = action_types_stmt.where(search_clause)
        entity_types_stmt = entity_types_stmt.where(search_clause)

    if date_from is not None:
        stmt = stmt.where(AuditLog.created_at >= date_from)
        count_stmt = count_stmt.where(AuditLog.created_at >= date_from)
        action_types_stmt = action_types_stmt.where(AuditLog.created_at >= date_from)
        entity_types_stmt = entity_types_stmt.where(AuditLog.created_at >= date_from)

    if date_to is not None:
        upper_bound = date_to + timedelta(days=1)
        stmt = stmt.where(AuditLog.created_at < upper_bound)
        count_stmt = count_stmt.where(AuditLog.created_at < upper_bound)
        action_types_stmt = action_types_stmt.where(AuditLog.created_at < upper_bound)
        entity_types_stmt = entity_types_stmt.where(AuditLog.created_at < upper_bound)

    items = db.execute(
        stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit)
    ).scalars().all()

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
                old_value=item.old_value,
                new_value=item.new_value,
            )
            for item in items
        ],
        total=db.scalar(count_stmt) or 0,
        limit=limit,
        offset=offset,
        action_types=sorted(value for value in db.scalars(action_types_stmt.order_by(AuditLog.action_type.asc())).all() if value),
        entity_types=sorted(value for value in db.scalars(entity_types_stmt.order_by(AuditLog.entity_type.asc())).all() if value),
    )
