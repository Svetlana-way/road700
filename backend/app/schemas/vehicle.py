from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import VehicleStatus, VehicleType


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


class VehicleDetailResponse(VehicleRead):
    active_links: list[VehicleLinkRead]


class VehicleImportRequest(BaseModel):
    trucks_path: Optional[str] = None
    trailers_path: Optional[str] = None


class VehicleImportResponse(BaseModel):
    created: int
    updated: int
    links_created: int
    links_closed: int
    trucks_path: str
    trailers_path: str
