from __future__ import annotations

from app.application.documents.legacy_overrides import get_document_processing_value
from app.application.documents.guards import (
    build_ocr_runtime_status_lines,
    collect_ocr_runtime_issues,
    get_document_processing_block_reason,
)
from app.services.ocr_runtime import get_ocr_runtime_status


def get_ocr_runtime_issues(*, require_pdf_scan_ocr: bool = True) -> list[str]:
    status = get_document_processing_value("get_ocr_runtime_status", get_ocr_runtime_status)()
    return collect_ocr_runtime_issues(status, require_pdf_scan_ocr=require_pdf_scan_ocr)


def format_ocr_runtime_status_lines(*, require_pdf_scan_ocr: bool = True) -> list[str]:
    status = get_document_processing_value("get_ocr_runtime_status", get_ocr_runtime_status)()
    issues = get_document_processing_value("get_ocr_runtime_issues", get_ocr_runtime_issues)(
        require_pdf_scan_ocr=require_pdf_scan_ocr
    )
    return build_ocr_runtime_status_lines(status, issues)


def ensure_ocr_runtime(*, require_pdf_scan_ocr: bool = True) -> None:
    issues = get_document_processing_value("get_ocr_runtime_issues", get_ocr_runtime_issues)(
        require_pdf_scan_ocr=require_pdf_scan_ocr
    )
    if issues:
        raise RuntimeError("; ".join(issues))
