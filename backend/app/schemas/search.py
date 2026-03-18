from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import DocumentStatus, RepairStatus, VehicleStatus, VehicleType


class GlobalSearchDocumentItem(BaseModel):
    document_id: int
    repair_id: Optional[int]
    vehicle_id: Optional[int]
    original_filename: str
    document_status: DocumentStatus
    ocr_confidence: Optional[float]
    order_number: Optional[str]
    repair_date: Optional[date]
    service_name: Optional[str]
    plate_number: Optional[str]
    vin: Optional[str]
    matched_by: list[str]
    created_at: datetime


class GlobalSearchRepairItem(BaseModel):
    repair_id: int
    vehicle_id: int
    order_number: Optional[str]
    repair_date: date
    repair_status: RepairStatus
    service_name: Optional[str]
    plate_number: Optional[str]
    vin: Optional[str]
    grand_total: float
    matched_by: list[str]
    created_at: datetime


class GlobalSearchVehicleItem(BaseModel):
    vehicle_id: int
    vehicle_type: VehicleType
    plate_number: Optional[str]
    vin: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    status: VehicleStatus
    archived_at: Optional[datetime]
    matched_by: list[str]
    updated_at: datetime


class GlobalSearchResponse(BaseModel):
    query: str
    documents_total: int
    repairs_total: int
    vehicles_total: int
    documents: list[GlobalSearchDocumentItem]
    repairs: list[GlobalSearchRepairItem]
    vehicles: list[GlobalSearchVehicleItem]
