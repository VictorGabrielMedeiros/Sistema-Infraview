from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.device import TopologyEdge, TopologyNode


class SnapshotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)


class SnapshotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=500)


class SnapshotSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    created_at: datetime
    device_count: int
    link_count: int


class SnapshotDetail(SnapshotSummary):
    nodes: list[TopologyNode] = Field(default_factory=list)
    edges: list[TopologyEdge] = Field(default_factory=list)

