from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import ImportStatus


class HistoricalRepairImportResponse(BaseModel):
    message: str
    job_id: int
    status: ImportStatus
    source_filename: str
    rows_total: int
    grouped_repairs: int
    created_repairs: int
    duplicate_repairs: int
    conflicts_created: int
    created_services: int
    created_works: int
    created_parts: int
    repair_limit_applied: Optional[int]
    first_repair_id: Optional[int]
    recent_repair_ids: list[int]
    sample_conflicts: list[str]


class HistoricalWorkReferenceServiceRead(BaseModel):
    service_id: Optional[int]
    service_name: str
    samples: int


class HistoricalWorkReferenceRead(BaseModel):
    key: str
    work_code: Optional[str]
    work_name: str
    normalized_name: str
    sample_repairs: int
    sample_lines: int
    historical_sample_repairs: int
    historical_sample_lines: int
    operational_sample_repairs: int
    operational_sample_lines: int
    services_count: int
    vehicle_types: list[str]
    median_line_total: float
    min_line_total: float
    max_line_total: float
    median_price: float
    median_quantity: float
    median_mileage: Optional[int]
    min_mileage: Optional[int]
    max_mileage: Optional[int]
    median_standard_hours: Optional[float]
    median_actual_hours: Optional[float]
    recent_repair_date: Optional[datetime]
    recent_operational_repair_date: Optional[datetime]
    top_services: list[HistoricalWorkReferenceServiceRead]


class HistoricalWorkReferenceListResponse(BaseModel):
    items: list[HistoricalWorkReferenceRead]
    total: int
    limit: int
    q: Optional[str]
    min_samples: int


class ImportJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    import_type: str
    source_filename: str
    status: ImportStatus
    summary: Optional[dict]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime


class ImportJobListResponse(BaseModel):
    items: list[ImportJobRead]


class ImportConflictRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    import_job_id: int
    entity_type: str
    conflict_key: str
    incoming_payload: Optional[dict]
    existing_payload: Optional[dict]
    resolution_payload: Optional[dict]
    status: str
    source_filename: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ImportConflictListResponse(BaseModel):
    items: list[ImportConflictRead]


class ImportConflictResolveRequest(BaseModel):
    status: str
    comment: Optional[str] = None


class ImportConflictResolveResponse(BaseModel):
    message: str
    conflict: ImportConflictRead
