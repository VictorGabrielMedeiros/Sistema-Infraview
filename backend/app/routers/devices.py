import csv
import io
import math

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.device import Device, DeviceType
from app.models.discovery_run import DiscoveryRun
from app.models.link import Link
from app.schemas.device import (
    DeviceDetail,
    DeviceRead,
    DeviceUpdate,
    MetricsResponse,
    PaginatedDevices,
    TopologyEdge,
    TopologyNode,
    TopologyResponse,
)
from app.services.discovery.runner import run_discovery

router = APIRouter(prefix="/api", tags=["devices"])


@router.get("/devices", response_model=PaginatedDevices)
def list_devices(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Device).filter(Device.is_active.is_(True))
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Device.hostname.ilike(term),
                Device.ip_address.ilike(term),
                Device.mac_address.ilike(term),
                Device.display_name.ilike(term),
            )
        )
    total = query.count()
    items = query.order_by(Device.last_seen.desc()).offset((page - 1) * size).limit(size).all()
    pages = max(1, math.ceil(total / size))
    return PaginatedDevices(items=items, total=total, page=page, size=size, pages=pages)


@router.get("/devices/{device_id}", response_model=DeviceDetail)
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id, Device.is_active.is_(True)).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    ports: list[str] = []
    for link in device.outgoing_links:
        if link.is_active:
            ports.append(f"{link.local_port} → {link.remote_port}")
    for link in device.incoming_links:
        if link.is_active:
            ports.append(f"{link.remote_port} ← {link.local_port}")

    detail = DeviceDetail.model_validate(device)
    detail.connected_ports = ports
    return detail


VALID_ICON_TYPES = {
    "router", "switch", "server", "computer", "printer",
    "phone", "tablet", "access_point", "firewall", "monitor", "cloud",
    "database", "camera", "tv", "unknown",
}


@router.patch("/devices/{device_id}", response_model=DeviceDetail)
def update_device(
    device_id: str,
    payload: DeviceUpdate = Body(...),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if payload.display_name is not None:
        device.display_name = payload.display_name.strip() or None

    if payload.icon_type is not None:
        if payload.icon_type and payload.icon_type not in VALID_ICON_TYPES:
            raise HTTPException(status_code=422, detail=f"Icon inválido: {payload.icon_type}")
        device.icon_type = payload.icon_type or None

    if payload.restore_auto_type:
        device.manual_device_type = None
        device.device_type = device.auto_device_type or DeviceType.unknown
    elif payload.device_type is not None:
        if device.auto_device_type is None:
            device.auto_device_type = device.device_type
        device.manual_device_type = payload.device_type
        device.device_type = payload.device_type

    db.commit()
    db.refresh(device)

    ports: list[str] = []
    for link in device.outgoing_links:
        if link.is_active:
            ports.append(f"{link.local_port} → {link.remote_port}")
    for link in device.incoming_links:
        if link.is_active:
            ports.append(f"{link.remote_port} ← {link.local_port}")

    detail = DeviceDetail.model_validate(device)
    detail.connected_ports = ports
    return detail


@router.get("/topology", response_model=TopologyResponse)
def get_topology(db: Session = Depends(get_db)):
    devices = db.query(Device).filter(Device.is_active.is_(True)).all()
    links = db.query(Link).filter(Link.is_active.is_(True)).all()

    nodes = [
        TopologyNode(
            id=d.id,
            label=d.display_name or d.hostname or d.ip_address or d.mac_address or "unknown",
            type=d.device_type.value,
            auto_type=(d.auto_device_type or d.device_type).value,
            is_manual_type=d.manual_device_type is not None,
            ip=d.ip_address,
            mac=d.mac_address,
            hostname=d.hostname,
            display_name=d.display_name,
            icon_type=d.icon_type,
            vendor=d.vendor,
            sources=d.sources or [],
            l2_only=not d.ip_address,
        )
        for d in devices
    ]
    edges = [
        TopologyEdge(
            id=link.id,
            source=link.source_device_id,
            target=link.target_device_id,
            label=f"{link.local_port} ↔ {link.remote_port}",
        )
        for link in links
    ]
    return TopologyResponse(nodes=nodes, edges=edges)


@router.get("/metrics", response_model=MetricsResponse)
def get_metrics(db: Session = Depends(get_db)):
    total_devices = db.query(Device).filter(Device.is_active.is_(True)).count()
    total_links = db.query(Link).filter(Link.is_active.is_(True)).count()
    l2_only = db.query(Device).filter(Device.is_active.is_(True), Device.ip_address.is_(None)).count()

    type_counts = (
        db.query(Device.device_type, func.count(Device.id))
        .filter(Device.is_active.is_(True))
        .group_by(Device.device_type)
        .all()
    )
    devices_by_type = {t.value: c for t, c in type_counts}

    devices = db.query(Device).filter(Device.is_active.is_(True)).all()
    devices_by_source: dict[str, int] = {}
    for device in devices:
        for source in device.sources or []:
            devices_by_source[source] = devices_by_source.get(source, 0) + 1

    last_run = db.query(DiscoveryRun).order_by(DiscoveryRun.started_at.desc()).first()

    return MetricsResponse(
        total_devices=total_devices,
        total_links=total_links,
        l2_only_devices=l2_only,
        devices_by_type=devices_by_type,
        devices_by_source=devices_by_source,
        last_scan=last_run.completed_at if last_run else None,
    )


@router.get("/export/devices.csv")
def export_devices_csv(db: Session = Depends(get_db)):
    devices = db.query(Device).filter(Device.is_active.is_(True)).order_by(Device.hostname).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["hostname", "display_name", "ip", "mac", "randomized_mac", "type", "category_detail", "vendor", "model", "identification_method", "confidence", "sources", "last_seen"])
    for d in devices:
        writer.writerow([
            d.hostname or "",
            d.display_name or "",
            d.ip_address or "",
            d.mac_address or "",
            "yes" if d.is_randomized_mac else "no",
            d.device_type.value,
            d.device_category_detail or "",
            d.vendor or "",
            d.model or "",
            d.identification_method or "",
            d.identification_confidence or "",
            ",".join(d.sources or []),
            d.last_seen.isoformat() if d.last_seen else "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=infraview-devices.csv"},
    )


@router.delete("/devices/clear")
def clear_devices(db: Session = Depends(get_db)):
    db.query(Link).delete()
    db.query(Device).delete()
    db.commit()
    return {"status": "ok", "message": "Dispositivos e links removidos com sucesso"}


@router.delete("/devices/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado")

    db.query(Link).filter(
        or_(Link.source_device_id == device_id, Link.target_device_id == device_id)
    ).delete()
    db.delete(device)
    db.commit()
    return {"status": "ok", "message": f"Dispositivo {device_id} removido com sucesso"}
