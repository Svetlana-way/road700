from __future__ import annotations

import logging
from pathlib import Path

from app.application.documents.guards import get_document_processing_block_reason
from app.application.documents.legacy_overrides import get_storage_root_override
from app.application.documents.support import load_document_for_processing
from app.core.paths import get_storage_root, resolve_storage_path
from app.application.documents.results import ProcessingResult


logger = logging.getLogger("app.services.document_processing")


def get_storage_path(storage_key: str) -> Path | None:
    storage_root = get_storage_root_override() or get_storage_root()
    return resolve_storage_path(storage_key, storage_root=storage_root)


def create_processing_result(*, document, job, message: str):
    return ProcessingResult(document=document, job=job, message=message)
