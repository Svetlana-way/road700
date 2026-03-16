import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class VehicleType(str, enum.Enum):
    TRUCK = "truck"
    TRAILER = "trailer"


class VehicleStatus(str, enum.Enum):
    ACTIVE = "active"
    IN_REPAIR = "in_repair"
    WAITING_REPAIR = "waiting_repair"
    INACTIVE = "inactive"
    DECOMMISSIONED = "decommissioned"
    ARCHIVED = "archived"


class RepairStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    EMPLOYEE_CONFIRMED = "employee_confirmed"
    SUSPICIOUS = "suspicious"
    CONFIRMED = "confirmed"
    OCR_ERROR = "ocr_error"
    ARCHIVED = "archived"


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    RECOGNIZED = "recognized"
    PARTIALLY_RECOGNIZED = "partially_recognized"
    NEEDS_REVIEW = "needs_review"
    CONFIRMED = "confirmed"
    OCR_ERROR = "ocr_error"
    ARCHIVED = "archived"


class DocumentKind(str, enum.Enum):
    ORDER = "order"
    REPEAT_SCAN = "repeat_scan"
    ATTACHMENT = "attachment"
    CONFIRMATION = "confirmation"


class ServiceStatus(str, enum.Enum):
    PRELIMINARY = "preliminary"
    CONFIRMED = "confirmed"
    ARCHIVED = "archived"


class CatalogStatus(str, enum.Enum):
    PRELIMINARY = "preliminary"
    CONFIRMED = "confirmed"
    MERGED = "merged"
    ARCHIVED = "archived"


class CheckSeverity(str, enum.Enum):
    NORMAL = "normal"
    WARNING = "warning"
    SUSPICIOUS = "suspicious"
    ERROR = "error"


class ImportStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    COMPLETED = "completed"
    COMPLETED_WITH_CONFLICTS = "completed_with_conflicts"
    FAILED = "failed"
