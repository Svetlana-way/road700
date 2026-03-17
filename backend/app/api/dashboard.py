from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
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
from app.schemas.dashboard import DashboardDataQualityResponse, DashboardSummaryResponse


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


REVIEW_QUEUE_DOCUMENT_STATUSES = [
    DocumentStatus.UPLOADED,
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.OCR_ERROR,
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
                        [
                            DocumentStatus.UPLOADED,
                            DocumentStatus.PARTIALLY_RECOGNIZED,
                            DocumentStatus.NEEDS_REVIEW,
                        ]
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
                    Document.status.in_(
                        [
                            DocumentStatus.UPLOADED,
                            DocumentStatus.PARTIALLY_RECOGNIZED,
                            DocumentStatus.NEEDS_REVIEW,
                        ]
                    ),
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
