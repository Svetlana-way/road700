from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogItemRead(BaseModel):
    id: int
    created_at: datetime
    user_id: Optional[int]
    user_name: Optional[str]
    entity_type: str
    entity_id: str
    action_type: str
    old_value: Optional[dict]
    new_value: Optional[dict]


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItemRead]
    total: int
    limit: int
    offset: int
    action_types: list[str]
    entity_types: list[str]
