from __future__ import annotations

from typing import Optional

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OcrProfileMatcher(Base, TimestampMixin):
    __tablename__ = "ocr_profile_matchers"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_scope: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    filename_pattern: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    text_pattern: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    service_name_pattern: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
