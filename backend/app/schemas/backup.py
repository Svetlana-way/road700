from datetime import datetime

from pydantic import BaseModel


class BackupItemRead(BaseModel):
    backup_id: str
    filename: str
    created_at: datetime
    backup_type: str
    source: str
    status: str
    size_bytes: int
    storage_files_total: int
    tables_total: int


class BackupListResponse(BaseModel):
    items: list[BackupItemRead]
    total: int


class BackupCreateResponse(BaseModel):
    message: str
    backup: BackupItemRead


class BackupRestoreRequest(BaseModel):
    confirm_backup_id: str


class BackupRestoreResponse(BaseModel):
    message: str
    backup: BackupItemRead
