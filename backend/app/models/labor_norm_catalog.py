from __future__ import annotations

from typing import Optional

from sqlalchemy import JSON, Boolean, Enum, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import CatalogStatus, VehicleType


class LaborNormCatalog(Base, TimestampMixin):
    __tablename__ = "labor_norm_catalogs"
    __table_args__ = (
        UniqueConstraint("scope", name="uq_labor_norm_catalogs_scope"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    catalog_name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand_family: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    vehicle_type: Mapped[Optional[VehicleType]] = mapped_column(Enum(VehicleType), nullable=True, index=True)
    year_from: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    year_to: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    brand_keywords: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    model_keywords: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    vin_prefixes: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100, index=True)
    auto_match_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    status: Mapped[CatalogStatus] = mapped_column(
        Enum(CatalogStatus),
        nullable=False,
        default=CatalogStatus.CONFIRMED,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
