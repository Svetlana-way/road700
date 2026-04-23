from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from app.compat.document_processing import get_document_processing_attr
from app.infrastructure.documents import text_extraction_runtime
from app.services.ocr_runtime import (
    is_tesseract_ocr_available as is_tesseract_ocr_available_default,
    is_vision_ocr_available as is_vision_ocr_available_default,
    get_available_ocr_backend as get_available_ocr_backend_default,
    is_pdftoppm_available,
    is_sips_available,
)


def get_document_processing_value(name: str, default: object) -> object:
    return get_document_processing_attr(name, default)


def decode_pdf_literal(raw_text: bytes) -> bytes:
    return text_extraction_runtime.decode_pdf_literal(raw_text)


def extract_pdf_stream_text(page) -> str:
    return text_extraction_runtime.extract_pdf_stream_text(page)


def extract_pdf_text(path: Path) -> str:
    return text_extraction_runtime.extract_pdf_text(path)


def run_vision_ocr(image_paths: list[Path]) -> dict[str, str]:
    return text_extraction_runtime.run_vision_ocr(
        image_paths,
        is_vision_available=get_document_processing_value("is_vision_ocr_available", is_vision_ocr_available_default),
        run_subprocess=get_document_processing_value("subprocess", subprocess).run,
    )


def run_tesseract_ocr_with_modes(
    image_paths: list[Path],
    *,
    page_segmentation_modes: tuple[str, ...] | list[str],
) -> dict[str, str]:
    return text_extraction_runtime.run_tesseract_ocr_with_modes(
        image_paths,
        page_segmentation_modes=page_segmentation_modes,
        is_tesseract_available=get_document_processing_value(
            "is_tesseract_ocr_available",
            is_tesseract_ocr_available_default,
        ),
        run_subprocess=get_document_processing_value("subprocess", subprocess).run,
    )


def run_tesseract_ocr(image_paths: list[Path]) -> dict[str, str]:
    return text_extraction_runtime.run_tesseract_ocr(
        image_paths,
        run_tesseract_ocr_with_modes_fn=run_tesseract_ocr_with_modes,
    )


def run_ocr_backend(image_paths: list[Path]) -> tuple[dict[str, str], str]:
    get_ocr_backend = get_document_processing_value("get_available_ocr_backend", None)
    if get_ocr_backend is None:
        get_ocr_backend = get_available_ocr_backend_default
    return text_extraction_runtime.run_ocr_backend(
        image_paths,
        get_ocr_backend=get_ocr_backend,
        run_vision_ocr_fn=run_vision_ocr,
        run_tesseract_ocr_fn=run_tesseract_ocr,
    )


def save_pillow_optimized_image(source_path: Path, output_path: Path) -> bool:
    return text_extraction_runtime.save_pillow_optimized_image(source_path, output_path)


def save_pdf_header_crop_for_ocr(source_path: Path, output_path: Path) -> bool:
    return text_extraction_runtime.save_pdf_header_crop_for_ocr(source_path, output_path)


def optimize_existing_image_for_ocr(path: Path) -> None:
    text_extraction_runtime.optimize_existing_image_for_ocr(
        path,
        save_pillow_optimized_image_fn=save_pillow_optimized_image,
    )


def preprocess_image_for_ocr(path: Path) -> tuple[tempfile.TemporaryDirectory, Path]:
    return text_extraction_runtime.preprocess_image_for_ocr(
        path,
        save_pillow_optimized_image_fn=save_pillow_optimized_image,
        is_sips_available_fn=is_sips_available,
        run_subprocess=get_document_processing_value("subprocess", subprocess).run,
        optimize_existing_image_for_ocr_fn=optimize_existing_image_for_ocr,
    )


def extract_image_text(path: Path) -> tuple[str, str]:
    return text_extraction_runtime.extract_image_text(
        path,
        preprocess_image_for_ocr_fn=preprocess_image_for_ocr,
        run_ocr_backend_fn=run_ocr_backend,
    )


def render_single_page_pdf_for_ocr(source_path: Path, output_path: Path) -> None:
    text_extraction_runtime.render_single_page_pdf_for_ocr(
        source_path,
        output_path,
        is_pdftoppm_available_fn=is_pdftoppm_available,
        is_sips_available_fn=is_sips_available,
        run_subprocess=get_document_processing_value("subprocess", subprocess).run,
        optimize_existing_image_for_ocr_fn=optimize_existing_image_for_ocr,
    )


def render_pdf_pages_for_ocr(path: Path, max_pages: int = 5) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    return text_extraction_runtime.render_pdf_pages_for_ocr(
        path,
        max_pages=max_pages,
        render_single_page_pdf_for_ocr_fn=render_single_page_pdf_for_ocr,
    )


def render_pdf_pages_for_raw_pdftoppm_ocr(path: Path, max_pages: int = 5) -> tuple[tempfile.TemporaryDirectory, list[Path]]:
    return text_extraction_runtime.render_pdf_pages_for_raw_pdftoppm_ocr(
        path,
        max_pages=max_pages,
        is_pdftoppm_available_fn=is_pdftoppm_available,
        run_subprocess=get_document_processing_value("subprocess", subprocess).run,
    )


def extract_scanned_pdf_text(path: Path) -> tuple[str, str]:
    return text_extraction_runtime.extract_scanned_pdf_text(
        path,
        render_pdf_pages_for_ocr_fn=render_pdf_pages_for_ocr,
        run_ocr_backend_fn=run_ocr_backend,
        save_pdf_header_crop_for_ocr_fn=save_pdf_header_crop_for_ocr,
    )


def extract_axb_raw_scanned_pdf_text(path: Path) -> str:
    return text_extraction_runtime.extract_axb_raw_scanned_pdf_text(
        path,
        render_pdf_pages_for_raw_pdftoppm_ocr_fn=render_pdf_pages_for_raw_pdftoppm_ocr,
        run_tesseract_ocr_with_modes_fn=run_tesseract_ocr_with_modes,
        save_pdf_header_crop_for_ocr_fn=save_pdf_header_crop_for_ocr,
    )


def format_spreadsheet_cell_value(value: object) -> str:
    return text_extraction_runtime.format_spreadsheet_cell_value(value)


def extract_spreadsheet_text(path: Path) -> str:
    return text_extraction_runtime.extract_spreadsheet_text(path)


def extract_document_text(path: Path, source_type: str) -> tuple[str, str, str | None]:
    get_ocr_backend = get_document_processing_value("get_available_ocr_backend", None)
    if get_ocr_backend is None:
        get_ocr_backend = get_available_ocr_backend_default
    return text_extraction_runtime.extract_document_text(
        path,
        source_type,
        get_ocr_backend=get_ocr_backend,
        extract_image_text_fn=get_document_processing_value("extract_image_text", extract_image_text),
        extract_pdf_text_fn=get_document_processing_value("extract_pdf_text", extract_pdf_text),
        extract_scanned_pdf_text_fn=get_document_processing_value("extract_scanned_pdf_text", extract_scanned_pdf_text),
    )
