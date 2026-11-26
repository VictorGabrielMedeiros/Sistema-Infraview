from datetime import datetime, timezone
import threading

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.device import Device, DeviceType
from app.models.discovery_run import DiscoveryRun, DiscoveryStatus
from app.models.link import Link, LinkType
from app.services.discovery.arp import scan_arp
from app.services.discovery.correlator import CorrelatedDevice, RawDevice, RawLink, correlate, merge_device, normalize_mac
from app.services.discovery.lldp import scan_lldp
from app.services.discovery.ping import scan_ping
from app.services.discovery.mobile_identifier import identify_mobile_devices
from app.services.discovery.resolver import resolve_hostnames
from app.services.snmp import enrich_devices

_discovery_lock = threading.Lock()


def _to_device_type(value: str) -> DeviceType:
    try:
        return DeviceType(value)
    except ValueError:
        return DeviceType.unknown


def _upsert_device(db: Session, correlated: CorrelatedDevice) -> Device:
    device = None
    if correlated.mac_address:
        device = db.query(Device).filter(Device.mac_address == correlated.mac_address).first()
    elif correlated.chassis_id:
        device = db.query(Device).filter(Device.chassis_id == correlated.chassis_id).first()
    elif correlated.ip_address:
        device = db.query(Device).filter(Device.ip_address == correlated.ip_address).first()

    discovered_type = _to_device_type(correlated.device_type)

    is_randomized = bool(getattr(correlated, "is_randomized_mac", False))
    id_method = getattr(correlated, "identification_method", None)
    id_confidence = getattr(correlated, "identification_confidence", None)
    cat_detail = getattr(correlated, "device_category_detail", None)

    if device is None:
        device = Device(
            mac_address=correlated.mac_address,
            ip_address=correlated.ip_address,
            hostname=correlated.hostname,
            device_type=discovered_type,
            auto_device_type=discovered_type,
            manual_device_type=None,
            vendor=correlated.vendor,
            model=correlated.model,
            chassis_id=correlated.chassis_id,
            mgmt_ip=correlated.mgmt_ip,
            is_randomized_mac=is_randomized,
            identification_method=id_method,
            identification_confidence=id_confidence,
            device_category_detail=cat_detail,
            sources=correlated.sources,
            is_active=True,
        )
        db.add(device)
    else:
        device.ip_address = correlated.ip_address or device.ip_address
        device.hostname = correlated.hostname or device.hostname
        if discovered_type != DeviceType.unknown:
            device.auto_device_type = discovered_type
        elif device.auto_device_type is None:
            device.auto_device_type = device.device_type

        # Manual classification always takes precedence over automatic discovery
        if device.manual_device_type is not None:
            device.device_type = device.manual_device_type
        elif discovered_type != DeviceType.unknown:
            device.device_type = discovered_type

        device.vendor = correlated.vendor or device.vendor
        device.model = correlated.model or device.model
        device.chassis_id = correlated.chassis_id or device.chassis_id
        device.mgmt_ip = correlated.mgmt_ip or device.mgmt_ip
        device.mac_address = correlated.mac_address or device.mac_address
        device.is_randomized_mac = is_randomized
        if id_method:
            device.identification_method = id_method
        if id_confidence:
            device.identification_confidence = id_confidence
        if cat_detail:
            device.device_category_detail = cat_detail
        device.sources = list(set((device.sources or []) + correlated.sources))
        device.last_seen = datetime.now(timezone.utc)
        device.is_active = True

    db.flush()
    return device


def _persist_links(db: Session, raw_links: list[RawLink], mac_to_device: dict[str, Device]) -> int:
    db.query(Link).update({Link.is_active: False})
    count = 0

    for raw_link in raw_links:
        src_mac = normalize_mac(raw_link.source_mac)
        dst_mac = normalize_mac(raw_link.target_mac)
        if not src_mac or not dst_mac:
            continue
        source = mac_to_device.get(src_mac)
        target = mac_to_device.get(dst_mac)
        if not source or not target:
            continue

        existing = (
            db.query(Link)
            .filter(
                Link.source_device_id == source.id,
                Link.target_device_id == target.id,
                Link.local_port == raw_link.local_port,
            )
            .first()
        )
        if existing:
            existing.remote_port = raw_link.remote_port
            existing.is_active = True
            existing.discovered_at = datetime.now(timezone.utc)
        else:
            db.add(
                Link(
                    source_device_id=source.id,
                    target_device_id=target.id,
                    local_port=raw_link.local_port,
                    remote_port=raw_link.remote_port,
                    link_type=LinkType(raw_link.link_type) if raw_link.link_type in LinkType.__members__ else LinkType.lldp,
                    is_active=True,
                )
            )
        count += 1

    return count


def _merge_ping_into_correlated(correlated: list[CorrelatedDevice], ping_devices: list[RawDevice]) -> list[CorrelatedDevice]:
    by_mac = {c.mac_address: c for c in correlated if c.mac_address}
    no_mac = [c for c in correlated if not c.mac_address]
    by_ip = {c.ip_address: c for c in correlated if c.ip_address}

    for ping in ping_devices:
        if not ping.ip:
            continue
        if ping.ip in by_ip:
            existing = by_ip[ping.ip]
            if "ping" not in existing.sources:
                existing.sources.append("ping")
            continue
        entry = merge_device(None, ping)
        if entry.mac_address:
            by_mac[entry.mac_address] = entry
        else:
            no_mac.append(entry)
        if entry.ip_address:
            by_ip[entry.ip_address] = entry

    return list(by_mac.values()) + no_mac


def _collect_network_data() -> tuple[
    list[RawDevice],
    list[RawLink],
    list[RawDevice],
    list[RawDevice],
    list[str],
]:
    """Run all network scans outside any DB transaction."""
    warnings: list[str] = []

    lldp_devices, lldp_links, lldp_warning = scan_lldp()
    arp_entries, arp_warning = scan_arp()
    ping_entries, ping_warning = scan_ping()

    if lldp_warning:
        warnings.append(f"LLDP: {lldp_warning}")
    if arp_warning:
        warnings.append(f"ARP: {arp_warning}")
    if ping_warning:
        warnings.append(f"Ping: {ping_warning}")

    return lldp_devices, lldp_links, arp_entries, ping_entries, warnings


def run_discovery(db: Session) -> DiscoveryRun:
    if not _discovery_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Já existe uma descoberta em andamento")

    try:
        # 1) Mark run as running and RELEASE the DB lock immediately
        run = DiscoveryRun(status=DiscoveryStatus.running)
        db.add(run)
        db.commit()
        db.refresh(run)
        run_id = run.id

        warnings: list[str] = []
        try:
            # 2) Network I/O without an open write transaction
            lldp_devices, lldp_links, arp_entries, ping_entries, warnings = _collect_network_data()

            correlated = correlate(lldp_devices, arp_entries)
            correlated = _merge_ping_into_correlated(correlated, ping_entries)

            # Resolve computer/machine names via NetBIOS and Reverse DNS
            correlated = resolve_hostnames(correlated)

            snmp_inputs = [
                RawDevice(
                    mac=c.mac_address,
                    ip=c.ip_address,
                    hostname=c.hostname,
                    device_type=c.device_type,
                    vendor=c.vendor,
                    model=c.model,
                    chassis_id=c.chassis_id,
                    mgmt_ip=c.mgmt_ip,
                    source="snmp",
                )
                for c in correlated
                if c.ip_address
            ]
            if snmp_inputs:
                enriched = enrich_devices(snmp_inputs, settings.snmp_community)
                enriched_by_mac = {normalize_mac(d.mac): d for d in enriched if d.mac}
                enriched_by_ip = {d.ip: d for d in enriched if d.ip}
                for item in correlated:
                    e = None
                    if item.mac_address and item.mac_address in enriched_by_mac:
                        e = enriched_by_mac[item.mac_address]
                    elif item.ip_address and item.ip_address in enriched_by_ip:
                        e = enriched_by_ip[item.ip_address]
                    if e:
                        item.vendor = e.vendor or item.vendor
                        item.model = e.model or item.model
                        item.hostname = item.hostname or e.hostname
                        if e.device_type != "unknown":
                            item.device_type = e.device_type
                        if "snmp" not in item.sources:
                            item.sources.append("snmp")

            # Multi-source mobile & OUI identification (OUI, DHCP leases, mDNS, private MAC)
            correlated = identify_mobile_devices(correlated)

            # 3) Short write transaction for persistence only
            run = db.get(DiscoveryRun, run_id)
            if run is None:
                raise RuntimeError("Discovery run desapareceu durante o scan")

            mac_to_device: dict[str, Device] = {}
            seen_device_ids: set[str] = set()
            for item in correlated:
                device = _upsert_device(db, item)
                seen_device_ids.add(device.id)
                if device.mac_address:
                    mac_to_device[device.mac_address] = device

            if seen_device_ids:
                db.query(Device).filter(
                    Device.is_active.is_(True),
                    Device.id.notin_(seen_device_ids),
                ).update({Device.is_active: False}, synchronize_session=False)

            links_count = _persist_links(db, lldp_links, mac_to_device)

            run.status = DiscoveryStatus.completed
            run.devices_found = len(seen_device_ids)
            run.links_found = links_count
            run.completed_at = datetime.now(timezone.utc)
            if warnings:
                run.error_message = "; ".join(warnings)
            db.commit()
            db.refresh(run)
            return run
        except Exception as exc:
            db.rollback()
            run = db.get(DiscoveryRun, run_id)
            if run is not None:
                run.status = DiscoveryStatus.failed
                run.error_message = str(exc)
                run.completed_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(run)
                return run
            raise
    finally:
        _discovery_lock.release()
