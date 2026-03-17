from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.document import Document
from app.models.enums import CatalogStatus, DocumentStatus, RepairStatus, ServiceStatus, UserRole
from app.models.imports import ImportConflict, ImportJob
from app.models.repair import Repair, RepairPart, RepairWork
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.dashboard import (
    DashboardDataQualityDetailsCounts,
    DashboardDataQualityDetailsResponse,
    DashboardDataQualityResponse,
    DashboardQualityConflictItem,
    DashboardQualityDocumentItem,
    DashboardQualityPartItem,
    DashboardQualityServiceItem,
    DashboardQualityWorkItem,
    DashboardSummaryResponse,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


REVIEW_QUEUE_DOCUMENT_STATUSES = [
    DocumentStatus.UPLOADED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.OCR_ERROR,
]

ACTIVE_REVIEW_DOCUMENT_STATUSES = [
    DocumentStatus.UPLOADED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
]


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardSummaryResponse:
    if current_user.role == UserRole.ADMIN:
        vehicle_count = db.scalar(select(func.count(Vehicle.id))) or 0
        repair_count = db.scalar(select(func.count(Repair.id))) or 0
        draft_count = db.scalar(select(func.count(Repair.id)).where(Repair.status == RepairStatus.DRAFT)) or 0
        suspicious_count = (
            db.scalar(select(func.count(Repair.id)).where(Repair.status == RepairStatus.SUSPICIOUS)) or 0
        )
        document_count = db.scalar(select(func.count(Document.id))) or 0
        review_queue_count = (
            db.scalar(
                select(func.count(Document.id)).where(
                    Document.status.in_(REVIEW_QUEUE_DOCUMENT_STATUSES)
                )
            )
            or 0
        )
    else:
        visible_ids = get_allowed_vehicle_ids_query(current_user)
        vehicle_count = db.scalar(select(func.count(Vehicle.id)).where(Vehicle.id.in_(visible_ids))) or 0
        repair_count = db.scalar(select(func.count(Repair.id)).where(Repair.vehicle_id.in_(visible_ids))) or 0
        draft_count = (
            db.scalar(
                select(func.count(Repair.id)).where(
                    Repair.vehicle_id.in_(visible_ids),
                    Repair.status == RepairStatus.DRAFT,
                )
            )
            or 0
        )
        suspicious_count = (
            db.scalar(
                select(func.count(Repair.id)).where(
                    Repair.vehicle_id.in_(visible_ids),
                    Repair.status == RepairStatus.SUSPICIOUS,
                )
            )
            or 0
        )
        document_count = (
            db.scalar(
                select(func.count(Document.id)).join(Document.repair).where(Repair.vehicle_id.in_(visible_ids))
            )
            or 0
        )
        review_queue_count = (
            db.scalar(
                select(func.count(Document.id))
                .join(Document.repair)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    Document.status.in_(REVIEW_QUEUE_DOCUMENT_STATUSES),
                )
            )
            or 0
        )

    return DashboardSummaryResponse(
        vehicles_total=vehicle_count,
        repairs_total=repair_count,
        repairs_draft=draft_count,
        repairs_suspicious=suspicious_count,
        documents_total=document_count,
        documents_review_queue=review_queue_count,
    )


@router.get("/data-quality", response_model=DashboardDataQualityResponse)
def get_dashboard_data_quality(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardDataQualityResponse:
    if current_user.role == UserRole.ADMIN:
        average_ocr_confidence = db.scalar(select(func.avg(Document.ocr_confidence)))
        documents_low_confidence = (
            db.scalar(
                select(func.count(Document.id)).where(
                    Document.ocr_confidence.is_not(None),
                    Document.ocr_confidence < 0.9,
                )
            )
            or 0
        )
        documents_ocr_error = (
            db.scalar(select(func.count(Document.id)).where(Document.status == DocumentStatus.OCR_ERROR)) or 0
        )
        documents_needs_review = (
            db.scalar(
                select(func.count(Document.id)).where(
                    Document.status.in_(
                        ACTIVE_REVIEW_DOCUMENT_STATUSES
                    )
                )
            )
            or 0
        )
        services_preliminary = (
            db.scalar(select(func.count(Service.id)).where(Service.status == ServiceStatus.PRELIMINARY)) or 0
        )
        works_preliminary = (
            db.scalar(select(func.count(RepairWork.id)).where(RepairWork.status == CatalogStatus.PRELIMINARY)) or 0
        )
        parts_preliminary = (
            db.scalar(select(func.count(RepairPart.id)).where(RepairPart.status == CatalogStatus.PRELIMINARY)) or 0
        )
        import_conflicts_pending = (
            db.scalar(
                select(func.count(ImportConflict.id)).where(
                    ImportConflict.status == "pending",
                )
            )
            or 0
        )
        repairs_suspicious = (
            db.scalar(select(func.count(Repair.id)).where(Repair.status == RepairStatus.SUSPICIOUS)) or 0
        )
    else:
        visible_ids = get_allowed_vehicle_ids_query(current_user)
        average_ocr_confidence = db.scalar(
            select(func.avg(Document.ocr_confidence)).join(Document.repair).where(Repair.vehicle_id.in_(visible_ids))
        )
        documents_low_confidence = (
            db.scalar(
                select(func.count(Document.id))
                .join(Document.repair)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    Document.ocr_confidence.is_not(None),
                    Document.ocr_confidence < 0.9,
                )
            )
            or 0
        )
        documents_ocr_error = (
            db.scalar(
                select(func.count(Document.id))
                .join(Document.repair)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    Document.status == DocumentStatus.OCR_ERROR,
                )
            )
            or 0
        )
        documents_needs_review = (
            db.scalar(
                select(func.count(Document.id))
                .join(Document.repair)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    Document.status.in_(ACTIVE_REVIEW_DOCUMENT_STATUSES),
                )
            )
            or 0
        )
        services_preliminary = (
            db.scalar(
                select(func.count(distinct(Service.id)))
                .join(Repair, Repair.service_id == Service.id)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    Service.status == ServiceStatus.PRELIMINARY,
                )
            )
            or 0
        )
        works_preliminary = (
            db.scalar(
                select(func.count(RepairWork.id))
                .join(RepairWork.repair)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    RepairWork.status == CatalogStatus.PRELIMINARY,
                )
            )
            or 0
        )
        parts_preliminary = (
            db.scalar(
                select(func.count(RepairPart.id))
                .join(RepairPart.repair)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    RepairPart.status == CatalogStatus.PRELIMINARY,
                )
            )
            or 0
        )
        import_conflicts_pending = (
            db.scalar(
                select(func.count(ImportConflict.id))
                .join(ImportJob, ImportJob.id == ImportConflict.import_job_id)
                .join(Document, Document.id == ImportJob.document_id)
                .join(Repair, Repair.id == Document.repair_id)
                .where(
                    Repair.vehicle_id.in_(visible_ids),
                    ImportConflict.status == "pending",
                )
            )
            or 0
        )
        repairs_suspicious = (
            db.scalar(
                select(func.count(Repair.id)).where(
                    Repair.vehicle_id.in_(visible_ids),
                    Repair.status == RepairStatus.SUSPICIOUS,
                )
            )
            or 0
        )

    return DashboardDataQualityResponse(
        average_ocr_confidence=float(average_ocr_confidence) if average_ocr_confidence is not None else None,
        documents_low_confidence=documents_low_confidence,
        documents_ocr_error=documents_ocr_error,
        documents_needs_review=documents_needs_review,
        services_preliminary=services_preliminary,
        works_preliminary=works_preliminary,
        parts_preliminary=parts_preliminary,
        import_conflicts_pending=import_conflicts_pending,
        repairs_suspicious=repairs_suspicious,
    )


@router.get("/data-quality/details", response_model=DashboardDataQualityDetailsResponse)
def get_dashboard_data_quality_details(
    limit: int = 8,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardDataQualityDetailsResponse:
    safe_limit = min(max(limit, 1), 25)
    visible_ids = get_allowed_vehicle_ids_query(current_user) if current_user.role != UserRole.ADMIN else None
    document_condition = or_(
        Document.status.in_(REVIEW_QUEUE_DOCUMENT_STATUSES),
        Document.ocr_confidence.is_(None),
        Document.ocr_confidence < 0.9,
    )

    document_count_stmt = select(func.count(Document.id)).select_from(Document).where(document_condition)
    if visible_ids is not None:
        document_count_stmt = document_count_stmt.join(Repair, Repair.id == Document.repair_id).where(
            Repair.vehicle_id.in_(visible_ids)
        )
    documents_total = db.scalar(document_count_stmt) or 0

    document_stmt = (
        select(
            Document.id.label("document_id"),
            Repair.id.label("repair_id"),
            Document.original_filename.label("original_filename"),
            Document.status.label("document_status"),
            Repair.status.label("repair_status"),
            Repair.repair_date.label("repair_date"),
            Document.ocr_confidence.label("ocr_confidence"),
            Vehicle.plate_number.label("plate_number"),
            Vehicle.brand.label("brand"),
            Vehicle.model.label("model"),
        )
        .join(Repair, Repair.id == Document.repair_id, isouter=True)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id, isouter=True)
        .where(document_condition)
        .order_by(Document.review_queue_priority.desc(), Document.updated_at.desc(), Document.id.desc())
        .limit(safe_limit)
    )
    if visible_ids is not None:
        document_stmt = document_stmt.where(Repair.vehicle_id.in_(visible_ids))
    document_items = [
        DashboardQualityDocumentItem(
            document_id=row.document_id,
            repair_id=row.repair_id,
            original_filename=row.original_filename,
            document_status=row.document_status.value if row.document_status is not None else "",
            repair_status=row.repair_status.value if row.repair_status is not None else None,
            repair_date=row.repair_date.isoformat() if row.repair_date is not None else None,
            ocr_confidence=float(row.ocr_confidence) if row.ocr_confidence is not None else None,
            plate_number=row.plate_number,
            brand=row.brand,
            model=row.model,
        )
        for row in db.execute(document_stmt).all()
    ]

    service_count_stmt = select(func.count(distinct(Service.id))).select_from(Service).where(
        Service.status == ServiceStatus.PRELIMINARY
    )
    if visible_ids is not None:
        service_count_stmt = service_count_stmt.join(Repair, Repair.service_id == Service.id).where(
            Repair.vehicle_id.in_(visible_ids)
        )
    services_total = db.scalar(service_count_stmt) or 0

    service_stmt = (
        select(
            Service.id.label("service_id"),
            Service.name.label("name"),
            Service.city.label("city"),
            func.count(distinct(Repair.id)).label("repairs_total"),
            func.max(Repair.repair_date).label("last_repair_date"),
        )
        .outerjoin(Repair, Repair.service_id == Service.id)
        .where(Service.status == ServiceStatus.PRELIMINARY)
        .group_by(Service.id, Service.name, Service.city)
        .order_by(func.count(distinct(Repair.id)).desc(), func.max(Repair.repair_date).desc(), Service.name.asc())
        .limit(safe_limit)
    )
    if visible_ids is not None:
        service_stmt = service_stmt.where(Repair.vehicle_id.in_(visible_ids))
    service_items = [
        DashboardQualityServiceItem(
            service_id=row.service_id,
            name=row.name,
            city=row.city,
            repairs_total=int(row.repairs_total or 0),
            last_repair_date=row.last_repair_date.isoformat() if row.last_repair_date is not None else None,
        )
        for row in db.execute(service_stmt).all()
    ]

    work_count_stmt = (
        select(func.count(RepairWork.id))
        .select_from(RepairWork)
        .join(Repair, Repair.id == RepairWork.repair_id)
        .where(RepairWork.status == CatalogStatus.PRELIMINARY)
    )
    if visible_ids is not None:
        work_count_stmt = work_count_stmt.where(Repair.vehicle_id.in_(visible_ids))
    works_total = db.scalar(work_count_stmt) or 0

    work_stmt = (
        select(
            RepairWork.id.label("work_id"),
            Repair.id.label("repair_id"),
            Repair.source_document_id.label("document_id"),
            RepairWork.work_name.label("work_name"),
            RepairWork.line_total.label("line_total"),
            Repair.repair_date.label("repair_date"),
            Vehicle.plate_number.label("plate_number"),
            Vehicle.brand.label("brand"),
            Vehicle.model.label("model"),
        )
        .join(Repair, Repair.id == RepairWork.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .where(RepairWork.status == CatalogStatus.PRELIMINARY)
        .order_by(RepairWork.id.desc())
        .limit(safe_limit)
    )
    if visible_ids is not None:
        work_stmt = work_stmt.where(Repair.vehicle_id.in_(visible_ids))
    work_items = [
        DashboardQualityWorkItem(
            work_id=row.work_id,
            repair_id=row.repair_id,
            document_id=row.document_id,
            work_name=row.work_name,
            line_total=float(row.line_total or 0),
            repair_date=row.repair_date.isoformat(),
            plate_number=row.plate_number,
            brand=row.brand,
            model=row.model,
        )
        for row in db.execute(work_stmt).all()
    ]

    part_count_stmt = (
        select(func.count(RepairPart.id))
        .select_from(RepairPart)
        .join(Repair, Repair.id == RepairPart.repair_id)
        .where(RepairPart.status == CatalogStatus.PRELIMINARY)
    )
    if visible_ids is not None:
        part_count_stmt = part_count_stmt.where(Repair.vehicle_id.in_(visible_ids))
    parts_total = db.scalar(part_count_stmt) or 0

    part_stmt = (
        select(
            RepairPart.id.label("part_id"),
            Repair.id.label("repair_id"),
            Repair.source_document_id.label("document_id"),
            RepairPart.part_name.label("part_name"),
            RepairPart.line_total.label("line_total"),
            Repair.repair_date.label("repair_date"),
            Vehicle.plate_number.label("plate_number"),
            Vehicle.brand.label("brand"),
            Vehicle.model.label("model"),
        )
        .join(Repair, Repair.id == RepairPart.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .where(RepairPart.status == CatalogStatus.PRELIMINARY)
        .order_by(RepairPart.id.desc())
        .limit(safe_limit)
    )
    if visible_ids is not None:
        part_stmt = part_stmt.where(Repair.vehicle_id.in_(visible_ids))
    part_items = [
        DashboardQualityPartItem(
            part_id=row.part_id,
            repair_id=row.repair_id,
            document_id=row.document_id,
            part_name=row.part_name,
            line_total=float(row.line_total or 0),
            repair_date=row.repair_date.isoformat(),
            plate_number=row.plate_number,
            brand=row.brand,
            model=row.model,
        )
        for row in db.execute(part_stmt).all()
    ]

    conflict_count_stmt = select(func.count(ImportConflict.id)).select_from(ImportConflict).where(
        ImportConflict.status == "pending"
    )
    if visible_ids is not None:
        conflict_count_stmt = (
            conflict_count_stmt.join(ImportJob, ImportJob.id == ImportConflict.import_job_id)
            .join(Document, Document.id == ImportJob.document_id)
            .join(Repair, Repair.id == Document.repair_id)
            .where(Repair.vehicle_id.in_(visible_ids))
        )
    conflicts_total = db.scalar(conflict_count_stmt) or 0

    conflict_stmt = (
        select(
            ImportConflict.id.label("conflict_id"),
            ImportConflict.import_job_id.label("import_job_id"),
            ImportConflict.entity_type.label("entity_type"),
            ImportConflict.conflict_key.label("conflict_key"),
            ImportJob.source_filename.label("source_filename"),
            Repair.id.label("repair_id"),
            Document.id.label("document_id"),
            Vehicle.plate_number.label("plate_number"),
            Vehicle.brand.label("brand"),
            Vehicle.model.label("model"),
            ImportConflict.created_at.label("created_at"),
        )
        .join(ImportJob, ImportJob.id == ImportConflict.import_job_id, isouter=True)
        .join(Document, Document.id == ImportJob.document_id, isouter=True)
        .join(Repair, Repair.id == Document.repair_id, isouter=True)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id, isouter=True)
        .where(ImportConflict.status == "pending")
        .order_by(ImportConflict.created_at.desc(), ImportConflict.id.desc())
        .limit(safe_limit)
    )
    if visible_ids is not None:
        conflict_stmt = conflict_stmt.where(Repair.vehicle_id.in_(visible_ids))
    conflict_items = [
        DashboardQualityConflictItem(
            conflict_id=row.conflict_id,
            import_job_id=row.import_job_id,
            entity_type=row.entity_type,
            conflict_key=row.conflict_key,
            source_filename=row.source_filename,
            repair_id=row.repair_id,
            document_id=row.document_id,
            plate_number=row.plate_number,
            brand=row.brand,
            model=row.model,
            created_at=row.created_at.isoformat(),
        )
        for row in db.execute(conflict_stmt).all()
    ]

    return DashboardDataQualityDetailsResponse(
        counts=DashboardDataQualityDetailsCounts(
            documents=documents_total,
            services=services_total,
            works=works_total,
            parts=parts_total,
            conflicts=conflicts_total,
        ),
        documents=document_items,
        services=service_items,
        works=work_items,
        parts=part_items,
        conflicts=conflict_items,
    )
