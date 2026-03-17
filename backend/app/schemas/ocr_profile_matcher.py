from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OcrProfileMatcherRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_scope: str
    title: str
    source_type: Optional[str]
    filename_pattern: Optional[str]
    text_pattern: Optional[str]
    service_name_pattern: Optional[str]
    priority: int
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class OcrProfileMatcherListResponse(BaseModel):
    items: list[OcrProfileMatcherRead]
    profile_scopes: list[str]


class OcrProfileMatcherCreate(BaseModel):
    profile_scope: str
    title: str
    source_type: Optional[str] = None
    filename_pattern: Optional[str] = None
    text_pattern: Optional[str] = None
    service_name_pattern: Optional[str] = None
    priority: int = 100
    is_active: bool = True
    notes: Optional[str] = None


class OcrProfileMatcherUpdate(BaseModel):
    profile_scope: Optional[str] = None
    title: Optional[str] = None
    source_type: Optional[str] = None
    filename_pattern: Optional[str] = None
    text_pattern: Optional[str] = None
    service_name_pattern: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
