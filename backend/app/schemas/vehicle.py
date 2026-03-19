from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import RepairStatus, UserRole, VehicleStatus, VehicleType


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: Optional[str]
    vehicle_type: VehicleType
    vin: Optional[str]
    plate_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    year: Optional[int]
    column_name: Optional[str]
    mechanic_name: Optional[str]
    current_driver_name: Optional[str]
    last_coordinates_at: Optional[datetime]
    comment: Optional[str]
    status: VehicleStatus
    archived_at: Optional[datetime]
    historical_repairs_total: int = 0
    historical_last_repair_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class VehicleListResponse(BaseModel):
    items: list[VehicleRead]
    total: int
    limit: int
    offset: int


class VehicleLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    left_vehicle_id: int
    right_vehicle_id: int
    starts_at: date
    ends_at: Optional[date]
    comment: Optional[str]


class VehicleAssignmentUserRead(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole


class VehicleAssignmentRead(BaseModel):
    id: int
    user_id: int
    starts_at: date
    ends_at: Optional[date]
    comment: Optional[str]
    user: VehicleAssignmentUserRead


class VehicleRepairHistoryRead(BaseModel):
    repair_id: int
    order_number: Optional[str]
    repair_date: date
    mileage: int
    status: RepairStatus
    service_name: Optional[str]
    grand_total: float
    documents_total: int
    created_at: datetime
    updated_at: datetime


class VehicleHistorySummaryRead(BaseModel):
    repairs_total: int
    documents_total: int
    confirmed_repairs: int
    suspicious_repairs: int
    last_repair_date: Optional[date]
    last_mileage: Optional[int]


class VehicleHistoricalRepairHistoryRead(BaseModel):
    repair_id: int
    order_number: Optional[str]
    repair_date: date
    mileage: int
    service_name: Optional[str]
    grand_total: float
    employee_comment: Optional[str]
    created_at: datetime
    updated_at: datetime


class VehicleHistoricalSummaryRead(BaseModel):
    repairs_total: int
    services_total: int
    total_spend: float
    first_repair_date: Optional[date]
    last_repair_date: Optional[date]
    last_mileage: Optional[int]


class VehicleDetailResponse(VehicleRead):
    active_links: list[VehicleLinkRead]
    active_assignments: list[VehicleAssignmentRead]
    repair_history: list[VehicleRepairHistoryRead]
    history_summary: VehicleHistorySummaryRead
    historical_repair_history: list[VehicleHistoricalRepairHistoryRead]
    historical_history_summary: VehicleHistoricalSummaryRead


class VehicleImportRequest(BaseModel):
    trucks_path: Optional[str] = None
    trailers_path: Optional[str] = None


class VehicleUpdateRequest(BaseModel):
    status: Optional[VehicleStatus] = None
    comment: Optional[str] = None


class VehicleImportResponse(BaseModel):
    created: int
    updated: int
    links_created: int
    links_closed: int
    trucks_path: str
    trailers_path: str
