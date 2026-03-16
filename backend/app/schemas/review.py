from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import DocumentStatus, RepairStatus, VehicleType


class ReviewQueueVehicleRead(BaseModel):
    id: int
    vehicle_type: VehicleType
    plate_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]


class ReviewQueueDocumentRead(BaseModel):
    id: int
    original_filename: str
    source_type: str
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime
    ocr_confidence: Optional[float]
    review_queue_priority: int


class ReviewQueueRepairRead(BaseModel):
    id: int
    order_number: Optional[str]
    repair_date: date
    mileage: int
    status: RepairStatus
    is_partially_recognized: bool
    unresolved_checks_total: int
    suspicious_checks_total: int


class ReviewQueueItemRead(BaseModel):
    priority_score: int
    priority_bucket: str
    issue_count: int
    issue_titles: list[str]
    manual_review_reasons: list[str]
    extracted_order_number: Optional[str]
    extracted_grand_total: Optional[float]
    document: ReviewQueueDocumentRead
    repair: ReviewQueueRepairRead
    vehicle: ReviewQueueVehicleRead


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItemRead]
    total: int
    limit: int
    offset: int
