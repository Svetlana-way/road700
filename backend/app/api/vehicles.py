from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import apply_vehicle_scope
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.document import Document
from app.models.enums import RepairStatus
from app.models.repair import Repair
from app.models.enums import VehicleType
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

    active_assignments = db.scalars(
        select(VehicleAssignmentHistory)
        .options(joinedload(VehicleAssignmentHistory.user))
        .where(
            VehicleAssignmentHistory.vehicle_id == vehicle.id,
            VehicleAssignmentHistory.starts_at <= today,
            or_(
                VehicleAssignmentHistory.ends_at.is_(None),
                VehicleAssignmentHistory.ends_at >= today,
            ),
        )
        .order_by(VehicleAssignmentHistory.starts_at.desc(), VehicleAssignmentHistory.id.desc())
    ).all()

    repair_history = db.scalars(
        select(Repair)
        .options(
            joinedload(Repair.service),
            joinedload(Repair.documents),
        )
        .where(Repair.vehicle_id == vehicle.id)
        .order_by(Repair.repair_date.desc(), Repair.id.desc())
    ).unique().all()

    documents_total = sum(len(repair.documents) for repair in repair_history)
    confirmed_repairs = sum(1 for repair in repair_history if repair.status == RepairStatus.CONFIRMED)
    suspicious_repairs = sum(1 for repair in repair_history if repair.status == RepairStatus.SUSPICIOUS)
    last_repair = repair_history[0] if repair_history else None

    payload = VehicleRead.model_validate(vehicle).model_dump()
    payload["active_links"] = links
    payload["active_assignments"] = [
        {
            "id": assignment.id,
            "user_id": assignment.user_id,
            "starts_at": assignment.starts_at,
            "ends_at": assignment.ends_at,
            "comment": assignment.comment,
            "user": {
                "id": assignment.user.id,
                "full_name": assignment.user.full_name,
                "email": assignment.user.email,
                "role": assignment.user.role,
            },
        }
        for assignment in active_assignments
    ]
    payload["repair_history"] = [
        {
            "repair_id": repair.id,
            "order_number": repair.order_number,
            "repair_date": repair.repair_date,
            "mileage": repair.mileage,
            "status": repair.status,
            "service_name": repair.service.name if repair.service is not None else None,
            "grand_total": float(repair.grand_total),
            "documents_total": len(repair.documents),
            "created_at": repair.created_at,
            "updated_at": repair.updated_at,
        }
        for repair in repair_history
    ]
    payload["history_summary"] = {
        "repairs_total": len(repair_history),
        "documents_total": documents_total,
        "confirmed_repairs": confirmed_repairs,
        "suspicious_repairs": suspicious_repairs,
        "last_repair_date": last_repair.repair_date if last_repair is not None else None,
        "last_mileage": last_repair.mileage if last_repair is not None else None,
    }
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
