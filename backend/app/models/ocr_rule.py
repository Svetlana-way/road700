from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OcrRule(Base, TimestampMixin):
    __tablename__ = "ocr_rules"
    __table_args__ = (
        UniqueConstraint("profile_scope", "target_field", "pattern", name="uq_ocr_rules_profile_field_pattern"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_scope: Mapped[str] = mapped_column(String(64), nullable=False, default="default", index=True)
    target_field: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    pattern: Mapped[str] = mapped_column(Text, nullable=False)
    value_parser: Mapped[str] = mapped_column(String(32), nullable=False, default="raw", index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.6)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
