from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import CatalogStatus, CheckSeverity, RepairStatus


class RepairWorkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_code: Optional[str]
    work_name: str
    quantity: float
    standard_hours: Optional[float]
    actual_hours: Optional[float]
    price: float
    line_total: float
    status: CatalogStatus
    reference_payload: Optional[dict]


class RepairPartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    article: Optional[str]
    part_name: str
    quantity: float
    unit_name: Optional[str]
    price: float
    line_total: float
    status: CatalogStatus


class RepairCheckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    check_type: str
    severity: CheckSeverity
    title: str
    details: Optional[str]
    calculation_payload: Optional[dict]
    is_resolved: bool
    created_at: datetime


class RepairVehicleRead(BaseModel):
    id: int
    plate_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]


class RepairServiceRead(BaseModel):
    id: int
    name: str
    city: Optional[str]


class RepairDetailResponse(BaseModel):
    id: int
    order_number: Optional[str]
    repair_date: date
    mileage: int
    reason: Optional[str]
    employee_comment: Optional[str]
    work_total: float
    parts_total: float
    vat_total: float
    grand_total: float
    status: RepairStatus
    is_preliminary: bool
    is_partially_recognized: bool
    is_manually_completed: bool
    created_at: datetime
    updated_at: datetime
    vehicle: RepairVehicleRead
    service: Optional[RepairServiceRead]
    works: list[RepairWorkRead]
    parts: list[RepairPartRead]
    checks: list[RepairCheckRead]
