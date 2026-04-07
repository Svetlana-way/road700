from __future__ import annotations

from app.models.document import Document, DocumentVersion


def get_latest_document_version(document: Document | None) -> DocumentVersion | None:
    if document is None or not document.versions:
        return None
    return max(document.versions, key=lambda item: item.version_number)


def get_latest_parsed_payload(document: Document | None) -> dict:
    latest_version = get_latest_document_version(document)
    if latest_version is None or not isinstance(latest_version.parsed_payload, dict):
        return {}
    return latest_version.parsed_payload
