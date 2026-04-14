from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional


def decode_pdf_literal(raw_text: bytes) -> bytes:
    from app.infrastructure.documents.text_extraction_service import decode_pdf_literal as _decode_pdf_literal

    return _decode_pdf_literal(raw_text)


def extract_pdf_stream_text(page) -> str:
    from app.infrastructure.documents.text_extraction_service import extract_pdf_stream_text as _extract_pdf_stream_text

    return _extract_pdf_stream_text(page)


def extract_pdf_text(path: Path) -> str:
    from app.infrastructure.documents.text_extraction_service import extract_pdf_text as _extract_pdf_text

    return _extract_pdf_text(path)


def run_vision_ocr(image_paths: list[Path]) -> dict[str, str]:
    from app.infrastructure.documents.text_extraction_service import run_vision_ocr as _run_vision_ocr

    return _run_vision_ocr(image_paths)


def run_tesseract_ocr_with_modes(
    image_paths: list[Path],
    *,
    page_segmentation_modes: tuple[str, ...] | list[str],
) -> dict[str, str]:
    from app.infrastructure.documents.text_extraction_service import (
        run_tesseract_ocr_with_modes as _run_tesseract_ocr_with_modes,
    )

    return _run_tesseract_ocr_with_modes(
        image_paths,
        page_segmentation_modes=page_segmentation_modes,
    )


def run_tesseract_ocr(image_paths: list[Path]) -> dict[str, str]:
    from app.infrastructure.documents.text_extraction_service import run_tesseract_ocr as _run_tesseract_ocr

    return _run_tesseract_ocr(image_paths)


def run_ocr_backend(image_paths: list[Path]) -> tuple[dict[str, str], str]:
    from app.infrastructure.documents.text_extraction_service import run_ocr_backend as _run_ocr_backend

    return _run_ocr_backend(image_paths)


def save_pillow_optimized_image(source_path: Path, output_path: Path) -> bool:
    from app.infrastructure.documents.text_extraction_service import (
        save_pillow_optimized_image as _save_pillow_optimized_image,
    )

    return _save_pillow_optimized_image(source_path, output_path)


def save_pdf_header_crop_for_ocr(source_path: Path, output_path: Path) -> bool:
    from app.infrastructure.documents.text_extraction_service import (
        save_pdf_header_crop_for_ocr as _save_pdf_header_crop_for_ocr,
    )

    return _save_pdf_header_crop_for_ocr(source_path, output_path)


def optimize_existing_image_for_ocr(path: Path) -> None:
    from app.infrastructure.documents.text_extraction_service import (
        optimize_existing_image_for_ocr as _optimize_existing_image_for_ocr,
    )

    _optimize_existing_image_for_ocr(path)


def preprocess_image_for_ocr(path: Path) -> tuple[tempfile.TemporaryDirectory, Path]:
    from app.infrastructure.documents.text_extraction_service import (
        preprocess_image_for_ocr as _preprocess_image_for_ocr,
    )

    return _preprocess_image_for_ocr(path)


def extract_image_text(path: Path) -> tuple[str, str]:
    from app.infrastructure.documents.text_extraction_service import extract_image_text as _extract_image_text

    return _extract_image_text(path)


def render_single_page_pdf_for_ocr(source_path: Path, output_path: Path) -> None:
    from app.infrastructure.documents.text_extraction_service import (
        render_single_page_pdf_for_ocr as _render_single_page_pdf_for_ocr,
    )

    _render_single_page_pdf_for_ocr(source_path, output_path)


def render_pdf_pages_for_ocr(path: Path, max_pages: int = 5) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    from app.infrastructure.documents.text_extraction_service import (
        render_pdf_pages_for_ocr as _render_pdf_pages_for_ocr,
    )

    return _render_pdf_pages_for_ocr(path, max_pages=max_pages)


def render_pdf_pages_for_raw_pdftoppm_ocr(path: Path, max_pages: int = 5) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    from app.infrastructure.documents.text_extraction_service import (
        render_pdf_pages_for_raw_pdftoppm_ocr as _render_pdf_pages_for_raw_pdftoppm_ocr,
    )

    return _render_pdf_pages_for_raw_pdftoppm_ocr(path, max_pages=max_pages)


def extract_scanned_pdf_text(path: Path) -> tuple[str, str]:
    from app.infrastructure.documents.text_extraction_service import extract_scanned_pdf_text as _extract_scanned_pdf_text

    return _extract_scanned_pdf_text(path)


def extract_axb_raw_scanned_pdf_text(path: Path) -> str:
    from app.infrastructure.documents.text_extraction_service import (
        extract_axb_raw_scanned_pdf_text as _extract_axb_raw_scanned_pdf_text,
    )

    return _extract_axb_raw_scanned_pdf_text(path)


def format_spreadsheet_cell_value(value: object) -> str:
    from app.infrastructure.documents.text_extraction_service import (
        format_spreadsheet_cell_value as _format_spreadsheet_cell_value,
    )

    return _format_spreadsheet_cell_value(value)


def extract_spreadsheet_text(path: Path) -> str:
    from app.infrastructure.documents.text_extraction_service import extract_spreadsheet_text as _extract_spreadsheet_text

    return _extract_spreadsheet_text(path)


def extract_document_text(path: Path, source_type: str) -> tuple[str, str, Optional[str]]:
    from app.infrastructure.documents.text_extraction_service import extract_document_text as _extract_document_text

    return _extract_document_text(path, source_type)
