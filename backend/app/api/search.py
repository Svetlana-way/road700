from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.application.services.visibility import (
    apply_vehicle_scope,
    get_non_placeholder_vehicle_clause,
    get_repair_visibility_clause,
)
from app.models.document import Document
from app.models.enums import DocumentStatus, RepairStatus, ServiceStatus, VehicleStatus
from app.models.repair import Repair, RepairPart, RepairWork
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.search import (
    GlobalSearchDocumentItem,
    GlobalSearchRepairItem,
    GlobalSearchResponse,
    GlobalSearchVehicleItem,
)


router = APIRouter(prefix="/search", tags=["search"])


def _contains_query(value: str | None, query: str) -> bool:
    return bool(value and query in value.lower())


def _build_document_matched_by(
    query: str,
    document: Document,
    repair: Repair,
    vehicle: Vehicle,
    service: Service | None,
) -> list[str]:
    matched_by: list[str] = []
    if _contains_query(document.original_filename, query):
        matched_by.append("имя файла")
    if _contains_query(repair.order_number, query):
        matched_by.append("номер заказ-наряда")
    if _contains_query(vehicle.plate_number, query):
        matched_by.append("госномер")
    if _contains_query(vehicle.vin, query):
        matched_by.append("VIN")
    if _contains_query(service.name if service else None, query):
        matched_by.append("сервис")
    return matched_by


def _build_repair_matched_by(query: str, repair: Repair, vehicle: Vehicle, service: Service | None) -> list[str]:
    matched_by: list[str] = []
    if _contains_query(repair.order_number, query):
        matched_by.append("номер заказ-наряда")
    if _contains_query(vehicle.plate_number, query):
        matched_by.append("госномер")
    if _contains_query(vehicle.vin, query):
        matched_by.append("VIN")
    if _contains_query(service.name if service else None, query):
        matched_by.append("сервис")
    return matched_by


def _build_vehicle_matched_by(query: str, vehicle: Vehicle) -> list[str]:
    matched_by: list[str] = []
    if _contains_query(vehicle.plate_number, query):
        matched_by.append("госномер")
    if _contains_query(vehicle.vin, query):
        matched_by.append("VIN")
    if _contains_query(vehicle.brand, query):
        matched_by.append("марка")
    if _contains_query(vehicle.model, query):
        matched_by.append("модель")
    if _contains_query(vehicle.external_id, query):
        matched_by.append("внешний код")
    return matched_by


def _build_repair_search_clause(pattern: str):
    work_match = (
        select(RepairWork.id)
        .where(
            RepairWork.repair_id == Repair.id,
            or_(
                RepairWork.work_name.ilike(pattern),
                RepairWork.work_code.ilike(pattern),
            ),
        )
        .exists()
    )
    part_match = (
        select(RepairPart.id)
        .where(
            RepairPart.repair_id == Repair.id,
            or_(
                RepairPart.article.ilike(pattern),
                RepairPart.part_name.ilike(pattern),
            ),
        )
        .exists()
    )
    return or_(
        Repair.order_number.ilike(pattern),
        Vehicle.plate_number.ilike(pattern),
        Vehicle.vin.ilike(pattern),
        Vehicle.brand.ilike(pattern),
        Vehicle.model.ilike(pattern),
        Vehicle.external_id.ilike(pattern),
        Service.name.ilike(pattern),
        work_match,
        part_match,
    )


@router.get("/global", response_model=GlobalSearchResponse)
def global_search(
    q: str = Query(min_length=2),
    limit_per_section: int = Query(default=8, ge=1, le=25),
    offset_per_section: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> GlobalSearchResponse:
    normalized_query = q.strip()
    if len(normalized_query) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Введите минимум 2 символа для поиска")
    pattern = f"%{normalized_query}%"
    query_lower = normalized_query.lower()

    repair_search_clause = _build_repair_search_clause(pattern)
    repair_visibility_clause = get_repair_visibility_clause(current_user)

    documents_stmt = (
        select(
            Document,
            Repair,
            Vehicle,
            Service,
            func.count(Document.id).over().label("documents_total"),
        )
        .join(Repair, Document.repair_id == Repair.id)
        .join(Vehicle, Repair.vehicle_id == Vehicle.id)
        .outerjoin(Service, Repair.service_id == Service.id)
        .where(
            repair_visibility_clause,
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
            Vehicle.status != VehicleStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            or_(
                Document.original_filename.ilike(pattern),
                repair_search_clause,
            ),
        )
        .order_by(Document.created_at.desc(), Document.id.desc())
        .offset(offset_per_section)
        .limit(limit_per_section)
    )

    repairs_stmt = (
        select(
            Repair,
            Vehicle,
            Service,
            func.count(Repair.id).over().label("repairs_total"),
        )
        .join(Vehicle, Repair.vehicle_id == Vehicle.id)
        .outerjoin(Service, Repair.service_id == Service.id)
        .where(
            repair_visibility_clause,
            Repair.status != RepairStatus.ARCHIVED,
            Vehicle.status != VehicleStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            repair_search_clause,
        )
        .order_by(Repair.repair_date.desc(), Repair.id.desc())
        .offset(offset_per_section)
        .limit(limit_per_section)
    )

    vehicle_search_clause = or_(
        Vehicle.plate_number.ilike(pattern),
        Vehicle.vin.ilike(pattern),
        Vehicle.brand.ilike(pattern),
        Vehicle.model.ilike(pattern),
        Vehicle.external_id.ilike(pattern),
    )
    vehicles_stmt = (
        apply_vehicle_scope(
            select(
                Vehicle,
                func.count(Vehicle.id).over().label("vehicles_total"),
            ).where(vehicle_search_clause, Vehicle.status != VehicleStatus.ARCHIVED, get_non_placeholder_vehicle_clause()),
            current_user,
        )
        .order_by(Vehicle.updated_at.desc(), Vehicle.id.desc())
        .offset(offset_per_section)
        .limit(limit_per_section)
    )

    document_rows = db.execute(documents_stmt).all()
    repair_rows = db.execute(repairs_stmt).all()
    vehicle_rows = db.execute(vehicles_stmt).all()
    documents_total = int(document_rows[0].documents_total) if document_rows else 0
    repairs_total = int(repair_rows[0].repairs_total) if repair_rows else 0
    vehicles_total = int(vehicle_rows[0].vehicles_total) if vehicle_rows else 0

    return GlobalSearchResponse(
        query=normalized_query,
        documents_total=documents_total,
        repairs_total=repairs_total,
        vehicles_total=vehicles_total,
        documents=[
            GlobalSearchDocumentItem(
                document_id=document.id,
                repair_id=repair.id if repair else None,
                vehicle_id=vehicle.id if vehicle else None,
                original_filename=document.original_filename,
                document_status=document.status,
                ocr_confidence=document.ocr_confidence,
                order_number=repair.order_number if repair else None,
                repair_date=repair.repair_date if repair else None,
                service_name=service.name if service else None,
                plate_number=vehicle.plate_number if vehicle else None,
                vin=vehicle.vin if vehicle else None,
                matched_by=_build_document_matched_by(query_lower, document, repair, vehicle, service),
                created_at=document.created_at,
            )
            for document, repair, vehicle, service, _documents_total in document_rows
        ],
        repairs=[
            GlobalSearchRepairItem(
                repair_id=repair.id,
                vehicle_id=vehicle.id,
                order_number=repair.order_number,
                repair_date=repair.repair_date,
                repair_status=repair.status,
                service_name=service.name if service else None,
                plate_number=vehicle.plate_number,
                vin=vehicle.vin,
                grand_total=float(repair.grand_total or 0),
                matched_by=_build_repair_matched_by(query_lower, repair, vehicle, service),
                created_at=repair.created_at,
            )
            for repair, vehicle, service, _repairs_total in repair_rows
        ],
        vehicles=[
            GlobalSearchVehicleItem(
                vehicle_id=vehicle.id,
                vehicle_type=vehicle.vehicle_type,
                plate_number=vehicle.plate_number,
                vin=vehicle.vin,
                brand=vehicle.brand,
                model=vehicle.model,
                status=vehicle.status,
                archived_at=vehicle.archived_at,
                matched_by=_build_vehicle_matched_by(query_lower, vehicle),
                updated_at=vehicle.updated_at,
            )
            for vehicle, _vehicles_total in vehicle_rows
        ],
    )
