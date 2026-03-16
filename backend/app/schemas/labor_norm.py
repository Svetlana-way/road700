from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import CatalogStatus


class LaborNormRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    category: Optional[str]
    name_ru: str
    name_ru_alt: Optional[str]
    name_cn: Optional[str]
    name_en: Optional[str]
    normalized_name: str
    standard_hours: float
    source_sheet: Optional[str]
    source_file: Optional[str]
    status: CatalogStatus
    created_at: datetime
    updated_at: datetime


class LaborNormListResponse(BaseModel):
    items: list[LaborNormRead]
    total: int
    limit: int
    offset: int
    categories: list[str]
    source_files: list[str]


class LaborNormImportResponse(BaseModel):
    message: str
    filename: str
    imported_at: datetime
    created: int
    updated: int
    skipped: int
