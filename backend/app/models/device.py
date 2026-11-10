import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeviceType(str, enum.Enum):
    switch = "switch"
    router = "router"
    printer = "printer"
    server = "server"
    computer = "computer"
    phone = "phone"
    access_point = "access_point"
    firewall = "firewall"
    unknown = "unknown"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mac_address: Mapped[str | None] = mapped_column(String(17), unique=True, nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_type: Mapped[DeviceType] = mapped_column(Enum(DeviceType), default=DeviceType.unknown)
    icon_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vendor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    chassis_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mgmt_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    first_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    outgoing_links: Mapped[list["Link"]] = relationship(
        "Link", foreign_keys="Link.source_device_id", back_populates="source_device"
    )
    incoming_links: Mapped[list["Link"]] = relationship(
        "Link", foreign_keys="Link.target_device_id", back_populates="target_device"
    )
