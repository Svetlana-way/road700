from datetime import datetime
from typing import Literal

from pydantic import BaseModel

BackupIncludedSection = Literal["database", "storage_files"]
BackupExcludedSection = Literal["backup_archives"]
BackupRestoreEffect = Literal["replace_database", "replace_storage_files", "keep_backup_archives", "relogin_required"]


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
    included_sections: list[BackupIncludedSection]
    excluded_sections: list[BackupExcludedSection]
    restore_effects: list[BackupRestoreEffect]


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
    requires_reauthentication: bool
    post_restore_action: Literal["relogin"]
