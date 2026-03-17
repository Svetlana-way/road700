from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import ServiceStatus


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: Optional[str]
    contact: Optional[str]
    comment: Optional[str]
    status: ServiceStatus
    created_by_user_id: Optional[int]
    confirmed_by_user_id: Optional[int]
    created_at: datetime
    updated_at: datetime


class ServiceListResponse(BaseModel):
    items: list[ServiceRead]
    total: int
    limit: int
    offset: int
    cities: list[str]


class ServiceCreate(BaseModel):
    name: str
    city: Optional[str] = None
    contact: Optional[str] = None
    comment: Optional[str] = None
    status: ServiceStatus = ServiceStatus.CONFIRMED


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    contact: Optional[str] = None
    comment: Optional[str] = None
    status: Optional[ServiceStatus] = None
