from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin, get_db
from app.core.security import get_password_hash
from app.models.audit import AuditLog
from app.models.enums import UserRole
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory
from app.schemas.user import (
    UserAssignmentCreateRequest,
    UserAssignmentUpdateRequest,
    UserDetailRead,
    UserListResponse,
    UserRead,
    UserResetPasswordRequest,
    UserUpdateRequest,
    UserCreateRequest,
)


router = APIRouter(prefix="/users", tags=["users"])


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def validate_password(value: str | None) -> str | None:
    normalized = normalize_text(value)
    if normalized is None:
        return None
    if len(normalized) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пароль должен быть не короче 8 символов")
    return normalized


def build_user_query():
    return (
        select(User)
        .options(
            joinedload(User.assigned_vehicles).joinedload(VehicleAssignmentHistory.vehicle),
        )
    )


def load_user_or_404(db: Session, user_id: int) -> User:
    user = db.execute(build_user_query().where(User.id == user_id)).unique().scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user


def serialize_assignment(assignment: VehicleAssignmentHistory) -> dict:
    return {
        "id": assignment.id,
        "vehicle_id": assignment.vehicle_id,
        "starts_at": assignment.starts_at,
        "ends_at": assignment.ends_at,
        "comment": assignment.comment,
        "vehicle": {
            "id": assignment.vehicle.id,
            "vehicle_type": assignment.vehicle.vehicle_type,
            "plate_number": assignment.vehicle.plate_number,
            "brand": assignment.vehicle.brand,
            "model": assignment.vehicle.model,
        },
    }


def serialize_user(user: User) -> UserDetailRead:
    assignments = sorted(
        user.assigned_vehicles,
        key=lambda item: ((item.ends_at is not None), item.starts_at, item.id),
        reverse=False,
    )
    return UserDetailRead(
        id=user.id,
        full_name=user.full_name,
        login=user.login,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        assignments=[serialize_assignment(item) for item in assignments],
    )


def ensure_unique_user_fields(
    db: Session,
    *,
    login: str | None,
    email: str | None,
    exclude_user_id: int | None = None,
) -> None:
    if login:
        stmt = select(User).where(User.login == login)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if db.scalar(stmt) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Пользователь с таким логином уже существует")

    if email:
        stmt = select(User).where(User.email == email)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if db.scalar(stmt) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Пользователь с такой почтой уже существует")


def ensure_self_admin_protection(target_user: User, current_admin: User, *, role: UserRole | None, is_active: bool | None) -> None:
    if target_user.id != current_admin.id:
        return
    if role is not None and role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя снять роль администратора у своей учётной записи")
    if is_active is not None and not is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя отключить свою учётную запись")


def log_user_event(
    db: Session,
    *,
    current_admin: User,
    target_user: User,
    action_type: str,
    old_value: dict | None,
    new_value: dict | None,
) -> None:
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="user",
            entity_id=str(target_user.id),
            action_type=action_type,
            old_value=old_value,
            new_value=new_value,
        )
    )


def validate_assignment_dates(starts_at: date, ends_at: date | None) -> None:
    if ends_at is not None and ends_at < starts_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Дата окончания не может быть раньше даты начала")


def assignment_ranges_overlap(
    starts_at: date,
    ends_at: date | None,
    other_starts_at: date,
    other_ends_at: date | None,
) -> bool:
    effective_end = ends_at or date.max
    other_effective_end = other_ends_at or date.max
    return starts_at <= other_effective_end and other_starts_at <= effective_end


def ensure_assignment_not_overlapping(
    user: User,
    *,
    vehicle_id: int,
    starts_at: date,
    ends_at: date | None,
    exclude_assignment_id: int | None = None,
) -> None:
    for assignment in user.assigned_vehicles:
        if assignment.vehicle_id != vehicle_id:
            continue
        if exclude_assignment_id is not None and assignment.id == exclude_assignment_id:
            continue
        if assignment_ranges_overlap(starts_at, ends_at, assignment.starts_at, assignment.ends_at):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Для этой техники уже есть пересекающееся назначение этому сотруднику",
            )


@router.get("", response_model=UserListResponse)
def list_users(
    include_inactive: bool = Query(default=True),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserListResponse:
    _ = current_admin
    stmt = build_user_query().order_by(User.role.asc(), User.full_name.asc(), User.id.asc())
    count_stmt = select(func.count(User.id))

    if not include_inactive:
        stmt = stmt.where(User.is_active.is_(True))
        count_stmt = count_stmt.where(User.is_active.is_(True))

    if search:
        pattern = f"%{search.strip()}%"
        search_clause = or_(
            User.full_name.ilike(pattern),
            User.login.ilike(pattern),
            User.email.ilike(pattern),
        )
        stmt = stmt.where(search_clause)
        count_stmt = count_stmt.where(search_clause)

    items = db.execute(stmt).unique().scalars().all()
    total = db.scalar(count_stmt) or 0
    return UserListResponse(items=[serialize_user(item) for item in items], total=total)


@router.post("", response_model=UserRead)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserRead:
    normalized_full_name = normalize_text(payload.full_name)
    normalized_login = normalize_text(payload.login)
    normalized_email = normalize_text(str(payload.email))
    normalized_password = validate_password(payload.password)
    if not normalized_full_name or not normalized_login or not normalized_email or not normalized_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Имя, логин, почта и пароль обязательны")

    ensure_unique_user_fields(db, login=normalized_login, email=normalized_email)

    user = User(
        full_name=normalized_full_name,
        login=normalized_login,
        email=normalized_email,
        role=payload.role,
        is_active=payload.is_active,
        password_hash=get_password_hash(normalized_password),
    )
    db.add(user)
    db.flush()

    log_user_event(
        db,
        current_admin=current_admin,
        target_user=user,
        action_type="user_created",
        old_value=None,
        new_value={
            "full_name": user.full_name,
            "login": user.login,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
        },
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserRead:
    user = load_user_or_404(db, user_id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return UserRead.model_validate(user)

    normalized_login = normalize_text(update_data.get("login"))
    normalized_email = normalize_text(str(update_data["email"])) if "email" in update_data and update_data["email"] else None
    ensure_self_admin_protection(
        user,
        current_admin,
        role=update_data.get("role"),
        is_active=update_data.get("is_active"),
    )
    ensure_unique_user_fields(db, login=normalized_login, email=normalized_email, exclude_user_id=user.id)

    old_value = {
        "full_name": user.full_name,
        "login": user.login,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
    }

    if "full_name" in update_data:
        normalized_full_name = normalize_text(update_data.get("full_name"))
        if not normalized_full_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Имя пользователя обязательно")
        user.full_name = normalized_full_name
    if "login" in update_data:
        if not normalized_login:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Логин пользователя обязателен")
        user.login = normalized_login
    if "email" in update_data:
        if not normalized_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Почта пользователя обязательна")
        user.email = normalized_email
    if "role" in update_data and update_data["role"] is not None:
        user.role = update_data["role"]
    if "is_active" in update_data and update_data["is_active"] is not None:
        user.is_active = bool(update_data["is_active"])
    if "password" in update_data:
        normalized_password = validate_password(update_data.get("password"))
        if normalized_password:
            user.password_hash = get_password_hash(normalized_password)

    db.add(user)
    log_user_event(
        db,
        current_admin=current_admin,
        target_user=user,
        action_type="user_updated",
        old_value=old_value,
        new_value={
            "full_name": user.full_name,
            "login": user.login,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
            "password_updated": "password" in update_data and bool(normalize_text(update_data.get("password"))),
        },
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.post("/{user_id}/reset-password", response_model=UserRead)
def reset_user_password(
    user_id: int,
    payload: UserResetPasswordRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserRead:
    user = load_user_or_404(db, user_id)
    normalized_password = validate_password(payload.new_password)
    if normalized_password is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль обязателен")

    user.password_hash = get_password_hash(normalized_password)
    db.add(user)
    log_user_event(
        db,
        current_admin=current_admin,
        target_user=user,
        action_type="user_password_reset",
        old_value=None,
        new_value={"password_reset": True},
    )
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.post("/{user_id}/vehicle-assignments", response_model=UserDetailRead)
def create_vehicle_assignment(
    user_id: int,
    payload: UserAssignmentCreateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserDetailRead:
    user = load_user_or_404(db, user_id)
    vehicle = db.scalar(select(Vehicle).where(Vehicle.id == payload.vehicle_id))
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Техника не найдена")

    starts_at = payload.starts_at or date.today()
    ends_at = payload.ends_at
    validate_assignment_dates(starts_at, ends_at)
    ensure_assignment_not_overlapping(user, vehicle_id=vehicle.id, starts_at=starts_at, ends_at=ends_at)

    assignment = VehicleAssignmentHistory(
        vehicle_id=vehicle.id,
        user_id=user.id,
        starts_at=starts_at,
        ends_at=ends_at,
        comment=normalize_text(payload.comment),
        assigned_by_user_id=current_admin.id,
    )
    db.add(assignment)
    db.flush()
    log_user_event(
        db,
        current_admin=current_admin,
        target_user=user,
        action_type="user_assignment_created",
        old_value=None,
        new_value={
            "assignment_id": assignment.id,
            "vehicle_id": vehicle.id,
            "plate_number": vehicle.plate_number,
            "starts_at": assignment.starts_at.isoformat(),
            "ends_at": assignment.ends_at.isoformat() if assignment.ends_at else None,
            "comment": assignment.comment,
        },
    )
    db.commit()
    refreshed_user = load_user_or_404(db, user.id)
    return serialize_user(refreshed_user)


@router.patch("/{user_id}/vehicle-assignments/{assignment_id}", response_model=UserDetailRead)
def update_vehicle_assignment(
    user_id: int,
    assignment_id: int,
    payload: UserAssignmentUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserDetailRead:
    user = load_user_or_404(db, user_id)
    assignment = next((item for item in user.assigned_vehicles if item.id == assignment_id), None)
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Назначение техники не найдено")

    starts_at = payload.starts_at or assignment.starts_at
    ends_at = payload.ends_at if "ends_at" in payload.model_dump(exclude_unset=True) else assignment.ends_at
    validate_assignment_dates(starts_at, ends_at)
    ensure_assignment_not_overlapping(
        user,
        vehicle_id=assignment.vehicle_id,
        starts_at=starts_at,
        ends_at=ends_at,
        exclude_assignment_id=assignment.id,
    )

    old_value = {
        "assignment_id": assignment.id,
        "vehicle_id": assignment.vehicle_id,
        "starts_at": assignment.starts_at.isoformat(),
        "ends_at": assignment.ends_at.isoformat() if assignment.ends_at else None,
        "comment": assignment.comment,
    }

    assignment.starts_at = starts_at
    assignment.ends_at = ends_at
    if "comment" in payload.model_dump(exclude_unset=True):
        assignment.comment = normalize_text(payload.comment)

    db.add(assignment)
    log_user_event(
        db,
        current_admin=current_admin,
        target_user=user,
        action_type="user_assignment_updated",
        old_value=old_value,
        new_value={
            "assignment_id": assignment.id,
            "vehicle_id": assignment.vehicle_id,
            "starts_at": assignment.starts_at.isoformat(),
            "ends_at": assignment.ends_at.isoformat() if assignment.ends_at else None,
            "comment": assignment.comment,
        },
    )
    db.commit()
    refreshed_user = load_user_or_404(db, user.id)
    return serialize_user(refreshed_user)
