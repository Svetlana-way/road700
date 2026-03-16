from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.enums import UserRole, VehicleType
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory, VehicleLinkHistory
from app.schemas.vehicle import (
    VehicleDetailResponse,
    VehicleImportRequest,
    VehicleImportResponse,
    VehicleListResponse,
    VehicleRead,
)
from app.scripts.import_vehicles import (
    DEFAULT_TRAILERS_PATH,
    DEFAULT_TRUCKS_PATH,
    import_vehicles_with_session,
)


router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def apply_vehicle_scope(stmt, current_user: User):
    if current_user.role == UserRole.ADMIN:
        return stmt

    today = date.today()
    assigned_vehicle_ids = (
        select(VehicleAssignmentHistory.vehicle_id)
        .where(
            VehicleAssignmentHistory.user_id == current_user.id,
            VehicleAssignmentHistory.starts_at <= today,
            or_(
                VehicleAssignmentHistory.ends_at.is_(None),
                VehicleAssignmentHistory.ends_at >= today,
            ),
        )
        .distinct()
    )
    return stmt.where(Vehicle.id.in_(assigned_vehicle_ids))


@router.get("", response_model=VehicleListResponse)
def list_vehicles(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    vehicle_type: Optional[VehicleType] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> VehicleListResponse:
    base_stmt = select(Vehicle)
    count_stmt = select(func.count(func.distinct(Vehicle.id)))

    if vehicle_type is not None:
        base_stmt = base_stmt.where(Vehicle.vehicle_type == vehicle_type)
        count_stmt = count_stmt.where(Vehicle.vehicle_type == vehicle_type)

    if search:
        pattern = f"%{search.strip()}%"
        search_clause = or_(
            Vehicle.vin.ilike(pattern),
            Vehicle.plate_number.ilike(pattern),
            Vehicle.brand.ilike(pattern),
            Vehicle.model.ilike(pattern),
            Vehicle.external_id.ilike(pattern),
        )
        base_stmt = base_stmt.where(search_clause)
        count_stmt = count_stmt.where(search_clause)

    base_stmt = apply_vehicle_scope(base_stmt, current_user).order_by(Vehicle.created_at.desc())
    count_stmt = apply_vehicle_scope(count_stmt, current_user)

    items = db.scalars(base_stmt.offset(offset).limit(limit)).unique().all()
    total = db.scalar(count_stmt) or 0

    return VehicleListResponse(
        items=[VehicleRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{vehicle_id}", response_model=VehicleDetailResponse)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> VehicleDetailResponse:
    stmt = apply_vehicle_scope(select(Vehicle).where(Vehicle.id == vehicle_id), current_user)
    vehicle = db.scalar(stmt)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")

    today = date.today()
    links = db.scalars(
        select(VehicleLinkHistory)
        .where(
            or_(
                VehicleLinkHistory.left_vehicle_id == vehicle.id,
                VehicleLinkHistory.right_vehicle_id == vehicle.id,
            ),
            VehicleLinkHistory.starts_at <= today,
            or_(
                VehicleLinkHistory.ends_at.is_(None),
                VehicleLinkHistory.ends_at >= today,
            ),
        )
        .order_by(VehicleLinkHistory.starts_at.desc(), VehicleLinkHistory.id.desc())
    ).all()

    payload = VehicleRead.model_validate(vehicle).model_dump()
    payload["active_links"] = links
    return VehicleDetailResponse.model_validate(payload)


@router.post("/import", response_model=VehicleImportResponse)
def import_vehicle_registry(
    payload: VehicleImportRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> VehicleImportResponse:
    trucks_path = Path(payload.trucks_path) if payload.trucks_path else DEFAULT_TRUCKS_PATH
    trailers_path = Path(payload.trailers_path) if payload.trailers_path else DEFAULT_TRAILERS_PATH

    if not trucks_path.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Trucks file not found: {trucks_path}")
    if not trailers_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Trailers file not found: {trailers_path}",
        )

    stats = import_vehicles_with_session(db, trucks_path=trucks_path, trailers_path=trailers_path)
    return VehicleImportResponse(
        **stats.as_dict(),
        trucks_path=str(trucks_path),
        trailers_path=str(trailers_path),
    )
