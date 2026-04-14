from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, func, or_, select, true
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.application.services.visibility import get_visible_services_stmt
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.service import ServiceCreate, ServiceListResponse, ServiceRead, ServiceUpdate
from app.services.service_catalog import (
    ensure_service_catalog_synced,
    find_service_catalog_entry,
    get_service_catalog_names,
)


router = APIRouter(prefix="/services", tags=["services"])


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized_value = value.strip()
    return normalized_value or None


def normalize_required_name(value: str | None) -> str:
    normalized_value = normalize_optional_text(value)
    if not normalized_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название сервиса обязательно")
    return normalized_value[:255]


def normalize_service_name(value: str | None) -> str:
    normalized_name = normalize_required_name(value)
    entry = find_service_catalog_entry(normalized_name)
    if entry is not None:
        return entry.name
    return normalized_name


def get_service_or_404(db: Session, service_id: int) -> Service:
    service_item = db.scalar(select(Service).where(Service.id == service_id))
    if service_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сервис не найден")
    return service_item


def ensure_service_is_operational(service_item: Service) -> None:
    if service_item.status == ServiceStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Архивные сервисы доступны только для чтения")


def ensure_service_is_not_archived(service_item: Service) -> None:
    if service_item.status == ServiceStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Service is already archived")


def ensure_service_can_be_archived(db: Session, service_item: Service) -> None:
    active_repair_id = db.scalar(
        select(Repair.id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .where(
            Repair.service_id == service_item.id,
            Repair.status != RepairStatus.ARCHIVED,
            Vehicle.status != VehicleStatus.ARCHIVED,
        )
        .limit(1)
    )
    if active_repair_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя архивировать сервис с активными ремонтами",
        )

    active_document_id = db.scalar(
        select(Document.id)
        .join(Repair, Repair.id == Document.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .where(
            Repair.service_id == service_item.id,
            Repair.status != RepairStatus.ARCHIVED,
            Vehicle.status != VehicleStatus.ARCHIVED,
            Document.status != DocumentStatus.ARCHIVED,
        )
        .limit(1)
    )
    if active_document_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя архивировать сервис с активными документами",
        )


def resolve_service_restore_status(service_item: Service) -> ServiceStatus:
    return ServiceStatus.CONFIRMED if service_item.confirmed_by_user_id is not None else ServiceStatus.PRELIMINARY


def ensure_service_can_be_restored(service_item: Service) -> None:
    if service_item.status != ServiceStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Service is not archived")


def build_service_audit_snapshot(service_item: Service) -> dict[str, object]:
    return {
        "name": service_item.name,
        "city": service_item.city,
        "contact": service_item.contact,
        "comment": service_item.comment,
        "status": service_item.status.value,
        "created_by_user_id": service_item.created_by_user_id,
        "confirmed_by_user_id": service_item.confirmed_by_user_id,
    }


@router.get("", response_model=ServiceListResponse)
def list_services(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    city: str | None = Query(default=None),
    status_filter: ServiceStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ServiceListResponse:
    ensure_service_catalog_synced(db, commit=False)
    visible_services = get_visible_services_stmt()
    stmt = select(Service).where(visible_services)
    count_stmt = select(func.count(Service.id)).where(visible_services)
    query_filter = None

    if q:
        normalized_query = f"%{q.strip().lower()}%"
        query_filter = or_(
            func.lower(Service.name).like(normalized_query),
            func.lower(func.coalesce(Service.city, "")).like(normalized_query),
            func.lower(func.coalesce(Service.contact, "")).like(normalized_query),
            func.lower(func.coalesce(Service.comment, "")).like(normalized_query),
        )
        stmt = stmt.where(query_filter)
        count_stmt = count_stmt.where(query_filter)

    if city:
        stmt = stmt.where(Service.city == city)
        count_stmt = count_stmt.where(Service.city == city)

    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Service.status != ServiceStatus.ARCHIVED)
        count_stmt = count_stmt.where(Service.status != ServiceStatus.ARCHIVED)
    if status_filter is not None:
        stmt = stmt.where(Service.status == status_filter)
        count_stmt = count_stmt.where(Service.status == status_filter)
    elif current_user.role == UserRole.ADMIN:
        stmt = stmt.where(Service.status != ServiceStatus.ARCHIVED)
        count_stmt = count_stmt.where(Service.status != ServiceStatus.ARCHIVED)

    stmt = stmt.order_by(Service.name.asc(), Service.id.asc()).offset(offset).limit(limit)
    items = db.execute(stmt).scalars().all()
    total = db.scalar(count_stmt) or 0
    cities = db.scalars(
        select(distinct(Service.city))
        .where(
            visible_services,
            Service.city.is_not(None),
            query_filter if query_filter is not None else true(),
            Service.status != ServiceStatus.ARCHIVED if current_user.role != UserRole.ADMIN else true(),
            Service.status == status_filter if status_filter is not None else Service.status != ServiceStatus.ARCHIVED,
            Service.city == city if city else true(),
        )
        .order_by(Service.city.asc())
    ).all()

    return ServiceListResponse(
        items=[ServiceRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        cities=[item for item in cities if item],
    )


@router.post("", response_model=ServiceRead)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ServiceRead:
    ensure_service_catalog_synced(db, commit=False)
    if payload.status == ServiceStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Use explicit archive endpoint for service archive changes",
        )
    normalized_name = normalize_service_name(payload.name)
    existing = db.scalar(select(Service).where(func.lower(Service.name) == normalized_name.lower()))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Сервис `{normalized_name}` уже существует",
        )

    service_item = Service(
        name=normalized_name,
        city=normalize_optional_text(payload.city),
        contact=normalize_optional_text(payload.contact),
        comment=normalize_optional_text(payload.comment),
        status=payload.status if current_user.role == UserRole.ADMIN else ServiceStatus.PRELIMINARY,
        created_by_user_id=current_user.id,
        confirmed_by_user_id=(
            current_user.id
            if current_user.role == UserRole.ADMIN and payload.status == ServiceStatus.CONFIRMED
            else None
        ),
    )
    db.add(service_item)
    db.flush()
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="service",
            entity_id=str(service_item.id),
            action_type="service_created",
            old_value=None,
            new_value=build_service_audit_snapshot(service_item),
        )
    )
    db.commit()
    db.refresh(service_item)
    return ServiceRead.model_validate(service_item)


@router.patch("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ServiceRead:
    ensure_service_catalog_synced(db, commit=False)
    service_item = get_service_or_404(db, service_id)
    ensure_service_is_operational(service_item)
    old_snapshot = build_service_audit_snapshot(service_item)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return ServiceRead.model_validate(service_item)

    if "status" in update_data and update_data["status"] != service_item.status and (
        update_data["status"] == ServiceStatus.ARCHIVED or service_item.status == ServiceStatus.ARCHIVED
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Use explicit archive/restore endpoints for service archive changes",
        )

    if "name" in update_data:
        normalized_name = normalize_service_name(update_data["name"])
        duplicate = db.scalar(
            select(Service).where(
                func.lower(Service.name) == normalized_name.lower(),
                Service.id != service_item.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Сервис `{normalized_name}` уже существует",
            )
        service_item.name = normalized_name

    if "city" in update_data:
        service_item.city = normalize_optional_text(update_data["city"])
    if "contact" in update_data:
        service_item.contact = normalize_optional_text(update_data["contact"])
    if "comment" in update_data:
        service_item.comment = normalize_optional_text(update_data["comment"])
    if "status" in update_data:
        service_item.status = update_data["status"]
        if service_item.status == ServiceStatus.CONFIRMED and service_item.confirmed_by_user_id is None:
            service_item.confirmed_by_user_id = current_admin.id

    db.add(service_item)
    db.flush()
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="service",
            entity_id=str(service_item.id),
            action_type="service_updated",
            old_value=old_snapshot,
            new_value=build_service_audit_snapshot(service_item),
        )
    )
    db.commit()
    db.refresh(service_item)
    return ServiceRead.model_validate(service_item)


@router.post("/{service_id}/archive", response_model=ServiceRead)
def archive_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ServiceRead:
    ensure_service_catalog_synced(db, commit=False)
    service_item = get_service_or_404(db, service_id)
    ensure_service_is_not_archived(service_item)
    ensure_service_can_be_archived(db, service_item)

    old_snapshot = build_service_audit_snapshot(service_item)
    service_item.status = ServiceStatus.ARCHIVED
    db.add(service_item)
    db.flush()
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="service",
            entity_id=str(service_item.id),
            action_type="service_archived",
            old_value=old_snapshot,
            new_value=build_service_audit_snapshot(service_item),
        )
    )
    db.commit()
    db.refresh(service_item)
    return ServiceRead.model_validate(service_item)


@router.post("/{service_id}/restore", response_model=ServiceRead)
def restore_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ServiceRead:
    ensure_service_catalog_synced(db, commit=False)
    service_item = get_service_or_404(db, service_id)
    ensure_service_can_be_restored(service_item)

    old_snapshot = build_service_audit_snapshot(service_item)
    service_item.status = resolve_service_restore_status(service_item)
    db.add(service_item)
    db.flush()
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="service",
            entity_id=str(service_item.id),
            action_type="service_restored",
            old_value=old_snapshot,
            new_value=build_service_audit_snapshot(service_item),
        )
    )
    db.commit()
    db.refresh(service_item)
    return ServiceRead.model_validate(service_item)
