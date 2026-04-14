from __future__ import annotations

from app.application.documents.axb_fallback import maybe_apply_axb_raw_tesseract_fallback
from app.application.documents.legacy_overrides import (
    call_document_processing_override,
    extract_document_text,
    parse_document_text,
)
from app.application.documents.ocr_profiles import (
    OcrProfileSelection,
    select_ocr_profile_scope as select_ocr_profile_scope_default,
)
from app.application.documents.runtime_text import normalize_text
from app.application.documents.support import average_confidence


def select_ocr_profile_scope(db, document, text: str):
    return call_document_processing_override(
        "select_ocr_profile_scope",
        select_ocr_profile_scope_default,
        db,
        document,
        text,
    )
