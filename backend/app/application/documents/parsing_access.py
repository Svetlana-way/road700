from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.application.documents.field_extractors import normalize_plate_compare_token
from app.application.documents.parsing import parse_document_text
from app.application.documents.parser_helpers import normalize_article_value, normalize_unit_name


def parse_document_text_for_application(
    text: str,
    db: Session | None = None,
    *,
    profile_scope: str | None = None,
) -> dict[str, object]:
    return parse_document_text(text, db=db, profile_scope=profile_scope)


def normalize_unit_name_for_application(value: Optional[str]) -> Optional[str]:
    return normalize_unit_name(value)


def normalize_article_value_for_application(value: Optional[str]) -> Optional[str]:
    return normalize_article_value(value)


def normalize_plate_compare_token_for_application(value: str | None) -> Optional[str]:
    return normalize_plate_compare_token(value)
