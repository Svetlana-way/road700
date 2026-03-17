from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OcrLearningSignal(Base, TimestampMixin):
    __tablename__ = "ocr_learning_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    repair_id: Mapped[int] = mapped_column(ForeignKey("repairs.id"), nullable=False, index=True)
    document_id: Mapped[Optional[int]] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    document_version_id: Mapped[Optional[int]] = mapped_column(ForeignKey("document_versions.id"), nullable=True, index=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    signal_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    target_field: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    ocr_profile_scope: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    extracted_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    corrected_value: Mapped[str] = mapped_column(Text, nullable=False)
    service_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    document_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    text_excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggestion_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="new", index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
