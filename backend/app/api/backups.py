from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.backup import (
    BackupCreateResponse,
    BackupItemRead,
    BackupListResponse,
    BackupRestoreRequest,
    BackupRestoreResponse,
)
from app.services.backups import (
    archive_path_for,
    create_backup_archive,
    list_backup_items,
    load_backup_item_or_raise,
    restore_backup_archive,
)


router = APIRouter(prefix="/backups", tags=["backups"])


@router.get("", response_model=BackupListResponse)
def list_backups(
    current_admin: User = Depends(get_current_admin),
) -> BackupListResponse:
    _ = current_admin
    items = list_backup_items()
    return BackupListResponse(items=[BackupItemRead.model_validate(item) for item in items], total=len(items))


@router.post("", response_model=BackupCreateResponse)
def create_backup(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> BackupCreateResponse:
    backup = create_backup_archive(db, source="manual")
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="system",
            entity_id="backups",
            action_type="backup_created",
            old_value=None,
            new_value=backup,
        )
    )
    db.commit()
    return BackupCreateResponse(
        message="Резервная копия создана",
        backup=BackupItemRead.model_validate(backup),
    )


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: str,
    current_admin: User = Depends(get_current_admin),
) -> FileResponse:
    _ = current_admin
    try:
        backup = load_backup_item_or_raise(backup_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found") from error

    archive_path = archive_path_for(backup_id)
    if not archive_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup file not found")
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=backup["filename"],
    )


@router.post("/{backup_id}/restore", response_model=BackupRestoreResponse)
def restore_backup(
    backup_id: str,
    payload: BackupRestoreRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> BackupRestoreResponse:
    if payload.confirm_backup_id.strip() != backup_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для восстановления введите точный код резервной копии",
        )

    db.close()
    try:
        backup = restore_backup_archive(
            backup_id,
            requested_by_login=current_admin.login,
            requested_by_user_id=current_admin.id,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found") from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    return BackupRestoreResponse(
        message="Резервная копия восстановлена",
        backup=BackupItemRead.model_validate(backup),
    )
