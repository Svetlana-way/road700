from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import distinct, func, or_, select, true
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.models.enums import CatalogStatus
from app.models.labor_norm import LaborNorm
from app.models.user import User
from app.schemas.labor_norm import LaborNormImportResponse, LaborNormListResponse, LaborNormRead
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.labor_norms import (
    DEFAULT_DONGFENG_BRAND_FAMILY,
    DEFAULT_DONGFENG_CATALOG_NAME,
    DEFAULT_DONGFENG_LABOR_NORM_SCOPE,
    normalize_brand_family,
    normalize_labor_norm_scope,
)


PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_STORAGE_ROOT = PROJECT_ROOT / "storage"

router = APIRouter(prefix="/labor-norms", tags=["labor-norms"])


def normalize_catalog_filename(filename: str) -> str:
    safe_name = Path(filename).name.strip()
    if not safe_name:
        safe_name = "labor_norms.xlsx"
    return safe_name


@router.get("", response_model=LaborNormListResponse)
def list_labor_norms(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    scope: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status_filter: CatalogStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> LaborNormListResponse:
    _ = current_user

    stmt = select(LaborNorm)
    count_stmt = select(func.count(LaborNorm.id))
    normalized_scope = normalize_labor_norm_scope(scope)

    if q:
        normalized_query = f"%{q.strip().lower()}%"
        query_filter = or_(
            func.lower(LaborNorm.code).like(normalized_query),
            func.lower(LaborNorm.name_ru).like(normalized_query),
            func.lower(func.coalesce(LaborNorm.name_ru_alt, "")).like(normalized_query),
            func.lower(func.coalesce(LaborNorm.name_en, "")).like(normalized_query),
            func.lower(LaborNorm.search_text).like(normalized_query),
        )
        stmt = stmt.where(query_filter)
        count_stmt = count_stmt.where(query_filter)

    if normalized_scope:
        stmt = stmt.where(LaborNorm.scope == normalized_scope)
        count_stmt = count_stmt.where(LaborNorm.scope == normalized_scope)

    if category:
        stmt = stmt.where(LaborNorm.category == category)
        count_stmt = count_stmt.where(LaborNorm.category == category)

    if status_filter is not None:
        stmt = stmt.where(LaborNorm.status == status_filter)
        count_stmt = count_stmt.where(LaborNorm.status == status_filter)

    stmt = stmt.order_by(LaborNorm.scope.asc(), LaborNorm.category.asc(), LaborNorm.code.asc()).offset(offset).limit(limit)
    items = db.execute(stmt).scalars().all()
    total = db.scalar(count_stmt) or 0

    scopes = db.scalars(
        select(distinct(LaborNorm.scope))
        .where(LaborNorm.scope.is_not(None))
        .order_by(LaborNorm.scope.asc())
    ).all()
    categories = db.scalars(
        select(distinct(LaborNorm.category))
        .where(
            LaborNorm.category.is_not(None),
            LaborNorm.scope == normalized_scope if normalized_scope else true(),
        )
        .order_by(LaborNorm.category.asc())
    ).all()
    source_files = db.scalars(
        select(distinct(LaborNorm.source_file))
        .where(
            LaborNorm.source_file.is_not(None),
            LaborNorm.scope == normalized_scope if normalized_scope else true(),
        )
        .order_by(LaborNorm.source_file.asc())
    ).all()

    return LaborNormListResponse(
        items=[LaborNormRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        scopes=[item for item in scopes if item],
        categories=[item for item in categories if item],
        source_files=[item for item in source_files if item],
    )


@router.post("/import", response_model=LaborNormImportResponse)
def import_labor_norms(
    file: UploadFile = File(...),
    scope: str = Form(default=DEFAULT_DONGFENG_LABOR_NORM_SCOPE),
    brand_family: str | None = Form(default=DEFAULT_DONGFENG_BRAND_FAMILY),
    catalog_name: str | None = Form(default=DEFAULT_DONGFENG_CATALOG_NAME),
    note: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormImportResponse:
    _ = note
    content_type = (file.content_type or "").lower()
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Catalog file name is missing")
    if not (file.filename.lower().endswith(".xlsx") or file.filename.lower().endswith(".csv")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживается импорт каталога нормо-часов в форматах .xlsx и .csv",
        )
    if (
        content_type
        and "sheet" not in content_type
        and "excel" not in content_type
        and "csv" not in content_type
        and "octet-stream" not in content_type
        and "text/plain" not in content_type
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный тип файла каталога",
        )

    normalized_scope = normalize_labor_norm_scope(scope)
    if not normalized_scope:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный scope справочника")
    normalized_brand_family = normalize_brand_family(brand_family)
    normalized_catalog_name = catalog_name.strip() if catalog_name and catalog_name.strip() else None

    timestamp = datetime.now(timezone.utc)
    storage_dir = LOCAL_STORAGE_ROOT / "catalogs" / "labor-norms" / timestamp.strftime("%Y/%m")
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = normalize_catalog_filename(file.filename)
    stored_path = storage_dir / f"{timestamp.strftime('%Y%m%d_%H%M%S')}_{stored_filename}"

    with stored_path.open("wb") as destination:
        shutil.copyfileobj(file.file, destination)

    stats = import_labor_norms_with_session(
        db,
        path=stored_path,
        scope=normalized_scope,
        brand_family=normalized_brand_family,
        catalog_name=normalized_catalog_name,
    )

    return LaborNormImportResponse(
        message=(
            f"Справочник нормо-часов `{normalized_scope}` импортирован администратором "
            f"{current_admin.full_name}"
        ),
        filename=stored_path.name,
        imported_at=timestamp,
        created=stats.created,
        updated=stats.updated,
        skipped=stats.skipped,
    )
