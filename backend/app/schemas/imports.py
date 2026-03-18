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
