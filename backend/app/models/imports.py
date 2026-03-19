from __future__ import annotations

from typing import Optional

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ImportStatus


class ImportJob(Base, TimestampMixin):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    import_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ImportStatus] = mapped_column(Enum(ImportStatus), nullable=False, index=True)
    summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(nullable=False, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    document: Mapped["Document | None"] = relationship(back_populates="import_jobs")


class ImportConflict(Base, TimestampMixin):
    __tablename__ = "import_conflicts"

    id: Mapped[int] = mapped_column(primary_key=True)
    import_job_id: Mapped[int] = mapped_column(nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    conflict_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    incoming_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    existing_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    resolution_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
