from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.models.audit import AuditLog
from app.models.imports import ImportConflict, ImportJob
from app.models.user import User
from app.schemas.imports import (
    HistoricalRepairImportResponse,
    ImportConflictListResponse,
    ImportConflictRead,
    ImportConflictResolveRequest,
    ImportConflictResolveResponse,
    ImportJobListResponse,
    ImportJobRead,
)
from app.services.historical_repairs_import import import_historical_repairs


router = APIRouter(prefix="/imports", tags=["imports"])
ALLOWED_CONFLICT_STATUSES = {"pending", "resolved", "ignored"}


def serialize_import_conflict(conflict: ImportConflict, *, source_filename: str | None = None) -> ImportConflictRead:
    return ImportConflictRead(
        id=conflict.id,
        import_job_id=conflict.import_job_id,
        entity_type=conflict.entity_type,
        conflict_key=conflict.conflict_key,
        incoming_payload=conflict.incoming_payload,
        existing_payload=conflict.existing_payload,
        resolution_payload=conflict.resolution_payload,
        status=conflict.status,
        source_filename=source_filename,
        created_at=conflict.created_at,
        updated_at=conflict.updated_at,
    )


def get_import_conflict_or_404(db: Session, conflict_id: int) -> ImportConflict:
    conflict = db.get(ImportConflict, conflict_id)
    if conflict is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Конфликт импорта не найден")
    return conflict


@router.get("/jobs", response_model=ImportJobListResponse)
def list_import_jobs(
    import_type: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ImportJobListResponse:
    stmt = select(ImportJob).order_by(ImportJob.created_at.desc(), ImportJob.id.desc()).limit(limit)
    if import_type:
        stmt = stmt.where(ImportJob.import_type == import_type)
    items = db.execute(stmt).scalars().all()
    return ImportJobListResponse(items=[ImportJobRead.model_validate(item) for item in items])


@router.get("/conflicts", response_model=ImportConflictListResponse)
def list_import_conflicts(
    status_filter: str = Query(default="pending", alias="status"),
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ImportConflictListResponse:
    if status_filter not in ALLOWED_CONFLICT_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный статус конфликта")

    stmt = (
        select(ImportConflict, ImportJob.source_filename)
        .join(ImportJob, ImportJob.id == ImportConflict.import_job_id, isouter=True)
        .where(ImportConflict.status == status_filter)
        .order_by(ImportConflict.created_at.desc(), ImportConflict.id.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return ImportConflictListResponse(
        items=[serialize_import_conflict(conflict, source_filename=source_filename) for conflict, source_filename in rows]
    )


@router.get("/conflicts/{conflict_id}", response_model=ImportConflictRead)
def get_import_conflict(
    conflict_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ImportConflictRead:
    conflict = get_import_conflict_or_404(db, conflict_id)
    job = db.get(ImportJob, conflict.import_job_id)
    return serialize_import_conflict(conflict, source_filename=job.source_filename if job is not None else None)


@router.patch("/conflicts/{conflict_id}", response_model=ImportConflictResolveResponse)
def resolve_import_conflict(
    conflict_id: int,
    payload: ImportConflictResolveRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> ImportConflictResolveResponse:
    normalized_status = payload.status.strip().lower()
    if normalized_status not in {"resolved", "ignored"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Поддерживаются только статусы resolved и ignored")

    conflict = get_import_conflict_or_404(db, conflict_id)
    old_snapshot = {
        "status": conflict.status,
        "resolution_payload": conflict.resolution_payload,
    }
    resolution_payload = dict(conflict.resolution_payload or {})
    resolution_payload.update(
        {
            "status": normalized_status,
            "comment": (payload.comment or "").strip() or None,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by_user_id": current_admin.id,
            "resolved_by_user_name": current_admin.full_name,
        }
    )
    conflict.status = normalized_status
    conflict.resolution_payload = resolution_payload
    db.add(conflict)
    db.add(
        AuditLog(
            user_id=current_admin.id,
            entity_type="import_conflict",
            entity_id=str(conflict.id),
            action_type="import_conflict_resolved",
            old_value=old_snapshot,
            new_value={
                "status": conflict.status,
                "resolution_payload": conflict.resolution_payload,
            },
        )
    )
    db.commit()
    db.refresh(conflict)
    job = db.get(ImportJob, conflict.import_job_id)
    message = "Конфликт отмечен как решённый" if normalized_status == "resolved" else "Конфликт скрыт из очереди"
    return ImportConflictResolveResponse(
        message=message,
        conflict=serialize_import_conflict(conflict, source_filename=job.source_filename if job is not None else None),
    )


@router.post("/historical-repairs", response_model=HistoricalRepairImportResponse)
def upload_historical_repairs(
    file: UploadFile = File(...),
    repair_limit: int | None = Form(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> HistoricalRepairImportResponse:
    filename = (file.filename or "").strip() or "historical_repairs.xlsx"
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживается только .xlsx выгрузка исторических ремонтов",
        )

    try:
        result = import_historical_repairs(
            db,
            file_obj=file.file,
            filename=filename,
            current_admin=current_admin,
            repair_limit=repair_limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return HistoricalRepairImportResponse(
        message=result.message,
        job_id=result.job_id,
        status=result.status,
        source_filename=result.source_filename,
        rows_total=result.rows_total,
        grouped_repairs=result.grouped_repairs,
        created_repairs=result.created_repairs,
        duplicate_repairs=result.duplicate_repairs,
        conflicts_created=result.conflicts_created,
        created_services=result.created_services,
        created_works=result.created_works,
        created_parts=result.created_parts,
        repair_limit_applied=result.repair_limit_applied,
        first_repair_id=result.first_repair_id,
        recent_repair_ids=result.recent_repair_ids,
        sample_conflicts=result.sample_conflicts,
    )
