from __future__ import annotations

from typing import Optional

from sqlalchemy import Enum, Float, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import CatalogStatus


class LaborNorm(Base, TimestampMixin):
    __tablename__ = "labor_norms"
    __table_args__ = (
        UniqueConstraint("scope", "code", name="uq_labor_norms_scope_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    brand_family: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    catalog_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    name_ru: Mapped[str] = mapped_column(String(500), nullable=False)
    name_ru_alt: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    name_cn: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    name_en: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    normalized_name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    search_text: Mapped[str] = mapped_column(Text, nullable=False)
    standard_hours: Mapped[float] = mapped_column(Float, nullable=False)
    source_sheet: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    source_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[CatalogStatus] = mapped_column(
        Enum(CatalogStatus),
        nullable=False,
        default=CatalogStatus.CONFIRMED,
        index=True,
    )
