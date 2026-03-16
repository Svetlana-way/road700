from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Float, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import CatalogStatus, CheckSeverity, RepairStatus


class Repair(Base, TimestampMixin):
    __tablename__ = "repairs"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    repair_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    mileage: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    employee_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    work_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    parts_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    vat_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    expected_total: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[RepairStatus] = mapped_column(
        Enum(RepairStatus),
        nullable=False,
        default=RepairStatus.DRAFT,
        index=True,
    )
    is_preliminary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_partially_recognized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_manually_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="repairs")
    service: Mapped["Service | None"] = relationship(back_populates="repairs")
    created_by: Mapped["User | None"] = relationship(back_populates="created_repairs")
    source_document: Mapped["Document | None"] = relationship(foreign_keys=[source_document_id])
    documents: Mapped[list["Document"]] = relationship(
        back_populates="repair",
        foreign_keys="Document.repair_id",
    )
    works: Mapped[list["RepairWork"]] = relationship(
        back_populates="repair",
        cascade="all, delete-orphan",
    )
    parts: Mapped[list["RepairPart"]] = relationship(
        back_populates="repair",
        cascade="all, delete-orphan",
    )
    checks: Mapped[list["RepairCheck"]] = relationship(
        back_populates="repair",
        cascade="all, delete-orphan",
    )


class RepairWork(Base):
    __tablename__ = "repair_works"

    id: Mapped[int] = mapped_column(primary_key=True)
    repair_id: Mapped[int] = mapped_column(ForeignKey("repairs.id"), nullable=False, index=True)
    work_code: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    work_name: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    standard_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    status: Mapped[CatalogStatus] = mapped_column(
        Enum(CatalogStatus),
        nullable=False,
        default=CatalogStatus.CONFIRMED,
    )
    reference_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    repair: Mapped["Repair"] = relationship(back_populates="works")


class RepairPart(Base):
    __tablename__ = "repair_parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    repair_id: Mapped[int] = mapped_column(ForeignKey("repairs.id"), nullable=False, index=True)
    article: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    part_name: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    unit_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    status: Mapped[CatalogStatus] = mapped_column(
        Enum(CatalogStatus),
        nullable=False,
        default=CatalogStatus.CONFIRMED,
    )

    repair: Mapped["Repair"] = relationship(back_populates="parts")


class RepairCheck(Base, TimestampMixin):
    __tablename__ = "repair_checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    repair_id: Mapped[int] = mapped_column(ForeignKey("repairs.id"), nullable=False, index=True)
    check_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    severity: Mapped[CheckSeverity] = mapped_column(Enum(CheckSeverity), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    calculation_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    repair: Mapped["Repair"] = relationship(back_populates="checks")
