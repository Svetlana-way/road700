from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OcrRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_scope: str
    target_field: str
    pattern: str
    value_parser: str
    confidence: float
    priority: int
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class OcrRuleListResponse(BaseModel):
    items: list[OcrRuleRead]
    profile_scopes: list[str]
    target_fields: list[str]


class OcrRuleCreate(BaseModel):
    profile_scope: str = "default"
    target_field: str
    pattern: str
    value_parser: str = "raw"
    confidence: float = 0.6
    priority: int = 100
    is_active: bool = True
    notes: Optional[str] = None


class OcrRuleUpdate(BaseModel):
    profile_scope: Optional[str] = None
    target_field: Optional[str] = None
    pattern: Optional[str] = None
    value_parser: Optional[str] = None
    confidence: Optional[float] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
