import re
from dataclasses import dataclass, field


def normalize_mac(mac: str | None) -> str | None:
    if not mac:
        return None
    cleaned = re.sub(r"[^0-9a-fA-F]", "", mac.lower())
    if len(cleaned) != 12:
        return None
    return ":".join(cleaned[i : i + 2] for i in range(0, 12, 2))


@dataclass
class RawDevice:
    mac: str | None = None
    ip: str | None = None
    hostname: str | None = None
    device_type: str = "unknown"
    vendor: str | None = None
    model: str | None = None
    chassis_id: str | None = None
    mgmt_ip: str | None = None
    source: str = "unknown"


@dataclass
class RawLink:
    source_mac: str
    target_mac: str
    local_port: str
    remote_port: str
    link_type: str = "lldp"


@dataclass
class CorrelatedDevice:
    mac_address: str | None
    ip_address: str | None = None
    hostname: str | None = None
    device_type: str = "unknown"
    vendor: str | None = None
    model: str | None = None
    chassis_id: str | None = None
    mgmt_ip: str | None = None
    sources: list[str] = field(default_factory=list)
    ip_source: str | None = None
    hostname_source: str | None = None


def _pick_ip(
    existing: str | None,
    existing_source: str | None,
    candidate: str | None,
    candidate_source: str,
) -> tuple[str | None, str | None]:
    if not candidate:
        return existing, existing_source
    if not existing:
        return candidate, candidate_source
    priority = {"arp": 3, "snmp": 2, "lldp": 1, "ping": 1}
    existing_prio = priority.get(existing_source or "", 0)
    candidate_prio = priority.get(candidate_source, 0)
    if candidate_prio >= existing_prio:
        return candidate, candidate_source
    return existing, existing_source


def _pick_hostname(
    existing: str | None,
    existing_source: str | None,
    candidate: str | None,
    candidate_source: str,
) -> tuple[str | None, str | None]:
    if not candidate:
        return existing, existing_source
    if not existing:
        return candidate, candidate_source
    priority = {"lldp": 3, "snmp": 2, "arp": 1}
    existing_prio = priority.get(existing_source or "", 0)
    candidate_prio = priority.get(candidate_source, 0)
    if candidate_prio >= existing_prio:
        return candidate, candidate_source
    return existing, existing_source


def merge_device(existing: CorrelatedDevice | None, raw: RawDevice) -> CorrelatedDevice:
    if existing is None:
        ip = raw.ip or raw.mgmt_ip
        ip_source = raw.source if ip else None
        hostname = raw.hostname
        hostname_source = raw.source if hostname else None
        return CorrelatedDevice(
            mac_address=normalize_mac(raw.mac),
            ip_address=ip,
            hostname=hostname,
            device_type=raw.device_type or "unknown",
            vendor=raw.vendor,
            model=raw.model,
            chassis_id=raw.chassis_id,
            mgmt_ip=raw.mgmt_ip,
            sources=[raw.source] if raw.source else [],
            ip_source=ip_source,
            hostname_source=hostname_source,
        )

    ip, ip_source = _pick_ip(existing.ip_address, existing.ip_source, raw.ip, raw.source)
    if not ip and raw.mgmt_ip and raw.source == "lldp":
        ip = raw.mgmt_ip
        ip_source = "lldp"

    hostname, hostname_source = _pick_hostname(
        existing.hostname, existing.hostname_source, raw.hostname, raw.source
    )
    sources = list(existing.sources)
    if raw.source and raw.source not in sources:
        sources.append(raw.source)

    device_type = existing.device_type
    if existing.device_type == "unknown" and raw.device_type and raw.device_type != "unknown":
        device_type = raw.device_type

    return CorrelatedDevice(
        mac_address=existing.mac_address or normalize_mac(raw.mac),
        ip_address=ip,
        hostname=hostname,
        device_type=device_type,
        vendor=existing.vendor or raw.vendor,
        model=existing.model or raw.model,
        chassis_id=existing.chassis_id or raw.chassis_id,
        mgmt_ip=existing.mgmt_ip or raw.mgmt_ip,
        sources=sources,
        ip_source=ip_source,
        hostname_source=hostname_source,
    )


def correlate(lldp_devices: list[RawDevice], arp_entries: list[RawDevice]) -> list[CorrelatedDevice]:
    by_mac: dict[str, CorrelatedDevice] = {}
    no_mac: list[CorrelatedDevice] = []

    for device in lldp_devices:
        mac = normalize_mac(device.mac)
        if mac:
            by_mac[mac] = merge_device(by_mac.get(mac), device)
        else:
            no_mac.append(merge_device(None, device))

    for entry in arp_entries:
        mac = normalize_mac(entry.mac)
        if mac:
            by_mac[mac] = merge_device(by_mac.get(mac), entry)

    return list(by_mac.values()) + no_mac
