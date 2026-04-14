from __future__ import annotations

from app.models.document import Document
from app.models.repair import Repair
from app.models.service import Service
from sqlalchemy.orm import Session


def load_document_for_processing(db: Session, document_id: int) -> Optional[Document]:
    from app.application.documents.support import load_document_for_processing as _load_document_for_processing

    return _load_document_for_processing(db, document_id)


def average_confidence(confidence_map: dict[str, float]) -> Optional[float]:
    from app.application.documents.support import average_confidence as _average_confidence

    return _average_confidence(confidence_map)


def resolve_service(db: Session, service_name: str) -> Service:
    from app.application.documents.support import resolve_service as _resolve_service

    return _resolve_service(db, service_name)


def build_manual_review_check(
    reason: str,
    *,
    extracted_fields: dict[str, object],
) -> dict[str, object]:
    from app.application.documents.support import build_manual_review_check as _build_manual_review_check

    return _build_manual_review_check(reason, extracted_fields=extracted_fields)


def replace_ocr_checks(db: Session, repair_id: int, checks: list[dict[str, object]]) -> None:
    from app.application.documents.support import replace_ocr_checks as _replace_ocr_checks

    _replace_ocr_checks(db, repair_id, checks)


def replace_repair_lines(
    db: Session,
    repair: Repair,
    works_payload: list[dict[str, object]],
    parts_payload: list[dict[str, object]],
) -> None:
    from app.application.documents.support import replace_repair_lines as _replace_repair_lines

    _replace_repair_lines(
        db,
        repair,
        works_payload=works_payload,
        parts_payload=parts_payload,
    )
