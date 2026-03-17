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


class DashboardQualityDocumentItem(BaseModel):
    document_id: int
    repair_id: int | None
    original_filename: str
    document_status: str
    repair_status: str | None
    repair_date: str | None
    ocr_confidence: float | None
    plate_number: str | None
    brand: str | None
    model: str | None


class DashboardQualityServiceItem(BaseModel):
    service_id: int
    name: str
    city: str | None
    repairs_total: int
    last_repair_date: str | None


class DashboardQualityWorkItem(BaseModel):
    work_id: int
    repair_id: int
    document_id: int | None
    work_name: str
    line_total: float
    repair_date: str
    plate_number: str | None
    brand: str | None
    model: str | None


class DashboardQualityPartItem(BaseModel):
    part_id: int
    repair_id: int
    document_id: int | None
    part_name: str
    line_total: float
    repair_date: str
    plate_number: str | None
    brand: str | None
    model: str | None


class DashboardQualityConflictItem(BaseModel):
    conflict_id: int
    import_job_id: int
    entity_type: str
    conflict_key: str
    source_filename: str | None
    repair_id: int | None
    document_id: int | None
    plate_number: str | None
    brand: str | None
    model: str | None
    created_at: str


class DashboardDataQualityDetailsCounts(BaseModel):
    documents: int
    services: int
    works: int
    parts: int
    conflicts: int


class DashboardDataQualityDetailsResponse(BaseModel):
    counts: DashboardDataQualityDetailsCounts
    documents: list[DashboardQualityDocumentItem]
    services: list[DashboardQualityServiceItem]
    works: list[DashboardQualityWorkItem]
    parts: list[DashboardQualityPartItem]
    conflicts: list[DashboardQualityConflictItem]
