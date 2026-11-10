import logging

from app.services.discovery.correlator import RawDevice

logger = logging.getLogger(__name__)


def _detect_device_type(sys_descr: str) -> str:
    lower = sys_descr.lower()
    if any(kw in lower for kw in ("printer", "laserjet", "mfp", "xerox")):
        return "printer"
    if any(kw in lower for kw in ("router", "gateway", "cisco ios")):
        return "router"
    if any(kw in lower for kw in ("switch", "catalyst", "bridge")):
        return "switch"
    if any(kw in lower for kw in ("access point", "aironet", "unifi ap", "wireless")):
        return "access_point"
    if any(kw in lower for kw in ("firewall", "fortigate", "pfsense", "asa", "palo alto")):
        return "firewall"
    if any(kw in lower for kw in ("phone", "voip", "sip")):
        return "phone"
    if any(kw in lower for kw in ("server", "esxi", "vmware", "proxmox")):
        return "server"
    if any(kw in lower for kw in ("linux", "windows", "mac os", "workstation", "desktop")):
        return "computer"
    return "unknown"


def enrich_device(device: RawDevice, community: str = "public") -> RawDevice:
    if not device.ip:
        return device

    try:
        from pysnmp.hlapi import (
            CommunityData,
            ContextData,
            ObjectIdentity,
            ObjectType,
            SnmpEngine,
            UdpTransportTarget,
            getCmd,
        )
    except ImportError:
        logger.debug("pysnmp not available")
        return device

    oids = {
        "sysDescr": "1.3.6.1.2.1.1.1.0",
        "sysName": "1.3.6.1.2.1.1.5.0",
    }
    values: dict[str, str] = {}

    try:
        for key, oid in oids.items():
            error_indication, error_status, _error_index, var_binds = next(
                getCmd(
                    SnmpEngine(),
                    CommunityData(community, mpModel=1),
                    UdpTransportTarget((device.ip, 161), timeout=2, retries=1),
                    ContextData(),
                    ObjectType(ObjectIdentity(oid)),
                )
            )
            if error_indication or error_status:
                continue
            values[key] = str(var_binds[0][1])

        if values.get("sysDescr"):
            device.vendor = values["sysDescr"][:128]
            device.model = values["sysDescr"][:128]
            detected = _detect_device_type(values["sysDescr"])
            if detected != "unknown":
                device.device_type = detected

        if values.get("sysName") and not device.hostname:
            device.hostname = values["sysName"]

        if values:
            device.source = "snmp"
    except Exception as exc:
        logger.debug("SNMP failed for %s: %s", device.ip, exc)

    return device


def enrich_devices(devices: list[RawDevice], community: str = "public") -> list[RawDevice]:
    enriched: list[RawDevice] = []
    for device in devices:
        if device.ip:
            snmp_device = RawDevice(
                mac=device.mac,
                ip=device.ip,
                hostname=device.hostname,
                device_type=device.device_type,
                vendor=device.vendor,
                model=device.model,
                chassis_id=device.chassis_id,
                mgmt_ip=device.mgmt_ip,
                source="snmp",
            )
            snmp_result = enrich_device(snmp_device, community)
            merged = RawDevice(
                mac=device.mac,
                ip=device.ip or snmp_result.ip,
                hostname=device.hostname or snmp_result.hostname,
                device_type=snmp_result.device_type if snmp_result.device_type != "unknown" else device.device_type,
                vendor=snmp_result.vendor or device.vendor,
                model=snmp_result.model or device.model,
                chassis_id=device.chassis_id,
                mgmt_ip=device.mgmt_ip,
                source=device.source,
            )
            if snmp_result.vendor:
                merged.source = "snmp" if merged.source == "unknown" else device.source
            enriched.append(merged)
        else:
            enriched.append(device)
    return enriched
