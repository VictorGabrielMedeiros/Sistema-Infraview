from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.device import Device, DeviceType
from app.models.link import Link, LinkType
from app.models.snapshot import TopologySnapshot
from app.schemas.device import TopologyEdge, TopologyNode
from app.schemas.snapshot import SnapshotCreate, SnapshotDetail, SnapshotSummary, SnapshotUpdate

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


def _to_device_type(val: str | None) -> DeviceType:
    if not val:
        return DeviceType.unknown
    try:
        return DeviceType(val)
    except ValueError:
        return DeviceType.unknown


@router.get("", response_model=list[SnapshotSummary])
def list_snapshots(db: Session = Depends(get_db)):
    snapshots = db.query(TopologySnapshot).order_by(TopologySnapshot.created_at.desc()).all()
    return snapshots


@router.post("", response_model=SnapshotDetail)
def create_snapshot(payload: SnapshotCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="O nome da rede/topologia é obrigatório")

    devices = db.query(Device).filter(Device.is_active.is_(True)).all()
    links = db.query(Link).filter(Link.is_active.is_(True)).all()

    nodes = [
        TopologyNode(
            id=d.id,
            label=d.display_name or d.hostname or d.ip_address or d.mac_address or "unknown",
            type=d.device_type.value,
            ip=d.ip_address,
            mac=d.mac_address,
            hostname=d.hostname,
            display_name=d.display_name,
            icon_type=d.icon_type,
            vendor=d.vendor,
            sources=d.sources or [],
            l2_only=not d.ip_address,
        ).model_dump()
        for d in devices
    ]

    edges = [
        TopologyEdge(
            id=link.id,
            source=link.source_device_id,
            target=link.target_device_id,
            label=f"{link.local_port} ↔ {link.remote_port}",
        ).model_dump()
        for link in links
    ]

    snapshot = TopologySnapshot(
        name=name,
        description=payload.description.strip() if payload.description else None,
        device_count=len(nodes),
        link_count=len(edges),
        nodes_data=nodes,
        edges_data=edges,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return SnapshotDetail(
        id=snapshot.id,
        name=snapshot.name,
        description=snapshot.description,
        created_at=snapshot.created_at,
        device_count=snapshot.device_count,
        link_count=snapshot.link_count,
        nodes=[TopologyNode(**n) for n in snapshot.nodes_data],
        edges=[TopologyEdge(**e) for e in snapshot.edges_data],
    )


@router.get("/{snapshot_id}", response_model=SnapshotDetail)
def get_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.get(TopologySnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Topologia salva não encontrada")

    return SnapshotDetail(
        id=snapshot.id,
        name=snapshot.name,
        description=snapshot.description,
        created_at=snapshot.created_at,
        device_count=snapshot.device_count,
        link_count=snapshot.link_count,
        nodes=[TopologyNode(**n) for n in (snapshot.nodes_data or [])],
        edges=[TopologyEdge(**e) for e in (snapshot.edges_data or [])],
    )


@router.patch("/{snapshot_id}", response_model=SnapshotSummary)
def update_snapshot(snapshot_id: str, payload: SnapshotUpdate, db: Session = Depends(get_db)):
    snapshot = db.get(TopologySnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Topologia salva não encontrada")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="O nome não pode ser vazio")
        snapshot.name = name

    if payload.description is not None:
        snapshot.description = payload.description.strip() if payload.description else None

    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.delete("/{snapshot_id}")
def delete_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.get(TopologySnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Topologia salva não encontrada")

    db.delete(snapshot)
    db.commit()
    return {"status": "ok", "message": f"Topologia '{snapshot.name}' excluída com sucesso"}


@router.post("/{snapshot_id}/restore", response_model=SnapshotDetail)
def restore_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.get(TopologySnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Topologia salva não encontrada")

    # 1. Desativar todos os dispositivos e links atuais
    db.query(Device).update({Device.is_active: False})
    db.query(Link).update({Link.is_active: False})

    # 2. Restaurar cada dispositivo do snapshot
    nodes = snapshot.nodes_data or []
    node_id_map: dict[str, str] = {}  # old_id -> db_device.id

    for n in nodes:
        node_id = n.get("id")
        mac = n.get("mac")
        ip = n.get("ip")
        hostname = n.get("hostname")
        display_name = n.get("display_name")
        dtype = _to_device_type(n.get("type"))
        vendor = n.get("vendor")
        icon_type = n.get("icon_type")
        sources = n.get("sources") or []

        # Tentar achar por ID ou MAC
        device = None
        if node_id:
            device = db.get(Device, node_id)
        if not device and mac:
            device = db.query(Device).filter(Device.mac_address == mac).first()
        if not device and ip:
            device = db.query(Device).filter(Device.ip_address == ip).first()

        if device:
            device.is_active = True
            if ip:
                device.ip_address = ip
            if hostname:
                device.hostname = hostname
            if display_name:
                device.display_name = display_name
            if dtype != DeviceType.unknown:
                device.device_type = dtype
            if vendor:
                device.vendor = vendor
            if icon_type:
                device.icon_type = icon_type
            if sources:
                device.sources = list(set((device.sources or []) + sources))
            device.last_seen = datetime.now(timezone.utc)
            node_id_map[node_id] = device.id
        else:
            new_dev = Device(
                id=node_id,
                mac_address=mac,
                ip_address=ip,
                hostname=hostname,
                display_name=display_name,
                device_type=dtype,
                icon_type=icon_type,
                vendor=vendor,
                sources=sources,
                is_active=True,
            )
            db.add(new_dev)
            db.flush()
            node_id_map[node_id] = new_dev.id

    # 3. Restaurar cada conexão (link)
    edges = snapshot.edges_data or []
    for e in edges:
        src_id = node_id_map.get(e.get("source"), e.get("source"))
        tgt_id = node_id_map.get(e.get("target"), e.get("target"))
        label = e.get("label", "")
        parts = label.split("↔")
        local_port = parts[0].strip() if len(parts) > 0 else "unknown"
        remote_port = parts[1].strip() if len(parts) > 1 else "unknown"

        if not src_id or not tgt_id:
            continue

        existing_link = (
            db.query(Link)
            .filter(
                Link.source_device_id == src_id,
                Link.target_device_id == tgt_id,
                Link.local_port == local_port,
            )
            .first()
        )
        if existing_link:
            existing_link.remote_port = remote_port
            existing_link.is_active = True
            existing_link.discovered_at = datetime.now(timezone.utc)
        else:
            db.add(
                Link(
                    source_device_id=src_id,
                    target_device_id=tgt_id,
                    local_port=local_port,
                    remote_port=remote_port,
                    link_type=LinkType.lldp,
                    is_active=True,
                )
            )

    db.commit()

    return SnapshotDetail(
        id=snapshot.id,
        name=snapshot.name,
        description=snapshot.description,
        created_at=snapshot.created_at,
        device_count=snapshot.device_count,
        link_count=snapshot.link_count,
        nodes=[TopologyNode(**n) for n in (snapshot.nodes_data or [])],
        edges=[TopologyEdge(**e) for e in (snapshot.edges_data or [])],
    )

