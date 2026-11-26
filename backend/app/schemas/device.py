from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.device import DeviceType


class DeviceBase(BaseModel):
    mac_address: str | None = None
    ip_address: str | None = None
    hostname: str | None = None
    display_name: str | None = None
    device_type: DeviceType = DeviceType.unknown
    icon_type: str | None = None
    vendor: str | None = None
    model: str | None = None
    chassis_id: str | None = None
    mgmt_ip: str | None = None
    is_randomized_mac: bool = False
    identification_method: str | None = None
    identification_confidence: str | None = None
    device_category_detail: str | None = None
    sources: list[str] = Field(default_factory=list)


class DeviceRead(DeviceBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auto_device_type: DeviceType | None = None
    manual_device_type: DeviceType | None = None
    first_seen: datetime
    last_seen: datetime
    is_active: bool


class DeviceDetail(DeviceRead):
    connected_ports: list[str] = Field(default_factory=list)


class DeviceUpdate(BaseModel):
    display_name: str | None = None
    icon_type: str | None = None
    device_type: DeviceType | None = None
    restore_auto_type: bool = False


class LinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_device_id: str
    target_device_id: str
    local_port: str
    remote_port: str
    link_type: str
    discovered_at: datetime


class TopologyNode(BaseModel):
    id: str
    label: str
    type: str
    auto_type: str | None = None
    is_manual_type: bool = False
    ip: str | None = None
    mac: str | None = None
    hostname: str | None = None
    display_name: str | None = None
    icon_type: str | None = None
    vendor: str | None = None
    sources: list[str] = Field(default_factory=list)
    l2_only: bool = False


class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str


class TopologyResponse(BaseModel):
    nodes: list[TopologyNode]
    edges: list[TopologyEdge]


class DiscoveryRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    devices_found: int
    links_found: int
    started_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None


class PaginatedDevices(BaseModel):
    items: list[DeviceRead]
    total: int
    page: int
    size: int
    pages: int


class MetricsResponse(BaseModel):
    total_devices: int
    total_links: int
    l2_only_devices: int
    devices_by_type: dict[str, int]
    devices_by_source: dict[str, int]
    last_scan: datetime | None = None
