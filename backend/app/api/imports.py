from __future__ import annotations

import statistics
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.api.upload_validation import validate_historical_import_upload
from app.models.repair import Repair, RepairWork
from app.models.service import Service
from app.models.vehicle import Vehicle
from app.models.audit import AuditLog
from app.models.imports import ImportConflict, ImportJob
from app.models.user import User
from app.schemas.imports import (
    HistoricalRepairImportResponse,
    HistoricalWorkReferenceListResponse,
    HistoricalWorkReferenceRead,
    HistoricalWorkReferenceServiceRead,
    ImportConflictListResponse,
    ImportConflictRead,
    ImportConflictResolveRequest,
    ImportConflictResolveResponse,
    ImportJobListResponse,
    ImportJobRead,
)
from app.services.historical_repairs_import import IMPORT_REASON_PREFIX, import_historical_repairs
from app.services.labor_norms import build_normalized_name


router = APIRouter(prefix="/imports", tags=["imports"])
ALLOWED_CONFLICT_STATUSES = {"pending", "resolved", "ignored"}


def build_historical_work_reference(
    db: Session,
    *,
    q: str | None,
    limit: int,
    min_samples: int,
) -> HistoricalWorkReferenceListResponse:
    rows = db.execute(
        select(
            Repair.id.label("repair_id"),
            Repair.repair_date,
            RepairWork.work_code,
            RepairWork.work_name,
            RepairWork.quantity,
            RepairWork.price,
            RepairWork.line_total,
            RepairWork.standard_hours,
            RepairWork.actual_hours,
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            Vehicle.vehicle_type,
        )
        .join(Repair, Repair.id == RepairWork.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .join(Service, Service.id == Repair.service_id, isouter=True)
        .where(
            Repair.reason.like(f"{IMPORT_REASON_PREFIX}%"),
            RepairWork.work_name.is_not(None),
        )
    ).all()

    normalized_query = (q or "").strip().lower()
    grouped: dict[str, dict[str, object]] = {}

    for row in rows:
        work_name = str(row.work_name or "").strip()
        if not work_name:
            continue
        work_code = str(row.work_code).strip() if row.work_code else None
        normalized_name = build_normalized_name(work_name, work_code)
        if not normalized_name and not work_code:
            continue

        key = f"code:{work_code}" if work_code else f"name:{normalized_name}"
        service_name = str(row.service_name).strip() if row.service_name else "Без сервиса"
        vehicle_type = row.vehicle_type.value if row.vehicle_type is not None else "unknown"

        entry = grouped.setdefault(
            key,
            {
                "key": key,
                "work_code": work_code,
                "work_name": work_name,
                "normalized_name": normalized_name,
                "repair_ids": set(),
                "line_totals": [],
                "prices": [],
                "quantities": [],
                "standard_hours": [],
                "actual_hours": [],
                "vehicle_types": set(),
                "recent_repair_date": None,
                "service_counts": Counter(),
            },
        )

        if not entry["work_code"] and work_code:
            entry["work_code"] = work_code
        if len(work_name) > len(str(entry["work_name"])):
            entry["work_name"] = work_name
        if not entry["normalized_name"] and normalized_name:
            entry["normalized_name"] = normalized_name

        cast_repair_ids = entry["repair_ids"]
        cast_line_totals = entry["line_totals"]
        cast_prices = entry["prices"]
        cast_quantities = entry["quantities"]
        cast_standard_hours = entry["standard_hours"]
        cast_actual_hours = entry["actual_hours"]
        cast_vehicle_types = entry["vehicle_types"]
        cast_service_counts = entry["service_counts"]

        cast_repair_ids.add(int(row.repair_id))
        cast_line_totals.append(float(row.line_total))
        cast_prices.append(float(row.price))
        cast_quantities.append(float(row.quantity))
        if row.standard_hours is not None:
            cast_standard_hours.append(float(row.standard_hours))
        if row.actual_hours is not None:
            cast_actual_hours.append(float(row.actual_hours))
        cast_vehicle_types.add(vehicle_type)
        cast_service_counts[(row.service_id, service_name)] += 1

        recent_repair_date = entry["recent_repair_date"]
        if recent_repair_date is None or row.repair_date > recent_repair_date:
            entry["recent_repair_date"] = row.repair_date

    filtered_items: list[HistoricalWorkReferenceRead] = []
    for entry in grouped.values():
        sample_lines = len(entry["line_totals"])
        if sample_lines < min_samples:
            continue

        haystack = " ".join(
            [
                str(entry["work_code"] or ""),
                str(entry["work_name"]),
                str(entry["normalized_name"]),
                " ".join(name for _, name in entry["service_counts"].keys()),
            ]
        ).lower()
        if normalized_query and normalized_query not in haystack:
            continue

        top_services = [
            HistoricalWorkReferenceServiceRead(
                service_id=service_id,
                service_name=service_name,
                samples=samples,
            )
            for (service_id, service_name), samples in entry["service_counts"].most_common(3)
        ]

        filtered_items.append(
            HistoricalWorkReferenceRead(
                key=str(entry["key"]),
                work_code=entry["work_code"],
                work_name=str(entry["work_name"]),
                normalized_name=str(entry["normalized_name"]),
                sample_repairs=len(entry["repair_ids"]),
                sample_lines=sample_lines,
                services_count=len(entry["service_counts"]),
                vehicle_types=sorted(entry["vehicle_types"]),
                median_line_total=round(float(statistics.median(entry["line_totals"])), 2),
                min_line_total=round(float(min(entry["line_totals"])), 2),
                max_line_total=round(float(max(entry["line_totals"])), 2),
                median_price=round(float(statistics.median(entry["prices"])), 2),
                median_quantity=round(float(statistics.median(entry["quantities"])), 2),
                median_standard_hours=(
                    round(float(statistics.median(entry["standard_hours"])), 2)
                    if entry["standard_hours"]
                    else None
                ),
                median_actual_hours=(
                    round(float(statistics.median(entry["actual_hours"])), 2)
                    if entry["actual_hours"]
                    else None
                ),
                recent_repair_date=(
                    datetime.combine(entry["recent_repair_date"], datetime.min.time(), tzinfo=timezone.utc)
                    if entry["recent_repair_date"] is not None
                    else None
                ),
                top_services=top_services,
            )
        )

    filtered_items.sort(
        key=lambda item: (
            item.sample_lines,
            item.sample_repairs,
            item.recent_repair_date or datetime.min.replace(tzinfo=timezone.utc),
            item.work_name,
        ),
        reverse=True,
    )

    return HistoricalWorkReferenceListResponse(
        items=filtered_items[:limit],
        total=len(filtered_items),
        limit=limit,
        q=normalized_query or None,
        min_samples=min_samples,
    )


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
    validate_historical_import_upload(file)
    filename = (file.filename or "").strip() or "historical_repairs.xlsx"

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


@router.get("/historical-work-reference", response_model=HistoricalWorkReferenceListResponse)
def list_historical_work_reference(
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    min_samples: int = Query(default=2, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> HistoricalWorkReferenceListResponse:
    return build_historical_work_reference(db, q=q, limit=limit, min_samples=min_samples)
