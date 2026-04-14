from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.application.dashboard.queries import (
    build_dashboard_data_quality_details_response,
    build_dashboard_data_quality_response,
    build_dashboard_summary_response,
)
from app.models.user import User
from app.schemas.dashboard import (
    DashboardDataQualityDetailsResponse,
    DashboardDataQualityResponse,
    DashboardSummaryResponse,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardSummaryResponse:
    return build_dashboard_summary_response(
        db,
        current_user=current_user,
    )


@router.get("/data-quality", response_model=DashboardDataQualityResponse)
def get_dashboard_data_quality(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardDataQualityResponse:
    return build_dashboard_data_quality_response(
        db,
        current_user=current_user,
    )


@router.get("/data-quality/details", response_model=DashboardDataQualityDetailsResponse)
def get_dashboard_data_quality_details(
    limit: int | None = Query(default=None, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DashboardDataQualityDetailsResponse:
    return build_dashboard_data_quality_details_response(
        db,
        current_user=current_user,
        limit=limit,
    )
