import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LinkType(str, enum.Enum):
    lldp = "lldp"
    inferred = "inferred"


class Link(Base):
    __tablename__ = "links"
    __table_args__ = (
        UniqueConstraint("source_device_id", "target_device_id", "local_port", name="uq_link_endpoints"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), index=True)
    target_device_id: Mapped[str] = mapped_column(String(36), ForeignKey("devices.id"), index=True)
    local_port: Mapped[str] = mapped_column(String(64))
    remote_port: Mapped[str] = mapped_column(String(64))
    link_type: Mapped[LinkType] = mapped_column(Enum(LinkType), default=LinkType.lldp)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    source_device: Mapped["Device"] = relationship(
        "Device", foreign_keys=[source_device_id], back_populates="outgoing_links"
    )
    target_device: Mapped["Device"] = relationship(
        "Device", foreign_keys=[target_device_id], back_populates="incoming_links"
    )


from app.models.device import Device  # noqa: E402
