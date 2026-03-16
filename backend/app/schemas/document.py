from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, VehicleType


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
    kind: DocumentKind
    mime_type: Optional[str]
    status: DocumentStatus
    is_primary: bool
    ocr_confidence: Optional[float]
    review_queue_priority: int
    notes: Optional[str]
    created_at: datetime
    parsed_payload: Optional[dict]
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


class DocumentProcessResponse(BaseModel):
    document: DocumentRead
    job_id: int
    import_status: str
    message: str


class DocumentBatchProcessResponse(BaseModel):
    processed_count: int
    document_ids: list[int]
    message: str


class DocumentComparisonFieldRead(BaseModel):
    field_name: str
    label: str
    left_value: Optional[str]
    right_value: Optional[str]
    is_different: bool


class DocumentComparisonResponse(BaseModel):
    left_document: DocumentRead
    right_document: DocumentRead
    compared_fields: list[DocumentComparisonFieldRead]
    works_count_left: int
    works_count_right: int
    parts_count_left: int
    parts_count_right: int


class DocumentComparisonReviewRequest(BaseModel):
    with_document_id: int
    action: str
    comment: Optional[str] = None


class DocumentComparisonReviewResponse(BaseModel):
    message: str
    action: str
    document_id: int
    repair_id: int
    source_document_id: Optional[int]
