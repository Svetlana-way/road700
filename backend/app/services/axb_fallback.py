from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session


def get_line_items_total(items: list[dict[str, object]]) -> float:
    from app.application.documents.axb_fallback import get_line_items_total as _get_line_items_total

    return _get_line_items_total(items)


def should_retry_axb_raw_tesseract(parsed: dict[str, object]) -> bool:
    from app.application.documents.axb_fallback import should_retry_axb_raw_tesseract as _should_retry_axb_raw_tesseract

    return _should_retry_axb_raw_tesseract(parsed)


def score_axb_parsed_document(parsed: dict[str, object]) -> int:
    from app.application.documents.axb_fallback import score_axb_parsed_document as _score_axb_parsed_document

    return _score_axb_parsed_document(parsed)


def maybe_apply_axb_raw_tesseract_fallback(
    path: Path,
    *,
    text: str,
    extracted_from: str,
    profile_scope: str | None,
    parsed: dict[str, object],
    db: Session | None = None,
) -> tuple[str, str, dict[str, object]]:
    from app.application.documents.axb_fallback import (
        maybe_apply_axb_raw_tesseract_fallback as _maybe_apply_axb_raw_tesseract_fallback,
    )

    return _maybe_apply_axb_raw_tesseract_fallback(
        path,
        text=text,
        extracted_from=extracted_from,
        profile_scope=profile_scope,
        parsed=parsed,
        db=db,
    )
