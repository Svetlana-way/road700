from __future__ import annotations

from sqlalchemy import and_, case, distinct, exists, func, or_, select
from sqlalchemy.orm import Session

from app.application.services.visibility import get_visible_services_stmt
from app.application.services.visibility import (
    get_allowed_vehicle_ids_query,
    get_non_placeholder_vehicle_clause,
    get_repair_visibility_clause,
)
from app.models.document import Document
from app.models.enums import CatalogStatus, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus
from app.models.imports import ImportConflict, ImportJob
from app.models.repair import Repair, RepairPart, RepairWork
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.application.documents.repair_relations import build_canonical_source_document_id_expr
from app.application.review.queue_support import (
    REVIEWABLE_DOCUMENT_KINDS,
    build_reviewable_documents_filter,
    build_suspicious_checks_exist_expr,
)
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


def count_matching_rows(condition):
    return func.coalesce(func.sum(case((condition, 1), else_=0)), 0)


def build_operational_repair_clause():
    return and_(
        Repair.status != RepairStatus.ARCHIVED,
        Vehicle.status != VehicleStatus.ARCHIVED,
        or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
    )


def build_operational_document_clause():
    return and_(
        Document.status != DocumentStatus.ARCHIVED,
        build_operational_repair_clause(),
    )


def build_ocr_error_repair_condition():
    ocr_error_documents_exist = exists(
        select(1).where(
            Document.repair_id == Repair.id,
            Document.status != DocumentStatus.ARCHIVED,
            Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
            Document.status == DocumentStatus.OCR_ERROR,
        )
    )
    return or_(
        Repair.status == RepairStatus.OCR_ERROR,
        ocr_error_documents_exist,
    )


def build_suspicious_repair_condition():
    return and_(
        ~build_ocr_error_repair_condition(),
        or_(
            Repair.status == RepairStatus.SUSPICIOUS,
            build_suspicious_checks_exist_expr(),
        ),
    )


def build_dashboard_summary_response(
    db: Session,
    *,
    current_user: User,
) -> DashboardSummaryResponse:
    review_queue_filter = build_reviewable_documents_filter()
    suspicious_repair_condition = build_suspicious_repair_condition()
    repair_summary_stmt = select(
        func.count(Repair.id).label("repairs_total"),
        count_matching_rows(Repair.status == RepairStatus.DRAFT).label("repairs_draft"),
        count_matching_rows(suspicious_repair_condition).label("repairs_suspicious"),
    ).select_from(Repair).join(Vehicle, Vehicle.id == Repair.vehicle_id).outerjoin(Service, Service.id == Repair.service_id).where(
        build_operational_repair_clause()
    )
    document_summary_stmt = select(
        func.count(Document.id).label("documents_total"),
        count_matching_rows(
            and_(
                Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
                review_queue_filter,
                Document.status != DocumentStatus.UPLOADED,
            )
        ).label("documents_review_queue"),
    ).select_from(Document).join(Repair, Repair.id == Document.repair_id).join(
        Vehicle, Vehicle.id == Repair.vehicle_id
    ).outerjoin(Service, Service.id == Repair.service_id).where(build_operational_document_clause())

    if current_user.role == UserRole.ADMIN:
        vehicle_count = (
            db.scalar(select(func.count(Vehicle.id)).where(Vehicle.status != VehicleStatus.ARCHIVED, get_non_placeholder_vehicle_clause()))
            or 0
        )
    else:
        visible_ids = get_allowed_vehicle_ids_query(current_user)
        repair_visibility_clause = get_repair_visibility_clause(current_user)
        vehicle_count = (
            db.scalar(
                select(func.count(Vehicle.id)).where(
                    Vehicle.id.in_(visible_ids),
                    Vehicle.status != VehicleStatus.ARCHIVED,
                    get_non_placeholder_vehicle_clause(),
                )
            )
            or 0
        )
        repair_summary_stmt = repair_summary_stmt.where(repair_visibility_clause)
        document_summary_stmt = document_summary_stmt.where(repair_visibility_clause)

    repair_summary = db.execute(repair_summary_stmt).one()
    document_summary = db.execute(document_summary_stmt).one()

    return DashboardSummaryResponse(
        vehicles_total=vehicle_count,
        repairs_total=int(repair_summary.repairs_total or 0),
        repairs_draft=int(repair_summary.repairs_draft or 0),
        repairs_suspicious=int(repair_summary.repairs_suspicious or 0),
        documents_total=int(document_summary.documents_total or 0),
        documents_review_queue=int(document_summary.documents_review_queue or 0),
    )


def build_dashboard_data_quality_response(
    db: Session,
    *,
    current_user: User,
) -> DashboardDataQualityResponse:
    visible_services = get_visible_services_stmt()
    review_queue_filter = build_reviewable_documents_filter()
    suspicious_repair_condition = build_suspicious_repair_condition()
    documents_ocr_error_condition = and_(
        Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
        or_(
            Document.status == DocumentStatus.OCR_ERROR,
            Repair.status == RepairStatus.OCR_ERROR,
        ),
        Document.status != DocumentStatus.UPLOADED,
    )
    documents_needs_review_condition = and_(
        Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
        review_queue_filter,
        Document.status != DocumentStatus.UPLOADED,
        Document.status != DocumentStatus.OCR_ERROR,
        Repair.status != RepairStatus.OCR_ERROR,
    )
    document_quality_stmt = select(
        func.avg(Document.ocr_confidence).label("average_ocr_confidence"),
        count_matching_rows(
            and_(
                Document.ocr_confidence.is_not(None),
                Document.ocr_confidence < 0.9,
            )
        ).label("documents_low_confidence"),
        count_matching_rows(documents_ocr_error_condition).label("documents_ocr_error"),
        count_matching_rows(documents_needs_review_condition).label("documents_needs_review"),
    ).select_from(Document).join(Repair, Repair.id == Document.repair_id).join(
        Vehicle, Vehicle.id == Repair.vehicle_id
    ).outerjoin(Service, Service.id == Repair.service_id).where(build_operational_document_clause())

    if current_user.role == UserRole.ADMIN:
        services_preliminary = (
            db.scalar(
                select(func.count(distinct(Service.id)))
                .join(Repair, Repair.service_id == Service.id)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .where(
                    visible_services,
                    build_operational_repair_clause(),
                    Service.status == ServiceStatus.PRELIMINARY,
                )
            )
            or 0
        )
        works_preliminary = (
            db.scalar(
                select(func.count(RepairWork.id))
                .join(Repair, Repair.id == RepairWork.repair_id)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(
                    RepairWork.status == CatalogStatus.PRELIMINARY,
                    build_operational_repair_clause(),
                )
            )
            or 0
        )
        parts_preliminary = (
            db.scalar(
                select(func.count(RepairPart.id))
                .join(Repair, Repair.id == RepairPart.repair_id)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(
                    RepairPart.status == CatalogStatus.PRELIMINARY,
                    build_operational_repair_clause(),
                )
            )
            or 0
        )
        import_conflicts_pending = (
            db.scalar(
                select(func.count(ImportConflict.id))
                .select_from(ImportConflict)
                .join(ImportJob, ImportJob.id == ImportConflict.import_job_id, isouter=True)
                .join(Document, Document.id == ImportJob.document_id, isouter=True)
                .join(Repair, Repair.id == Document.repair_id, isouter=True)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id, isouter=True)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(
                    ImportConflict.status == "pending",
                    or_(ImportJob.document_id.is_(None), build_operational_document_clause()),
                )
            )
            or 0
        )
        repairs_suspicious = (
            db.scalar(
                select(func.count(Repair.id))
                .select_from(Repair)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(build_operational_repair_clause(), suspicious_repair_condition)
            )
            or 0
        )
    else:
        repair_visibility_clause = get_repair_visibility_clause(current_user)
        document_quality_stmt = document_quality_stmt.where(repair_visibility_clause)
        services_preliminary = (
            db.scalar(
                select(func.count(distinct(Service.id)))
                .join(Repair, Repair.service_id == Service.id)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .where(
                    visible_services,
                    repair_visibility_clause,
                    build_operational_repair_clause(),
                    Service.status == ServiceStatus.PRELIMINARY,
                )
            )
            or 0
        )
        works_preliminary = (
            db.scalar(
                select(func.count(RepairWork.id))
                .join(RepairWork.repair)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(
                    repair_visibility_clause,
                    build_operational_repair_clause(),
                    RepairWork.status == CatalogStatus.PRELIMINARY,
                )
            )
            or 0
        )
        parts_preliminary = (
            db.scalar(
                select(func.count(RepairPart.id))
                .join(RepairPart.repair)
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(
                    repair_visibility_clause,
                    build_operational_repair_clause(),
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
                .join(Vehicle, Vehicle.id == Repair.vehicle_id)
                .outerjoin(Service, Service.id == Repair.service_id)
                .where(
                    repair_visibility_clause,
                    build_operational_document_clause(),
                    ImportConflict.status == "pending",
                )
            )
            or 0
        )
        repairs_suspicious = (
            db.scalar(
                select(func.count(Repair.id)).where(
                    repair_visibility_clause,
                    Repair.vehicle.has(Vehicle.status != VehicleStatus.ARCHIVED),
                    or_(Repair.service_id.is_(None), Repair.service.has(Service.status != ServiceStatus.ARCHIVED)),
                    suspicious_repair_condition,
                )
            )
            or 0
        )

    document_quality = db.execute(document_quality_stmt).one()

    return DashboardDataQualityResponse(
        average_ocr_confidence=(
            float(document_quality.average_ocr_confidence)
            if document_quality.average_ocr_confidence is not None
            else None
        ),
        documents_low_confidence=int(document_quality.documents_low_confidence or 0),
        documents_ocr_error=int(document_quality.documents_ocr_error or 0),
        documents_needs_review=int(document_quality.documents_needs_review or 0),
        services_preliminary=services_preliminary,
        works_preliminary=works_preliminary,
        parts_preliminary=parts_preliminary,
        import_conflicts_pending=import_conflicts_pending,
        repairs_suspicious=repairs_suspicious,
    )


def build_dashboard_data_quality_details_response(
    db: Session,
    *,
    current_user: User,
    limit: int | None = None,
) -> DashboardDataQualityDetailsResponse:
    repair_visibility_clause = get_repair_visibility_clause(current_user) if current_user.role != UserRole.ADMIN else None
    visible_services = get_visible_services_stmt()
    canonical_source_document_id = build_canonical_source_document_id_expr()
    review_queue_filter = build_reviewable_documents_filter()
    operational_service_repair_id = case((build_operational_repair_clause(), Repair.id), else_=None)
    operational_service_repair_date = case((build_operational_repair_clause(), Repair.repair_date), else_=None)
    document_condition = or_(
        and_(
            Document.kind.in_(REVIEWABLE_DOCUMENT_KINDS),
            review_queue_filter,
            Document.status != DocumentStatus.UPLOADED,
        ),
        and_(
            Document.ocr_confidence.is_not(None),
            Document.ocr_confidence < 0.9,
        ),
    )

    document_count_stmt = select(func.count(Document.id)).select_from(Document).where(document_condition)
    document_count_stmt = (
        document_count_stmt.join(Repair, Repair.id == Document.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(build_operational_document_clause())
    )
    if repair_visibility_clause is not None:
        document_count_stmt = document_count_stmt.where(repair_visibility_clause)
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
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(document_condition, build_operational_document_clause())
        .order_by(Document.review_queue_priority.desc(), Document.updated_at.desc(), Document.id.desc())
    )
    if repair_visibility_clause is not None:
        document_stmt = document_stmt.where(repair_visibility_clause)
    if limit is not None:
        document_stmt = document_stmt.limit(limit)
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

    service_count_stmt = (
        select(func.count(distinct(Service.id)))
        .select_from(Service)
        .join(Repair, Repair.service_id == Service.id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .where(
            visible_services,
            build_operational_repair_clause(),
            Service.status == ServiceStatus.PRELIMINARY,
        )
    )
    if repair_visibility_clause is not None:
        service_count_stmt = service_count_stmt.where(repair_visibility_clause)
    services_total = db.scalar(service_count_stmt) or 0

    service_stmt = (
        select(
            Service.id.label("service_id"),
            Service.name.label("name"),
            Service.city.label("city"),
            func.count(distinct(operational_service_repair_id)).label("repairs_total"),
            func.max(operational_service_repair_date).label("last_repair_date"),
        )
        .outerjoin(Repair, Repair.service_id == Service.id)
        .outerjoin(Vehicle, Vehicle.id == Repair.vehicle_id)
        .where(
            visible_services,
            build_operational_repair_clause(),
            Service.status == ServiceStatus.PRELIMINARY,
        )
        .group_by(Service.id, Service.name, Service.city)
        .order_by(
            func.count(distinct(operational_service_repair_id)).desc(),
            func.max(operational_service_repair_date).desc(),
            Service.name.asc(),
        )
    )
    if repair_visibility_clause is not None:
        service_stmt = service_stmt.where(repair_visibility_clause)
    if limit is not None:
        service_stmt = service_stmt.limit(limit)
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
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(RepairWork.status == CatalogStatus.PRELIMINARY, build_operational_repair_clause())
    )
    if repair_visibility_clause is not None:
        work_count_stmt = work_count_stmt.where(repair_visibility_clause)
    works_total = db.scalar(work_count_stmt) or 0

    work_stmt = (
        select(
            RepairWork.id.label("work_id"),
            Repair.id.label("repair_id"),
            canonical_source_document_id.label("document_id"),
            RepairWork.work_name.label("work_name"),
            RepairWork.line_total.label("line_total"),
            Repair.repair_date.label("repair_date"),
            Vehicle.plate_number.label("plate_number"),
            Vehicle.brand.label("brand"),
            Vehicle.model.label("model"),
        )
        .join(Repair, Repair.id == RepairWork.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(RepairWork.status == CatalogStatus.PRELIMINARY, build_operational_repair_clause())
        .order_by(RepairWork.id.desc())
    )
    if repair_visibility_clause is not None:
        work_stmt = work_stmt.where(repair_visibility_clause)
    if limit is not None:
        work_stmt = work_stmt.limit(limit)
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
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(RepairPart.status == CatalogStatus.PRELIMINARY, build_operational_repair_clause())
    )
    if repair_visibility_clause is not None:
        part_count_stmt = part_count_stmt.where(repair_visibility_clause)
    parts_total = db.scalar(part_count_stmt) or 0

    part_stmt = (
        select(
            RepairPart.id.label("part_id"),
            Repair.id.label("repair_id"),
            canonical_source_document_id.label("document_id"),
            RepairPart.part_name.label("part_name"),
            RepairPart.line_total.label("line_total"),
            Repair.repair_date.label("repair_date"),
            Vehicle.plate_number.label("plate_number"),
            Vehicle.brand.label("brand"),
            Vehicle.model.label("model"),
        )
        .join(Repair, Repair.id == RepairPart.repair_id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(RepairPart.status == CatalogStatus.PRELIMINARY, build_operational_repair_clause())
        .order_by(RepairPart.id.desc())
    )
    if repair_visibility_clause is not None:
        part_stmt = part_stmt.where(repair_visibility_clause)
    if limit is not None:
        part_stmt = part_stmt.limit(limit)
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

    conflict_count_stmt = (
        select(func.count(ImportConflict.id))
        .select_from(ImportConflict)
        .join(ImportJob, ImportJob.id == ImportConflict.import_job_id, isouter=True)
        .join(Document, Document.id == ImportJob.document_id, isouter=True)
        .join(Repair, Repair.id == Document.repair_id, isouter=True)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id, isouter=True)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(
            ImportConflict.status == "pending",
        )
    )
    if repair_visibility_clause is not None:
        conflict_count_stmt = conflict_count_stmt.where(repair_visibility_clause)
    conflict_count_stmt = conflict_count_stmt.where(
        or_(ImportJob.document_id.is_(None), build_operational_document_clause())
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
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(
            ImportConflict.status == "pending",
            or_(ImportJob.document_id.is_(None), build_operational_document_clause()),
        )
        .order_by(ImportConflict.created_at.desc(), ImportConflict.id.desc())
    )
    if repair_visibility_clause is not None:
        conflict_stmt = conflict_stmt.where(repair_visibility_clause)
    if limit is not None:
        conflict_stmt = conflict_stmt.limit(limit)
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
