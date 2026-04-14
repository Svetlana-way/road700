from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import distinct, func, or_, select, true
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_admin, get_db
from app.api.upload_validation import validate_labor_norm_import_upload
from app.core.paths import get_storage_root
from app.models.audit import AuditLog
from app.models.enums import CatalogStatus, UserRole
from app.models.labor_norm import LaborNorm
from app.models.labor_norm_catalog import LaborNormCatalog
from app.models.user import User
from app.schemas.labor_norm import (
    LaborNormCatalogCreate,
    LaborNormCatalogListResponse,
    LaborNormCatalogRead,
    LaborNormCatalogUpdate,
    LaborNormCreate,
    LaborNormImportResponse,
    LaborNormListResponse,
    LaborNormRead,
    LaborNormUpdate,
)
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.labor_norms import (
    DEFAULT_DONGFENG_BRAND_FAMILY,
    DEFAULT_DONGFENG_CATALOG_NAME,
    DEFAULT_DONGFENG_LABOR_NORM_SCOPE,
    build_normalized_name,
    build_search_text,
    load_labor_norm_catalogs,
    normalize_brand_family,
    normalize_labor_norm_code,
    normalize_labor_norm_scope,
    sync_labor_norm_catalog_metadata,
    upsert_labor_norm_catalog,
)

router = APIRouter(prefix="/labor-norms", tags=["labor-norms"])


def coerce_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def serialize_labor_norm_catalog(catalog: LaborNormCatalog) -> LaborNormCatalogRead:
    return LaborNormCatalogRead(
        id=catalog.id,
        scope=catalog.scope,
        catalog_name=catalog.catalog_name,
        brand_family=catalog.brand_family,
        vehicle_type=catalog.vehicle_type,
        year_from=catalog.year_from,
        year_to=catalog.year_to,
        brand_keywords=coerce_string_list(catalog.brand_keywords) if catalog.brand_keywords is not None else None,
        model_keywords=coerce_string_list(catalog.model_keywords) if catalog.model_keywords is not None else None,
        vin_prefixes=coerce_string_list(catalog.vin_prefixes) if catalog.vin_prefixes is not None else None,
        priority=catalog.priority,
        auto_match_enabled=catalog.auto_match_enabled,
        status=catalog.status,
        notes=catalog.notes,
        created_at=catalog.created_at,
        updated_at=catalog.updated_at,
    )


def normalize_catalog_filename(filename: str) -> str:
    safe_name = Path(filename).name.strip()
    if not safe_name:
        safe_name = "labor_norms.xlsx"
    return safe_name


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized_value = value.strip()
    return normalized_value or None


def get_catalog_by_scope(db: Session, scope: str) -> LaborNormCatalog:
    normalized_scope = normalize_labor_norm_scope(scope)
    if not normalized_scope:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный scope справочника")
    catalog = db.scalar(select(LaborNormCatalog).where(LaborNormCatalog.scope == normalized_scope))
    if catalog is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Каталог нормо-часов `{normalized_scope}` не найден",
        )
    return catalog


def ensure_catalog_is_operational(catalog: LaborNormCatalog) -> None:
    if catalog.status == CatalogStatus.ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Архивный каталог `{catalog.scope}` доступен только для чтения",
        )


def get_labor_norm_or_404(db: Session, labor_norm_id: int) -> LaborNorm:
    labor_norm = db.scalar(select(LaborNorm).where(LaborNorm.id == labor_norm_id))
    if labor_norm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запись нормо-часов не найдена")
    return labor_norm


def build_catalog_audit_snapshot(catalog: LaborNormCatalog) -> dict[str, object]:
    return {
        "scope": catalog.scope,
        "catalog_name": catalog.catalog_name,
        "brand_family": catalog.brand_family,
        "vehicle_type": catalog.vehicle_type.value if catalog.vehicle_type is not None else None,
        "year_from": catalog.year_from,
        "year_to": catalog.year_to,
        "brand_keywords": coerce_string_list(catalog.brand_keywords),
        "model_keywords": coerce_string_list(catalog.model_keywords),
        "vin_prefixes": coerce_string_list(catalog.vin_prefixes),
        "priority": catalog.priority,
        "auto_match_enabled": catalog.auto_match_enabled,
        "status": catalog.status.value,
        "notes": catalog.notes,
    }


def build_labor_norm_audit_snapshot(labor_norm: LaborNorm) -> dict[str, object]:
    return {
        "scope": labor_norm.scope,
        "brand_family": labor_norm.brand_family,
        "catalog_name": labor_norm.catalog_name,
        "code": labor_norm.code,
        "category": labor_norm.category,
        "name_ru": labor_norm.name_ru,
        "name_ru_alt": labor_norm.name_ru_alt,
        "name_cn": labor_norm.name_cn,
        "name_en": labor_norm.name_en,
        "standard_hours": labor_norm.standard_hours,
        "source_sheet": labor_norm.source_sheet,
        "source_file": labor_norm.source_file,
        "status": labor_norm.status.value,
    }


def write_audit_entry(
    db: Session,
    *,
    user_id: int | None,
    entity_type: str,
    entity_id: str,
    action_type: str,
    old_value: dict[str, object] | None,
    new_value: dict[str, object] | None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action_type=action_type,
            old_value=old_value,
            new_value=new_value,
        )
    )


def populate_labor_norm_from_payload(
    labor_norm: LaborNorm,
    *,
    catalog: LaborNormCatalog,
    code: str,
    category: str | None,
    name_ru: str,
    name_ru_alt: str | None,
    name_cn: str | None,
    name_en: str | None,
    standard_hours: float,
    source_sheet: str | None,
    source_file: str | None,
    record_status: CatalogStatus,
) -> None:
    normalized_code = normalize_labor_norm_code(code)
    if not normalized_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный код операции")

    normalized_name_ru = normalize_optional_text(name_ru)
    if not normalized_name_ru:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Русское название операции обязательно")

    labor_norm.scope = catalog.scope
    labor_norm.brand_family = catalog.brand_family
    labor_norm.catalog_name = catalog.catalog_name
    labor_norm.code = normalized_code
    labor_norm.category = normalize_optional_text(category) or "Общее"
    labor_norm.name_ru = normalized_name_ru
    labor_norm.name_ru_alt = normalize_optional_text(name_ru_alt)
    labor_norm.name_cn = normalize_optional_text(name_cn)
    labor_norm.name_en = normalize_optional_text(name_en)
    labor_norm.normalized_name = build_normalized_name(
        labor_norm.name_ru,
        labor_norm.name_ru_alt,
        labor_norm.name_en,
    )
    labor_norm.search_text = build_search_text(
        labor_norm.code,
        labor_norm.category,
        labor_norm.name_ru,
        labor_norm.name_ru_alt,
        labor_norm.name_en,
        labor_norm.name_cn,
    )
    labor_norm.standard_hours = round(float(standard_hours), 2)
    labor_norm.source_sheet = normalize_optional_text(source_sheet)
    labor_norm.source_file = normalize_optional_text(source_file)
    labor_norm.status = record_status


@router.get("/catalogs", response_model=LaborNormCatalogListResponse)
def list_labor_norm_catalogs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormCatalogListResponse:
    _ = current_admin
    items = load_labor_norm_catalogs(db, include_archived=True)
    return LaborNormCatalogListResponse(
        items=[serialize_labor_norm_catalog(item) for item in items],
        scopes=[item.scope for item in items],
    )


@router.post("/catalogs", response_model=LaborNormCatalogRead)
def create_labor_norm_catalog(
    payload: LaborNormCatalogCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormCatalogRead:
    _ = current_admin
    normalized_scope = normalize_labor_norm_scope(payload.scope)
    if not normalized_scope:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный scope справочника")
    existing = db.scalar(select(LaborNormCatalog).where(LaborNormCatalog.scope == normalized_scope))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Каталог `{normalized_scope}` уже существует",
        )

    catalog = upsert_labor_norm_catalog(
        db,
        scope=payload.scope,
        catalog_name=payload.catalog_name,
        brand_family=payload.brand_family,
        vehicle_type=payload.vehicle_type,
        year_from=payload.year_from,
        year_to=payload.year_to,
        brand_keywords=payload.brand_keywords,
        model_keywords=payload.model_keywords,
        vin_prefixes=payload.vin_prefixes,
        priority=payload.priority,
        auto_match_enabled=payload.auto_match_enabled,
        status=payload.status,
        notes=payload.notes,
    )
    db.flush()
    write_audit_entry(
        db,
        user_id=current_admin.id,
        entity_type="labor_norm_catalog",
        entity_id=str(catalog.id),
        action_type="labor_norm_catalog_created",
        old_value=None,
        new_value=build_catalog_audit_snapshot(catalog),
    )
    db.commit()
    db.refresh(catalog)
    return serialize_labor_norm_catalog(catalog)


@router.patch("/catalogs/{catalog_id}", response_model=LaborNormCatalogRead)
def update_labor_norm_catalog(
    catalog_id: int,
    payload: LaborNormCatalogUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormCatalogRead:
    _ = current_admin
    catalog = db.scalar(select(LaborNormCatalog).where(LaborNormCatalog.id == catalog_id))
    if catalog is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Каталог нормо-часов не найден")

    old_snapshot = build_catalog_audit_snapshot(catalog)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return serialize_labor_norm_catalog(catalog)

    catalog = upsert_labor_norm_catalog(db, scope=catalog.scope, **update_data)
    db.flush()
    new_snapshot = build_catalog_audit_snapshot(catalog)
    action_type = "labor_norm_catalog_updated"
    if old_snapshot["status"] != new_snapshot["status"] and new_snapshot["status"] == CatalogStatus.ARCHIVED.value:
        action_type = "labor_norm_catalog_archived"
    write_audit_entry(
        db,
        user_id=current_admin.id,
        entity_type="labor_norm_catalog",
        entity_id=str(catalog.id),
        action_type=action_type,
        old_value=old_snapshot,
        new_value=new_snapshot,
    )
    db.commit()
    db.refresh(catalog)
    return serialize_labor_norm_catalog(catalog)


@router.get("", response_model=LaborNormListResponse)
def list_labor_norms(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    scope: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status_filter: CatalogStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormListResponse:
    _ = current_admin
    stmt = select(LaborNorm).outerjoin(LaborNormCatalog, LaborNormCatalog.scope == LaborNorm.scope)
    count_stmt = (
        select(func.count(LaborNorm.id))
        .select_from(LaborNorm)
        .outerjoin(LaborNormCatalog, LaborNormCatalog.scope == LaborNorm.scope)
    )
    query_filter = None
    normalized_scope = normalize_labor_norm_scope(scope)
    catalog_operational_clause = or_(
        LaborNormCatalog.id.is_(None),
        LaborNormCatalog.status != CatalogStatus.ARCHIVED,
    )

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
    else:
        stmt = stmt.where(
            LaborNorm.status != CatalogStatus.ARCHIVED,
            catalog_operational_clause,
        )
        count_stmt = count_stmt.where(
            LaborNorm.status != CatalogStatus.ARCHIVED,
            catalog_operational_clause,
        )

    stmt = stmt.order_by(LaborNorm.scope.asc(), LaborNorm.category.asc(), LaborNorm.code.asc()).offset(offset).limit(limit)
    items = db.execute(stmt).scalars().all()
    total = db.scalar(count_stmt) or 0

    scope_stmt = (
        select(distinct(LaborNorm.scope))
        .select_from(LaborNorm)
        .outerjoin(LaborNormCatalog, LaborNormCatalog.scope == LaborNorm.scope)
        .where(
            LaborNorm.scope.is_not(None),
            query_filter if query_filter is not None else true(),
        )
        .order_by(LaborNorm.scope.asc())
    )
    category_stmt = (
        select(distinct(LaborNorm.category))
        .select_from(LaborNorm)
        .outerjoin(LaborNormCatalog, LaborNormCatalog.scope == LaborNorm.scope)
        .where(
            LaborNorm.category.is_not(None),
            query_filter if query_filter is not None else true(),
            LaborNorm.scope == normalized_scope if normalized_scope else true(),
        )
        .order_by(LaborNorm.category.asc())
    )
    source_file_stmt = (
        select(distinct(LaborNorm.source_file))
        .select_from(LaborNorm)
        .outerjoin(LaborNormCatalog, LaborNormCatalog.scope == LaborNorm.scope)
        .where(
            LaborNorm.source_file.is_not(None),
            query_filter if query_filter is not None else true(),
            LaborNorm.scope == normalized_scope if normalized_scope else true(),
        )
        .order_by(LaborNorm.source_file.asc())
    )
    if status_filter is not None:
        scope_stmt = scope_stmt.where(LaborNorm.status == status_filter)
        category_stmt = category_stmt.where(LaborNorm.status == status_filter)
        source_file_stmt = source_file_stmt.where(LaborNorm.status == status_filter)
    else:
        scope_stmt = scope_stmt.where(LaborNorm.status != CatalogStatus.ARCHIVED, catalog_operational_clause)
        category_stmt = category_stmt.where(LaborNorm.status != CatalogStatus.ARCHIVED, catalog_operational_clause)
        source_file_stmt = source_file_stmt.where(LaborNorm.status != CatalogStatus.ARCHIVED, catalog_operational_clause)

    scopes = db.scalars(scope_stmt).all()
    categories = db.scalars(category_stmt).all()
    source_files = db.scalars(source_file_stmt).all()

    return LaborNormListResponse(
        items=[LaborNormRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        scopes=[item for item in scopes if item],
        categories=[item for item in categories if item],
        source_files=[item for item in source_files if item],
    )


@router.post("", response_model=LaborNormRead)
def create_labor_norm(
    payload: LaborNormCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormRead:
    _ = current_admin
    catalog = get_catalog_by_scope(db, payload.scope)
    ensure_catalog_is_operational(catalog)
    existing = db.scalar(
        select(LaborNorm).where(
            LaborNorm.scope == catalog.scope,
            LaborNorm.code == normalize_labor_norm_code(payload.code),
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"В scope `{catalog.scope}` уже существует запись с таким кодом",
        )

    labor_norm = LaborNorm(scope=catalog.scope, code=normalize_labor_norm_code(payload.code) or "")
    populate_labor_norm_from_payload(
        labor_norm,
        catalog=catalog,
        code=payload.code,
        category=payload.category,
        name_ru=payload.name_ru,
        name_ru_alt=payload.name_ru_alt,
        name_cn=payload.name_cn,
        name_en=payload.name_en,
        standard_hours=payload.standard_hours,
        source_sheet=payload.source_sheet,
        source_file=payload.source_file,
        record_status=payload.status,
    )
    db.add(labor_norm)
    db.flush()
    write_audit_entry(
        db,
        user_id=current_admin.id,
        entity_type="labor_norm_item",
        entity_id=str(labor_norm.id),
        action_type="labor_norm_item_created",
        old_value=None,
        new_value=build_labor_norm_audit_snapshot(labor_norm),
    )
    db.commit()
    db.refresh(labor_norm)
    return LaborNormRead.model_validate(labor_norm)


@router.patch("/{labor_norm_id}", response_model=LaborNormRead)
def update_labor_norm(
    labor_norm_id: int,
    payload: LaborNormUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> LaborNormRead:
    _ = current_admin
    labor_norm = get_labor_norm_or_404(db, labor_norm_id)
    current_catalog = get_catalog_by_scope(db, labor_norm.scope)
    ensure_catalog_is_operational(current_catalog)
    old_snapshot = build_labor_norm_audit_snapshot(labor_norm)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return LaborNormRead.model_validate(labor_norm)

    target_scope = update_data.get("scope", labor_norm.scope)
    catalog = get_catalog_by_scope(db, target_scope)
    ensure_catalog_is_operational(catalog)
    target_code = normalize_labor_norm_code(update_data.get("code", labor_norm.code))
    if not target_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный код операции")

    duplicate = db.scalar(
        select(LaborNorm).where(
            LaborNorm.scope == catalog.scope,
            LaborNorm.code == target_code,
            LaborNorm.id != labor_norm.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"В scope `{catalog.scope}` уже существует запись с таким кодом",
        )

    populate_labor_norm_from_payload(
        labor_norm,
        catalog=catalog,
        code=update_data.get("code", labor_norm.code),
        category=update_data.get("category", labor_norm.category),
        name_ru=update_data.get("name_ru", labor_norm.name_ru),
        name_ru_alt=update_data.get("name_ru_alt", labor_norm.name_ru_alt),
        name_cn=update_data.get("name_cn", labor_norm.name_cn),
        name_en=update_data.get("name_en", labor_norm.name_en),
        standard_hours=update_data.get("standard_hours", labor_norm.standard_hours),
        source_sheet=update_data.get("source_sheet", labor_norm.source_sheet),
        source_file=update_data.get("source_file", labor_norm.source_file),
        record_status=update_data.get("status", labor_norm.status),
    )
    db.add(labor_norm)
    db.flush()
    new_snapshot = build_labor_norm_audit_snapshot(labor_norm)
    action_type = "labor_norm_item_updated"
    if old_snapshot["status"] != new_snapshot["status"] and new_snapshot["status"] == CatalogStatus.ARCHIVED.value:
        action_type = "labor_norm_item_archived"
    write_audit_entry(
        db,
        user_id=current_admin.id,
        entity_type="labor_norm_item",
        entity_id=str(labor_norm.id),
        action_type=action_type,
        old_value=old_snapshot,
        new_value=new_snapshot,
    )
    db.commit()
    db.refresh(labor_norm)
    return LaborNormRead.model_validate(labor_norm)


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
    validate_labor_norm_import_upload(file)

    normalized_scope = normalize_labor_norm_scope(scope)
    if not normalized_scope:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный scope справочника")
    normalized_brand_family = normalize_brand_family(brand_family)
    normalized_catalog_name = catalog_name.strip() if catalog_name and catalog_name.strip() else None
    catalog = db.scalar(select(LaborNormCatalog).where(LaborNormCatalog.scope == normalized_scope))
    if catalog is not None:
        ensure_catalog_is_operational(catalog)
    effective_brand_family = normalized_brand_family if normalized_brand_family is not None else catalog.brand_family if catalog else None
    effective_catalog_name = normalized_catalog_name if normalized_catalog_name is not None else catalog.catalog_name if catalog else normalized_scope

    timestamp = datetime.now(timezone.utc)
    storage_dir = get_storage_root() / "catalogs" / "labor-norms" / timestamp.strftime("%Y/%m")
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = normalize_catalog_filename(file.filename)
    stored_path = storage_dir / f"{timestamp.strftime('%Y%m%d_%H%M%S')}_{stored_filename}"

    with stored_path.open("wb") as destination:
        shutil.copyfileobj(file.file, destination)

    upsert_labor_norm_catalog(
        db,
        scope=normalized_scope,
        catalog_name=effective_catalog_name,
        brand_family=effective_brand_family,
        notes=catalog.notes if catalog else None,
        auto_match_enabled=catalog.auto_match_enabled if catalog else (normalized_scope == DEFAULT_DONGFENG_LABOR_NORM_SCOPE),
        priority=catalog.priority if catalog else (100 if normalized_scope == DEFAULT_DONGFENG_LABOR_NORM_SCOPE else 200),
        status=catalog.status if catalog else CatalogStatus.CONFIRMED,
        vehicle_type=catalog.vehicle_type if catalog else None,
        year_from=catalog.year_from if catalog else None,
        year_to=catalog.year_to if catalog else None,
        brand_keywords=catalog.brand_keywords if catalog else [],
        model_keywords=catalog.model_keywords if catalog else [],
        vin_prefixes=catalog.vin_prefixes if catalog else [],
    )
    try:
        stats = import_labor_norms_with_session(
            db,
            path=stored_path,
            scope=normalized_scope,
            brand_family=effective_brand_family,
            catalog_name=effective_catalog_name,
        )
    except Exception as error:
        db.rollback()
        if stored_path.exists():
            stored_path.unlink()
        write_audit_entry(
            db,
            user_id=current_admin.id,
            entity_type="labor_norm_import",
            entity_id=normalized_scope,
            action_type="labor_norm_import_failed",
            old_value=None,
            new_value={
                "scope": normalized_scope,
                "catalog_name": effective_catalog_name,
                "brand_family": effective_brand_family,
                "filename": stored_path.name,
                "error": str(error),
            },
        )
        db.commit()
        if isinstance(error, ValueError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
        raise

    refreshed_catalog = db.scalar(select(LaborNormCatalog).where(LaborNormCatalog.scope == normalized_scope))
    if refreshed_catalog is not None:
        sync_labor_norm_catalog_metadata(db, refreshed_catalog)
        write_audit_entry(
            db,
            user_id=current_admin.id,
            entity_type="labor_norm_import",
            entity_id=normalized_scope,
            action_type="labor_norm_import_succeeded",
            old_value=None,
            new_value={
                "scope": normalized_scope,
                "catalog_id": refreshed_catalog.id,
                "catalog_name": refreshed_catalog.catalog_name,
                "brand_family": refreshed_catalog.brand_family,
                "filename": stored_path.name,
                "created": stats.created,
                "updated": stats.updated,
                "skipped": stats.skipped,
            },
        )
        db.commit()

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
