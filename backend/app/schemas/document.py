from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import DocumentStatus, RepairStatus, VehicleType


class DocumentVehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_type: VehicleType
    plate_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]


class DocumentRepairRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: Optional[str]
    repair_date: date
    mileage: int
    status: RepairStatus


class DocumentRead(BaseModel):
    id: int
    original_filename: str
    source_type: str
    mime_type: Optional[str]
    status: DocumentStatus
    is_primary: bool
    ocr_confidence: Optional[float]
    review_queue_priority: int
    notes: Optional[str]
    created_at: datetime
    repair: DocumentRepairRead
    vehicle: DocumentVehicleRead


class DocumentListResponse(BaseModel):
    items: list[DocumentRead]
    total: int
    limit: int
    offset: int


class DocumentUploadResponse(BaseModel):
    document: DocumentRead
    message: str
