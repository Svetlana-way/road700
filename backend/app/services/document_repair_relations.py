from __future__ import annotations

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
    non_archived = next((item for item in repair.documents if item.status != DocumentStatus.ARCHIVED), None)
    if non_archived is not None:
        return non_archived
    if include_archived_fallback:
        return repair.documents[0] if repair.documents else None
    return None


def order_repair_documents_by_source_priority(repair: Repair) -> list[Document]:
    source_document = get_repair_source_document(repair, include_archived_fallback=True)
    if source_document is None:
        return []

    ordered = [source_document]
    ordered.extend(
        document
        for document in sorted(repair.documents, key=lambda item: (item.is_primary, item.id), reverse=True)
        if document.id != source_document.id
    )
    return ordered
