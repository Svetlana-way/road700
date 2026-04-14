from __future__ import annotations

from app.models.document import Document
from app.models.enums import DocumentStatus, RepairStatus, ServiceStatus, VehicleStatus


def collect_ocr_runtime_issues(status: dict[str, object], *, require_pdf_scan_ocr: bool = True) -> list[str]:
    issues: list[str] = []
    if not bool(status["image_ocr_available"]):
        issues.append("OCR backend for images is not available")
    if require_pdf_scan_ocr and not bool(status["pdf_scan_ocr_available"]):
        if status["ocr_backend"] is None:
            issues.append("OCR backend for scanned PDFs is not available")
        if status["pdf_renderer"] is None:
            issues.append("PDF renderer for OCR is not available")
    return issues


def build_ocr_runtime_status_lines(status: dict[str, object], issues: list[str]) -> list[str]:
    lines = [
        f"OCR backend: {status['ocr_backend'] or 'missing'}",
        f"PDF renderer: {status['pdf_renderer'] or 'missing'}",
        f"Image OCR available: {'yes' if status['image_ocr_available'] else 'no'}",
        f"Scanned PDF OCR available: {'yes' if status['pdf_scan_ocr_available'] else 'no'}",
    ]
    if issues:
        lines.append(f"Issues: {'; '.join(issues)}")
    else:
        lines.append("Issues: none")
    return lines


def get_document_processing_block_reason(document: Document) -> str | None:
    repair = document.repair
    if document.status == DocumentStatus.ARCHIVED:
        return "Archived documents cannot be modified"
    if repair is None:
        return "Document repair relation is incomplete"
    if repair.vehicle is None:
        return "Document vehicle relation is incomplete"
    if repair.status == RepairStatus.ARCHIVED:
        return "Archived repairs cannot be modified"
    if repair.vehicle is not None and repair.vehicle.status == VehicleStatus.ARCHIVED:
        return "Archived vehicles cannot be used in operational actions"
    if repair.service is not None and repair.service.status == ServiceStatus.ARCHIVED:
        return "Repairs for archived services cannot be modified"
    return None
