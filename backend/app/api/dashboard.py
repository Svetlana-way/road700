from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.access import get_allowed_vehicle_ids_query
from app.api.deps import get_current_active_user, get_db
from app.models.document import Document
from app.models.enums import DocumentStatus, RepairStatus, UserRole
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.dashboard import DashboardSummaryResponse


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
                    Document.status.in_(
                        [
                            DocumentStatus.UPLOADED,
                            DocumentStatus.PARTIALLY_RECOGNIZED,
                            DocumentStatus.NEEDS_REVIEW,
                            DocumentStatus.OCR_ERROR,
                        ]
                    )
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
                    Document.status.in_(
                        [
                            DocumentStatus.UPLOADED,
                            DocumentStatus.PARTIALLY_RECOGNIZED,
                            DocumentStatus.NEEDS_REVIEW,
                            DocumentStatus.OCR_ERROR,
                        ]
                    ),
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
