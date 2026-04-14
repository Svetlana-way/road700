from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import exists, or_, select

from app.application.documents.repair_relations import PRIMARY_DOCUMENT_KINDS
from app.models.document import Document
from app.models.enums import CheckSeverity, DocumentStatus, RepairStatus
from app.models.repair import Repair, RepairCheck


REVIEWABLE_DOCUMENT_STATUSES = (
    DocumentStatus.PARTIALLY_RECOGNIZED,
    DocumentStatus.NEEDS_REVIEW,
    DocumentStatus.OCR_ERROR,
)
REVIEWABLE_DOCUMENT_KINDS = tuple(PRIMARY_DOCUMENT_KINDS)
REVIEWABLE_REPAIR_STATUSES = (
    RepairStatus.IN_REVIEW,
    RepairStatus.EMPLOYEE_CONFIRMED,
    RepairStatus.SUSPICIOUS,
    RepairStatus.OCR_ERROR,
)


def build_reviewable_documents_filter() -> object:
    unresolved_checks_exist = exists(
        select(1).where(
            RepairCheck.repair_id == Repair.id,
            RepairCheck.is_resolved.is_(False),
        )
    )
    return or_(
        Document.status.in_(REVIEWABLE_DOCUMENT_STATUSES),
        Repair.status.in_(REVIEWABLE_REPAIR_STATUSES),
        Repair.is_partially_recognized.is_(True),
        unresolved_checks_exist,
    )


def build_suspicious_checks_exist_expr() -> object:
    return exists(
        select(1).where(
            RepairCheck.repair_id == Repair.id,
            RepairCheck.is_resolved.is_(False),
            RepairCheck.severity.in_((CheckSeverity.SUSPICIOUS, CheckSeverity.ERROR)),
        )
    )


def has_open_suspicious_checks(repair: Repair) -> bool:
    return has_blocking_unresolved_checks(repair.checks)


def has_blocking_unresolved_checks(checks: Iterable[RepairCheck]) -> bool:
    return any(not check.is_resolved and check.severity in {CheckSeverity.SUSPICIOUS, CheckSeverity.ERROR} for check in checks)


def count_blocking_unresolved_checks(checks: Iterable[RepairCheck]) -> int:
    return sum(
        1
        for check in checks
        if not check.is_resolved and check.severity in {CheckSeverity.SUSPICIOUS, CheckSeverity.ERROR}
    )
