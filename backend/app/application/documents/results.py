from __future__ import annotations

from dataclasses import dataclass

from app.models.document import Document
from app.models.imports import ImportJob


@dataclass
class ProcessingResult:
    document: Document
    job: ImportJob
    message: str
