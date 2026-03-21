from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, func, or_, select, true
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.enums import ServiceStatus, UserRole
from app.models.service import Service
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceListResponse, ServiceRead, ServiceUpdate
from app.services.service_catalog import (
    ensure_service_catalog_synced,
    find_service_catalog_entry,
    get_service_catalog_names,
)


router = APIRouter(prefix="/services", tags=["services"])


def get_visible_services_stmt():
    catalog_names = get_service_catalog_names()
    return or_(
        Service.name.in_(catalog_names),
        Service.created_by_user_id.is_not(None),
        Service.confirmed_by_user_id.is_not(None),
    )


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
    _ = current_user
    ensure_service_catalog_synced(db, commit=False)
    visible_services = get_visible_services_stmt()
    stmt = select(Service).where(visible_services)
    count_stmt = select(func.count(Service.id)).where(visible_services)

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

    if status_filter is not None:
        stmt = stmt.where(Service.status == status_filter)
        count_stmt = count_stmt.where(Service.status == status_filter)
    else:
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
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return ServiceRead.model_validate(service_item)

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
    if service_item.confirmed_by_user_id is None:
        service_item.confirmed_by_user_id = current_admin.id
    if "status" in update_data:
        service_item.status = update_data["status"]
        if service_item.status == ServiceStatus.CONFIRMED:
            service_item.confirmed_by_user_id = current_admin.id

    db.add(service_item)
    db.commit()
    db.refresh(service_item)
    return ServiceRead.model_validate(service_item)
