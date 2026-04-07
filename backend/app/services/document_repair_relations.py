from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select

from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus
from app.models.repair import Repair


PRIMARY_DOCUMENT_KINDS = {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}
PRIMARY_DOCUMENT_KIND_VALUES = tuple(PRIMARY_DOCUMENT_KINDS)


def is_document_primary_eligible(document: Document) -> bool:
    return document.kind in PRIMARY_DOCUMENT_KINDS and document.status != DocumentStatus.ARCHIVED


def get_document_recency_key(document: Document) -> tuple[object, int]:
    return (document.created_at, document.id)


def ensure_repair_vehicle_relation(repair: Repair) -> None:
    if repair.vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair not found")


def assign_primary_document(repair: Repair, target_document: Document | None) -> None:
    for item in repair.documents:
        item.is_primary = target_document is not None and item.id == target_document.id
    repair.source_document_id = target_document.id if target_document is not None else None


def choose_primary_document_candidate(
    repair: Repair,
    *,
    preferred_document: Document | None = None,
) -> Document | None:
    eligible_documents = [item for item in repair.documents if is_document_primary_eligible(item)]
    if not eligible_documents:
        return None

    if preferred_document is not None and any(item.id == preferred_document.id for item in eligible_documents):
        return next(item for item in eligible_documents if item.id == preferred_document.id)

    current_source = next(
        (
            item
            for item in eligible_documents
            if repair.source_document_id is not None and item.id == repair.source_document_id
        ),
        None,
    )
    if current_source is not None:
        return current_source

    current_primary_documents = [item for item in eligible_documents if item.is_primary]
    if current_primary_documents:
        return max(current_primary_documents, key=get_document_recency_key)

    return max(eligible_documents, key=get_document_recency_key)


def normalize_repair_primary_document(
    repair: Repair,
    *,
    preferred_document: Document | None = None,
) -> Document | None:
    chosen = choose_primary_document_candidate(repair, preferred_document=preferred_document)
    assign_primary_document(repair, chosen)
    return chosen


def get_repair_source_document(
    repair: Repair,
    *,
    include_archived_fallback: bool = False,
) -> Document | None:
    chosen = choose_primary_document_candidate(repair)
    if chosen is not None:
        return chosen
    if include_archived_fallback:
        archived_primary_documents = sorted(
            (
                item
                for item in repair.documents
                if item.kind in PRIMARY_DOCUMENT_KINDS and item.status == DocumentStatus.ARCHIVED
            ),
            key=get_document_recency_key,
        )
        return archived_primary_documents[-1] if archived_primary_documents else None
    return None


def build_canonical_source_document_id_expr():
    source_document_match_id = (
        select(Document.id)
        .where(
            Document.id == Repair.source_document_id,
            Document.repair_id == Repair.id,
            Document.kind.in_(PRIMARY_DOCUMENT_KIND_VALUES),
            Document.status != DocumentStatus.ARCHIVED,
        )
        .limit(1)
        .correlate(Repair)
        .scalar_subquery()
    )
    preferred_document_id = (
        select(Document.id)
        .where(
            Document.repair_id == Repair.id,
            Document.kind.in_(PRIMARY_DOCUMENT_KIND_VALUES),
            Document.status != DocumentStatus.ARCHIVED,
        )
        .order_by(
            Document.is_primary.desc(),
            Document.created_at.desc(),
            Document.id.desc(),
        )
        .limit(1)
        .correlate(Repair)
        .scalar_subquery()
    )
    return func.coalesce(source_document_match_id, preferred_document_id)


def order_repair_documents_by_source_priority(repair: Repair) -> list[Document]:
    active_documents = [document for document in repair.documents if document.status != DocumentStatus.ARCHIVED]
    if not active_documents:
        return []
    source_document = get_repair_source_document(repair)
    if source_document is None:
        source_document = max(active_documents, key=get_document_recency_key)

    ordered = [source_document]
    ordered.extend(
        sorted(
            (document for document in active_documents if document.id != source_document.id),
            key=get_document_recency_key,
            reverse=True,
        )
    )
    return ordered
