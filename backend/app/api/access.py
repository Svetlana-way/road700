from datetime import date

from sqlalchemy import and_, or_, select

from app.models.enums import UserRole
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory


PLACEHOLDER_EXTERNAL_ID = "__batch_import_placeholder__"


def get_allowed_vehicle_ids_query(current_user: User):
    today = date.today()
    return (
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


def apply_vehicle_scope(stmt, current_user: User):
    if current_user.role == UserRole.ADMIN:
        return stmt
    return stmt.where(Vehicle.id.in_(get_allowed_vehicle_ids_query(current_user)))


def get_repair_visibility_clause(current_user: User):
    if current_user.role == UserRole.ADMIN:
        return True
    return or_(
        Repair.vehicle_id.in_(get_allowed_vehicle_ids_query(current_user)),
        and_(
            Repair.created_by_user_id == current_user.id,
            Repair.vehicle.has(Vehicle.external_id == PLACEHOLDER_EXTERNAL_ID),
        ),
    )
