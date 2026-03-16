from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    vehicles_total: int
    repairs_total: int
    repairs_draft: int
    repairs_suspicious: int
    documents_total: int
    documents_review_queue: int
