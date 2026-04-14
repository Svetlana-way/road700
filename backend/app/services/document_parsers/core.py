from __future__ import annotations

from sqlalchemy.orm import Session


def parse_document_text(text: str, db: Session | None = None, *, profile_scope: str | None = None) -> dict[str, object]:
    from app.application.documents.parsing import parse_document_text as _parse_document_text

    return _parse_document_text(text, db=db, profile_scope=profile_scope)
