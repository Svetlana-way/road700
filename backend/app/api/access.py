from datetime import date

from sqlalchemy import or_, select

from app.models.enums import UserRole
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory


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
