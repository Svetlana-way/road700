from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    vehicles_total: int
    repairs_total: int
    repairs_draft: int
    repairs_suspicious: int
    documents_total: int
    documents_review_queue: int


class DashboardDataQualityResponse(BaseModel):
    average_ocr_confidence: float | None
    documents_low_confidence: int
    documents_ocr_error: int
    documents_needs_review: int
    services_preliminary: int
    works_preliminary: int
    parts_preliminary: int
    import_conflicts_pending: int
    repairs_suspicious: int
