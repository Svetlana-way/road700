from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import VehicleStatus, VehicleType


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType), nullable=False, index=True)
    vin: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    plate_number: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    year: Mapped[int | None] = mapped_column(nullable=True)
    column_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mechanic_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_driver_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_coordinates_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus),
        nullable=False,
        default=VehicleStatus.ACTIVE,
        index=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assignments: Mapped[list["VehicleAssignmentHistory"]] = relationship(
        back_populates="vehicle",
        cascade="all, delete-orphan",
    )
    left_links: Mapped[list["VehicleLinkHistory"]] = relationship(
        back_populates="left_vehicle",
        foreign_keys="VehicleLinkHistory.left_vehicle_id",
        cascade="all, delete-orphan",
    )
    right_links: Mapped[list["VehicleLinkHistory"]] = relationship(
        back_populates="right_vehicle",
        foreign_keys="VehicleLinkHistory.right_vehicle_id",
        cascade="all, delete-orphan",
    )
    repairs: Mapped[list["Repair"]] = relationship(back_populates="vehicle")


class VehicleAssignmentHistory(Base):
    __tablename__ = "vehicle_assignment_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    starts_at: Mapped[date] = mapped_column(Date, nullable=False)
    ends_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    assigned_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="assignments")
    user: Mapped["User"] = relationship(
        back_populates="assigned_vehicles",
        foreign_keys=[user_id],
    )


class VehicleLinkHistory(Base):
    __tablename__ = "vehicle_link_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    left_vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    right_vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    starts_at: Mapped[date] = mapped_column(Date, nullable=False)
    ends_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    left_vehicle: Mapped["Vehicle"] = relationship(
        back_populates="left_links",
        foreign_keys=[left_vehicle_id],
    )
    right_vehicle: Mapped["Vehicle"] = relationship(
        back_populates="right_links",
        foreign_keys=[right_vehicle_id],
    )

