from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.audit import AuditLog
from app.models.enums import UserRole
from app.models.repair import Repair, RepairPart, RepairWork
from app.models.user import User
from app.schemas.repair import RepairDetailResponse, RepairUpdateRequest
from app.services.document_processing import replace_ocr_checks, resolve_service


router = APIRouter(prefix="/repairs", tags=["repairs"])


def build_repair_snapshot(repair: Repair) -> dict:
    return {
        "order_number": repair.order_number,
        "repair_date": repair.repair_date.isoformat(),
        "mileage": repair.mileage,
        "reason": repair.reason,
        "employee_comment": repair.employee_comment,
        "service_name": repair.service.name if repair.service is not None else None,
        "work_total": float(repair.work_total),
        "parts_total": float(repair.parts_total),
        "vat_total": float(repair.vat_total),
        "grand_total": float(repair.grand_total),
        "status": repair.status.value,
        "is_preliminary": repair.is_preliminary,
        "works": [
            {
                "work_code": item.work_code,
                "work_name": item.work_name,
                "quantity": item.quantity,
                "standard_hours": item.standard_hours,
                "actual_hours": item.actual_hours,
                "price": float(item.price),
                "line_total": float(item.line_total),
                "status": item.status.value,
            }
            for item in sorted(repair.works, key=lambda item: item.id)
        ],
        "parts": [
            {
                "article": item.article,
                "part_name": item.part_name,
                "quantity": item.quantity,
                "unit_name": item.unit_name,
                "price": float(item.price),
                "line_total": float(item.line_total),
                "status": item.status.value,
            }
            for item in sorted(repair.parts, key=lambda item: item.id)
        ],
    }


def fetch_repair_history(db: Session, repair_id: int) -> list[AuditLog]:
    stmt = (
        select(AuditLog)
        .options(joinedload(AuditLog.user))
        .where(
            AuditLog.entity_type == "repair",
            AuditLog.entity_id == str(repair_id),
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    )
    return db.execute(stmt).scalars().all()


def serialize_repair(repair: Repair, history_entries: list[AuditLog]) -> RepairDetailResponse:
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
        history=[
            {
                "id": entry.id,
                "action_type": entry.action_type,
                "created_at": entry.created_at,
                "user_name": entry.user.full_name if entry.user is not None else None,
                "old_value": entry.old_value,
                "new_value": entry.new_value,
            }
            for entry in history_entries
        ],
    )


def replace_manual_lines(
    db: Session,
    repair: Repair,
    works_payload,
    parts_payload,
) -> None:
    if works_payload is not None:
        db.execute(delete(RepairWork).where(RepairWork.repair_id == repair.id))
        for item in works_payload:
            db.add(
                RepairWork(
                    repair_id=repair.id,
                    work_code=item.work_code,
                    work_name=item.work_name,
                    quantity=item.quantity,
                    standard_hours=item.standard_hours,
                    actual_hours=item.actual_hours,
                    price=item.price,
                    line_total=item.line_total,
                    status=item.status,
                    reference_payload=item.reference_payload,
                )
            )

    if parts_payload is not None:
        db.execute(delete(RepairPart).where(RepairPart.repair_id == repair.id))
        for item in parts_payload:
            db.add(
                RepairPart(
                    repair_id=repair.id,
                    article=item.article,
                    part_name=item.part_name,
                    quantity=item.quantity,
                    unit_name=item.unit_name,
                    price=item.price,
                    line_total=item.line_total,
                    status=item.status,
                )
            )


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

    history_entries = fetch_repair_history(db, repair.id)
    return serialize_repair(repair, history_entries)


@router.patch("/{repair_id}", response_model=RepairDetailResponse)
def update_repair(
    repair_id: int,
    payload: RepairUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
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
    repair = db.execute(stmt).unique().scalar_one_or_none()
    if repair is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair not found")
    old_snapshot = build_repair_snapshot(repair)

    update_data = payload.model_dump(exclude_unset=True)
    for field_name in (
        "order_number",
        "repair_date",
        "mileage",
        "reason",
        "employee_comment",
        "work_total",
        "parts_total",
        "vat_total",
        "grand_total",
        "status",
        "is_preliminary",
    ):
        if field_name in update_data:
            setattr(repair, field_name, update_data[field_name])

    if "service_name" in update_data:
        service_name = update_data["service_name"]
        if service_name:
            service = resolve_service(db, service_name)
            repair.service_id = service.id
        else:
            repair.service_id = None

    replace_manual_lines(db, repair, payload.works, payload.parts)
    replace_ocr_checks(db, repair.id, [])

    repair.is_manually_completed = True
    repair.is_partially_recognized = False

    db.commit()

    refreshed = db.execute(stmt).unique().scalar_one_or_none()
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Repair could not be reloaded")
    new_snapshot = build_repair_snapshot(refreshed)
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="repair",
            entity_id=str(refreshed.id),
            action_type="manual_update",
            old_value=old_snapshot,
            new_value=new_snapshot,
        )
    )
    db.commit()
    history_entries = fetch_repair_history(db, refreshed.id)
    return serialize_repair(refreshed, history_entries)
