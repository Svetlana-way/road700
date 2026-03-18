from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.models.imports import ImportJob
from app.models.user import User
from app.schemas.imports import HistoricalRepairImportResponse, ImportJobListResponse, ImportJobRead
from app.services.historical_repairs_import import import_historical_repairs


router = APIRouter(prefix="/imports", tags=["imports"])


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
