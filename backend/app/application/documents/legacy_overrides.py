from __future__ import annotations

from pathlib import Path

from app.compat.document_processing import get_document_processing_attr
from app.application.documents.parsing_access import parse_document_text_for_application
from app.infrastructure.documents.text_extraction_service import (
    extract_axb_raw_scanned_pdf_text as extract_axb_raw_scanned_pdf_text_default,
    extract_document_text as extract_document_text_default,
)


def get_document_processing_value(name: str, default: object) -> object:
    return get_document_processing_attr(name, default)


def call_document_processing_override(name: str, default, /, *args, **kwargs):
    return get_document_processing_attr(name, default)(*args, **kwargs)


def get_storage_root_override() -> Path | None:
    storage_root = get_document_processing_value("LOCAL_STORAGE_ROOT", None)
    if storage_root is None:
        return None
    return Path(storage_root)


def extract_document_text(path, source_type: str):
    return call_document_processing_override("extract_document_text", extract_document_text_default, path, source_type)


def extract_axb_raw_scanned_pdf_text(path):
    return call_document_processing_override(
        "extract_axb_raw_scanned_pdf_text",
        extract_axb_raw_scanned_pdf_text_default,
        path,
    )


def parse_document_text(text: str, db=None, *, profile_scope: str | None = None):
    return call_document_processing_override(
        "parse_document_text",
        parse_document_text_for_application,
        text,
        db=db,
        profile_scope=profile_scope,
    )
