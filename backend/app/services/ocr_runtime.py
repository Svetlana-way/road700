from __future__ import annotations

import shutil
from pathlib import Path


VISION_OCR_SCRIPT = Path(__file__).with_name("vision_ocr.swift")
TESSERACT_BINARY = "tesseract"
PDFTOPPM_BINARY = "pdftoppm"
SIPS_BINARY = "sips"


def is_vision_ocr_available() -> bool:
    return shutil.which("swift") is not None and VISION_OCR_SCRIPT.exists()


def is_tesseract_ocr_available() -> bool:
    return shutil.which(TESSERACT_BINARY) is not None


def is_pdftoppm_available() -> bool:
    return shutil.which(PDFTOPPM_BINARY) is not None


def is_sips_available() -> bool:
    return shutil.which(SIPS_BINARY) is not None


def get_available_ocr_backend() -> str | None:
    if is_vision_ocr_available():
        return "vision"
    if is_tesseract_ocr_available():
        return "tesseract"
    return None


def get_available_pdf_renderer() -> str | None:
    if is_pdftoppm_available():
        return "pdftoppm"
    if is_sips_available():
        return "sips"
    return None


def get_ocr_runtime_status() -> dict[str, object]:
    ocr_backend = get_available_ocr_backend()
    pdf_renderer = get_available_pdf_renderer()
    return {
        "ocr_backend": ocr_backend,
        "pdf_renderer": pdf_renderer,
        "image_ocr_available": ocr_backend is not None,
        "pdf_scan_ocr_available": ocr_backend is not None and pdf_renderer is not None,
        "vision_available": is_vision_ocr_available(),
        "tesseract_available": is_tesseract_ocr_available(),
        "pdftoppm_available": is_pdftoppm_available(),
        "sips_available": is_sips_available(),
    }


def get_ocr_runtime_issues(*, require_pdf_scan_ocr: bool = True) -> list[str]:
    status = get_ocr_runtime_status()
    issues: list[str] = []
    if not bool(status["image_ocr_available"]):
        issues.append("OCR backend for images is not available")
    if require_pdf_scan_ocr and not bool(status["pdf_scan_ocr_available"]):
        if status["ocr_backend"] is None:
            issues.append("OCR backend for scanned PDFs is not available")
        if status["pdf_renderer"] is None:
            issues.append("PDF renderer for OCR is not available")
    return issues


def format_ocr_runtime_status_lines(*, require_pdf_scan_ocr: bool = True) -> list[str]:
    status = get_ocr_runtime_status()
    issues = get_ocr_runtime_issues(require_pdf_scan_ocr=require_pdf_scan_ocr)
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


def ensure_ocr_runtime(*, require_pdf_scan_ocr: bool = True) -> None:
    issues = get_ocr_runtime_issues(require_pdf_scan_ocr=require_pdf_scan_ocr)
    if issues:
        raise RuntimeError("; ".join(issues))


__all__ = [
    "VISION_OCR_SCRIPT",
    "TESSERACT_BINARY",
    "PDFTOPPM_BINARY",
    "SIPS_BINARY",
    "is_vision_ocr_available",
    "is_tesseract_ocr_available",
    "is_pdftoppm_available",
    "is_sips_available",
    "get_available_ocr_backend",
    "get_available_pdf_renderer",
    "get_ocr_runtime_status",
    "get_ocr_runtime_issues",
    "format_ocr_runtime_status_lines",
    "ensure_ocr_runtime",
]
