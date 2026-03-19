from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import CatalogStatus, CheckSeverity, DocumentKind, RepairStatus
from app.schemas.document import DocumentImportJobRead


class RepairWorkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    work_code: Optional[str]
    work_name: str
    quantity: float
    standard_hours: Optional[float]
    actual_hours: Optional[float]
    price: float
    line_total: float
    status: CatalogStatus
    reference_payload: Optional[dict]


class RepairPartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    article: Optional[str]
    part_name: str
    quantity: float
    unit_name: Optional[str]
    price: float
    line_total: float
    status: CatalogStatus


class RepairCheckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    check_type: str
    severity: CheckSeverity
    title: str
    details: Optional[str]
    calculation_payload: Optional[dict]
    is_resolved: bool
    created_at: datetime


class RepairVehicleRead(BaseModel):
    id: int
    external_id: Optional[str]
    plate_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]


class RepairServiceRead(BaseModel):
    id: int
    name: str
    city: Optional[str]


class RepairHistoryEntryRead(BaseModel):
    id: int
    action_type: str
    created_at: datetime
    user_name: Optional[str]
    old_value: Optional[dict]
    new_value: Optional[dict]


class RepairDocumentHistoryEntryRead(BaseModel):
    id: int
    action_type: str
    created_at: datetime
    user_name: Optional[str]
    document_id: Optional[int]
    document_filename: Optional[str]
    document_kind: Optional[DocumentKind]
    old_value: Optional[dict]
    new_value: Optional[dict]


class RepairDocumentVersionRead(BaseModel):
    id: int
    version_number: int
    created_at: datetime
    change_summary: Optional[str]
    parsed_payload: Optional[dict]
    field_confidence_map: Optional[dict]


class RepairDocumentRead(BaseModel):
    id: int
    original_filename: str
    source_type: str
    kind: DocumentKind
    mime_type: Optional[str]
    status: str
    is_primary: bool
    ocr_confidence: Optional[float]
    review_queue_priority: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    latest_import_job: DocumentImportJobRead | None = None
    versions: list[RepairDocumentVersionRead]


class RepairExecutiveReportFindingRead(BaseModel):
    title: str
    severity: str
    category: str
    summary: str
    rationale: Optional[str]
    evidence: list[str]
    recommendation: Optional[str]


class RepairExecutiveReportRiskRead(BaseModel):
    zone: str
    level: str
    comment: str


class RepairExecutiveReportRead(BaseModel):
    headline: str
    summary: str
    status: str
    overall_risk: str
    highlights: list[str]
    findings: list[RepairExecutiveReportFindingRead]
    risk_matrix: list[RepairExecutiveReportRiskRead]
    recommendations: list[str]


class RepairDetailResponse(BaseModel):
    id: int
    order_number: Optional[str]
    repair_date: date
    mileage: int
    reason: Optional[str]
    employee_comment: Optional[str]
    work_total: float
    parts_total: float
    vat_total: float
    grand_total: float
    expected_total: Optional[float]
    status: RepairStatus
    is_preliminary: bool
    is_partially_recognized: bool
    is_manually_completed: bool
    created_at: datetime
    updated_at: datetime
    vehicle: RepairVehicleRead
    service: Optional[RepairServiceRead]
    works: list[RepairWorkRead]
    parts: list[RepairPartRead]
    checks: list[RepairCheckRead]
    documents: list[RepairDocumentRead]
    document_history: list[RepairDocumentHistoryEntryRead]
    history: list[RepairHistoryEntryRead]
    executive_report: RepairExecutiveReportRead


class RepairWorkUpdateInput(BaseModel):
    work_code: Optional[str] = None
    work_name: str
    quantity: float = 1
    standard_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    price: float = 0
    line_total: float = 0
    status: CatalogStatus = CatalogStatus.PRELIMINARY
    reference_payload: Optional[dict] = None


class RepairPartUpdateInput(BaseModel):
    article: Optional[str] = None
    part_name: str
    quantity: float = 1
    unit_name: Optional[str] = None
    price: float = 0
    line_total: float = 0
    status: CatalogStatus = CatalogStatus.PRELIMINARY


class RepairUpdateRequest(BaseModel):
    order_number: Optional[str] = None
    repair_date: Optional[date] = None
    mileage: Optional[int] = None
    reason: Optional[str] = None
    employee_comment: Optional[str] = None
    service_name: Optional[str] = None
    work_total: Optional[float] = None
    parts_total: Optional[float] = None
    vat_total: Optional[float] = None
    grand_total: Optional[float] = None
    status: Optional[RepairStatus] = None
    is_preliminary: Optional[bool] = None
    works: Optional[list[RepairWorkUpdateInput]] = None
    parts: Optional[list[RepairPartUpdateInput]] = None


class RepairServiceUpdateRequest(BaseModel):
    service_name: Optional[str] = None


class RepairReviewFieldsUpdateRequest(BaseModel):
    order_number: Optional[str] = None
    repair_date: Optional[date] = None
    mileage: Optional[int] = None
    reason: Optional[str] = None
    employee_comment: Optional[str] = None
    work_total: Optional[float] = None
    parts_total: Optional[float] = None
    vat_total: Optional[float] = None
    grand_total: Optional[float] = None


class RepairCheckUpdateRequest(BaseModel):
    is_resolved: bool
    comment: Optional[str] = None


class RepairDeleteResponse(BaseModel):
    message: str
    deleted_repair_id: int
