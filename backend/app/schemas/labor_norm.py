from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CatalogStatus, VehicleType


class LaborNormCatalogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scope: str
    catalog_name: str
    brand_family: Optional[str]
    vehicle_type: Optional[VehicleType]
    year_from: Optional[int]
    year_to: Optional[int]
    brand_keywords: Optional[list[str]]
    model_keywords: Optional[list[str]]
    vin_prefixes: Optional[list[str]]
    priority: int
    auto_match_enabled: bool
    status: CatalogStatus
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class LaborNormCatalogListResponse(BaseModel):
    items: list[LaborNormCatalogRead]
    scopes: list[str]


class LaborNormCatalogCreate(BaseModel):
    scope: str
    catalog_name: str
    brand_family: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    brand_keywords: list[str] = Field(default_factory=list)
    model_keywords: list[str] = Field(default_factory=list)
    vin_prefixes: list[str] = Field(default_factory=list)
    priority: int = 100
    auto_match_enabled: bool = True
    status: CatalogStatus = CatalogStatus.CONFIRMED
    notes: Optional[str] = None


class LaborNormCatalogUpdate(BaseModel):
    catalog_name: Optional[str] = None
    brand_family: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    brand_keywords: Optional[list[str]] = None
    model_keywords: Optional[list[str]] = None
    vin_prefixes: Optional[list[str]] = None
    priority: Optional[int] = None
    auto_match_enabled: Optional[bool] = None
    status: Optional[CatalogStatus] = None
    notes: Optional[str] = None


class LaborNormRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scope: str
    brand_family: Optional[str]
    catalog_name: Optional[str]
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


class LaborNormCreate(BaseModel):
    scope: str
    code: str
    category: Optional[str] = None
    name_ru: str
    name_ru_alt: Optional[str] = None
    name_cn: Optional[str] = None
    name_en: Optional[str] = None
    standard_hours: float
    source_sheet: Optional[str] = None
    source_file: Optional[str] = None
    status: CatalogStatus = CatalogStatus.CONFIRMED


class LaborNormUpdate(BaseModel):
    scope: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    name_ru: Optional[str] = None
    name_ru_alt: Optional[str] = None
    name_cn: Optional[str] = None
    name_en: Optional[str] = None
    standard_hours: Optional[float] = None
    source_sheet: Optional[str] = None
    source_file: Optional[str] = None
    status: Optional[CatalogStatus] = None


class LaborNormListResponse(BaseModel):
    items: list[LaborNormRead]
    total: int
    limit: int
    offset: int
    scopes: list[str]
    categories: list[str]
    source_files: list[str]


class LaborNormImportResponse(BaseModel):
    message: str
    filename: str
    imported_at: datetime
    created: int
    updated: int
    skipped: int
