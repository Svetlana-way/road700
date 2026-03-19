from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, Enum, ForeignKey, Float, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import DocumentKind, DocumentStatus


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    repair_id: Mapped[Optional[int]] = mapped_column(ForeignKey("repairs.id"), nullable=True, index=True)
    uploaded_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="pdf")
    kind: Mapped[DocumentKind] = mapped_column(
        Enum(DocumentKind),
        nullable=False,
        default=DocumentKind.ORDER,
        index=True,
    )
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus),
        nullable=False,
        default=DocumentStatus.UPLOADED,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    review_queue_priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    repair: Mapped["Repair | None"] = relationship(
        back_populates="documents",
        foreign_keys=[repair_id],
    )
    uploaded_by: Mapped["User | None"] = relationship(back_populates="uploaded_documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    import_jobs: Mapped[list["ImportJob"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DocumentVersion(Base, TimestampMixin):
    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    parsed_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    field_confidence_map: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    document: Mapped["Document"] = relationship(back_populates="versions")
