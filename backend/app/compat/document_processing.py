from __future__ import annotations

import sys


def get_document_processing_attr(name: str, default: object) -> object:
    module = sys.modules.get("app.services.document_processing")
    if module is None:
        return default
    return getattr(module, name, default)
