from __future__ import annotations

from typing import Optional

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ImportStatus


ACTIVE_DOCUMENT_OCR_JOB_INDEX_WHERE = (
    "document_id IS NOT NULL "
    "AND import_type = 'document_ocr' "
    "AND status IN ('QUEUED', 'RETRY', 'PROCESSING')"
)


class ImportJob(Base, TimestampMixin):
    __tablename__ = "import_jobs"
    __table_args__ = (
        Index("ix_import_jobs_created_at_id", "created_at", "id"),
        Index(
            "ix_import_jobs_import_type_status_created_at_id",
            "import_type",
            "status",
            "created_at",
            "id",
        ),
        Index(
            "uq_import_jobs_active_document_ocr",
            "document_id",
            unique=True,
            sqlite_where=text(ACTIVE_DOCUMENT_OCR_JOB_INDEX_WHERE),
            postgresql_where=text(ACTIVE_DOCUMENT_OCR_JOB_INDEX_WHERE),
        ),
    )

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
    conflicts: Mapped[list["ImportConflict"]] = relationship(
        back_populates="import_job",
        cascade="all, delete-orphan",
    )


class ImportConflict(Base, TimestampMixin):
    __tablename__ = "import_conflicts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'resolved', 'ignored')",
            name="ck_import_conflicts_status_valid",
        ),
        Index("ix_import_conflicts_status_created_at_id", "status", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    import_job_id: Mapped[int] = mapped_column(ForeignKey("import_jobs.id"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    conflict_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    incoming_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    existing_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    resolution_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")

    import_job: Mapped["ImportJob"] = relationship(back_populates="conflicts")
