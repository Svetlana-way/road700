from __future__ import annotations

from sqlalchemy import func, select

from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus
from app.models.repair import Repair


PRIMARY_DOCUMENT_KINDS = {DocumentKind.ORDER, DocumentKind.REPEAT_SCAN}


def is_document_primary_eligible(document: Document) -> bool:
    return document.kind in PRIMARY_DOCUMENT_KINDS and document.status != DocumentStatus.ARCHIVED


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
        return max(current_primary_documents, key=lambda item: (item.created_at, item.id))

    return max(eligible_documents, key=lambda item: (item.created_at, item.id))


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
        non_archived_documents = sorted(
            (item for item in repair.documents if item.status != DocumentStatus.ARCHIVED),
            key=lambda item: (item.created_at, item.id),
        )
        if non_archived_documents:
            return non_archived_documents[0]
        archived_documents = sorted(repair.documents, key=lambda item: (item.created_at, item.id))
        return archived_documents[0] if archived_documents else None
    return None


def build_canonical_source_document_id_expr():
    source_document_match_id = (
        select(Document.id)
        .where(
            Document.id == Repair.source_document_id,
            Document.repair_id == Repair.id,
            Document.kind.in_(tuple(PRIMARY_DOCUMENT_KINDS)),
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
            Document.kind.in_(tuple(PRIMARY_DOCUMENT_KINDS)),
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
        source_document = min(active_documents, key=lambda item: (item.created_at, item.id))

    ordered = [source_document]
    ordered.extend(
        document
        for document in sorted(active_documents, key=lambda item: (item.is_primary, item.id), reverse=True)
        if document.id != source_document.id
    )
    return ordered
