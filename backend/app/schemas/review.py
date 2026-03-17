from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, VehicleType


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
    kind: DocumentKind
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
    category: str
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
    counts: dict[str, int]
    total: int
    limit: int
    offset: int


class ReviewActionRequest(BaseModel):
    action: str
    comment: Optional[str] = None


class ReviewActionResponse(BaseModel):
    message: str
    document_id: int
    repair_id: int
    document_status: DocumentStatus
    repair_status: RepairStatus
    queue_item: Optional[ReviewQueueItemRead] = None


class ReviewRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_type: str
    code: str
    title: str
    weight: int
    bucket_override: Optional[str]
    is_active: bool
    sort_order: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class ReviewRuleListResponse(BaseModel):
    items: list[ReviewRuleRead]
    rule_types: list[str]


class ReviewRuleCreate(BaseModel):
    rule_type: str
    code: str
    title: str
    weight: int = 0
    bucket_override: Optional[str] = None
    is_active: bool = True
    sort_order: int = 100
    notes: Optional[str] = None


class ReviewRuleUpdate(BaseModel):
    title: Optional[str] = None
    weight: Optional[int] = None
    bucket_override: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    notes: Optional[str] = None
