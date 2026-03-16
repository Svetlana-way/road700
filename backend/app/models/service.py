from __future__ import annotations

from typing import Optional

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ServiceStatus


class Service(Base, TimestampMixin):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ServiceStatus] = mapped_column(
        Enum(ServiceStatus),
        nullable=False,
        default=ServiceStatus.CONFIRMED,
        index=True,
    )
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    repairs: Mapped[list["Repair"]] = relationship(back_populates="service")
