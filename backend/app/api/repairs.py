from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.enums import UserRole
from app.models.repair import Repair
from app.models.user import User
from app.schemas.repair import RepairDetailResponse


router = APIRouter(prefix="/repairs", tags=["repairs"])


@router.get("/{repair_id}", response_model=RepairDetailResponse)
def get_repair(
    repair_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RepairDetailResponse:
    stmt = (
        select(Repair)
        .options(
            joinedload(Repair.vehicle),
            joinedload(Repair.service),
            joinedload(Repair.works),
            joinedload(Repair.parts),
            joinedload(Repair.checks),
        )
        .where(Repair.id == repair_id)
    )

    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Repair.vehicle_id.in_(get_allowed_vehicle_ids_query(current_user)))

    repair = db.execute(stmt).unique().scalar_one_or_none()
    if repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair not found")

    return RepairDetailResponse(
        id=repair.id,
        order_number=repair.order_number,
        repair_date=repair.repair_date,
        mileage=repair.mileage,
        reason=repair.reason,
        employee_comment=repair.employee_comment,
        work_total=float(repair.work_total),
        parts_total=float(repair.parts_total),
        vat_total=float(repair.vat_total),
        grand_total=float(repair.grand_total),
        status=repair.status,
        is_preliminary=repair.is_preliminary,
        is_partially_recognized=repair.is_partially_recognized,
        is_manually_completed=repair.is_manually_completed,
        created_at=repair.created_at,
        updated_at=repair.updated_at,
        vehicle={
            "id": repair.vehicle.id,
            "plate_number": repair.vehicle.plate_number,
            "brand": repair.vehicle.brand,
            "model": repair.vehicle.model,
        },
        service=(
            {
                "id": repair.service.id,
                "name": repair.service.name,
                "city": repair.service.city,
            }
            if repair.service is not None
            else None
        ),
        works=sorted(repair.works, key=lambda item: item.id),
        parts=sorted(repair.parts, key=lambda item: item.id),
        checks=sorted(repair.checks, key=lambda item: item.id),
    )
