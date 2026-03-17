from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OcrLearningSignalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    repair_id: int
    document_id: Optional[int]
    document_version_id: Optional[int]
    created_by_user_id: Optional[int]
    signal_type: str
    target_field: str
    ocr_profile_scope: Optional[str]
    extracted_value: Optional[str]
    corrected_value: str
    service_name: Optional[str]
    source_type: Optional[str]
    document_filename: Optional[str]
    text_excerpt: Optional[str]
    suggestion_summary: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class OcrLearningSummaryRead(BaseModel):
    target_field: str
    ocr_profile_scope: Optional[str]
    signal_type: str
    count: int
    suggestion_summary: str
    example_services: list[str]
    example_filenames: list[str]


class OcrLearningSignalListResponse(BaseModel):
    items: list[OcrLearningSignalRead]
    summaries: list[OcrLearningSummaryRead]
    total: int
    statuses: list[str]
    target_fields: list[str]
    profile_scopes: list[str]


class OcrLearningSignalUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
