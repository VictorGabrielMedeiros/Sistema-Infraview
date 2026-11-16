import json
import logging
import subprocess

from app.services.discovery.arp import get_interface_macs
from app.services.discovery.correlator import RawDevice, RawLink, normalize_mac

logger = logging.getLogger(__name__)


# LLDP-MED capabilities and system capabilities used for type detection
_CAPABILITY_TYPE_MAP = {
    "Router": "router",
    "Bridge": "switch",
    "Station": "computer",
    "WLAN Access Point": "access_point",
    "Telephone": "phone",
    "Repeater": "switch",
    "Docsis cable device": "unknown",
}


def _detect_type_from_capabilities(chassis: dict) -> str:
    """Detect device type from LLDP capabilities TLV."""
    cap = chassis.get("capability")
    if not cap:
        return ""

    if isinstance(cap, dict):
        cap = [cap]

    enabled_caps: list[str] = []
    for c in cap:
        if isinstance(c, dict):
            if c.get("enabled", False) or c.get("enabled") == "on":
                cap_type = c.get("type", "")
                enabled_caps.append(cap_type)
        elif isinstance(c, str):
            enabled_caps.append(c)

    # Priority: Router > WLAN AP > Switch/Bridge > Telephone > Station
    for cap_name in ["Router", "WLAN Access Point", "Bridge", "Telephone", "Station", "Repeater"]:
        if cap_name in enabled_caps:
            return _CAPABILITY_TYPE_MAP.get(cap_name, "unknown")

    return ""


def _detect_type_from_description(descr_val: str) -> str:
    """Detect device type from sysDescr string."""
    lower = descr_val.lower()
    if any(kw in lower for kw in ("router", "gateway", "cisco ios")):
        return "router"
    if any(kw in lower for kw in ("switch", "bridge", "catalyst")):
        return "switch"
    if any(kw in lower for kw in ("printer", "laserjet", "mfp", "xerox")):
        return "printer"
    if any(kw in lower for kw in ("server", "esxi", "vmware", "proxmox")):
        return "server"
    if any(kw in lower for kw in ("access point", "aironet", "unifi ap", "wireless")):
        return "access_point"
    if any(kw in lower for kw in ("firewall", "fortigate", "pfsense", "asa", "palo alto")):
        return "firewall"
    if any(kw in lower for kw in ("phone", "voip", "sip")):
        return "phone"
    if any(kw in lower for kw in ("windows", "linux", "mac os", "workstation", "desktop")):
        return "computer"
    return ""


def _extract_str(obj, key: str, default: str = "") -> str:
    """Safely extract a string value from a nested dict/str field."""
    val = obj.get(key)
    if val is None:
        return default
    if isinstance(val, dict):
        return val.get("value", default)
    return str(val)


def _extract_mgmt_ip(chassis: dict) -> str | None:
    """Extract management IP from different lldpctl formats."""
    # Try "mgmt-ip" first (lldpctl >= 1.0)
    for key in ("mgmt-ip", "mgmt_ip", "management-address"):
        mgmt = chassis.get(key)
        if mgmt is None:
            continue
        if isinstance(mgmt, list) and mgmt:
            first = mgmt[0]
            return first.get("value") if isinstance(first, dict) else str(first)
        if isinstance(mgmt, dict):
            return mgmt.get("value")
        if isinstance(mgmt, str):
            return mgmt
    return None


def _extract_remote_port(chassis: dict) -> str:
    """Extract remote port from LLDP neighbor data."""
    port = chassis.get("port", {})
    if isinstance(port, list):
        port = port[0] if port else {}

    # Try port ID
    port_id = port.get("id")
    if isinstance(port_id, dict):
        val = port_id.get("value", "")
        if val:
            return val
    elif port_id and isinstance(port_id, str):
        return port_id

    # Try port description
    port_descr = port.get("descr")
    if isinstance(port_descr, dict):
        return port_descr.get("value", "")
    if isinstance(port_descr, str):
        return port_descr

    return ""


def _parse_lldp_neighbor(chassis: dict, local_port: str, local_mac: str | None) -> tuple[RawDevice | None, RawLink | None]:
    """Parse a single LLDP neighbor into a RawDevice and optional RawLink."""
    mac = None
    chassis_id_field = chassis.get("id", {})
    if isinstance(chassis_id_field, dict):
        if chassis_id_field.get("type") == "mac":
            mac = chassis_id_field.get("value")
        chassis_id_val = chassis_id_field.get("value")
    else:
        chassis_id_val = str(chassis_id_field)

    # System name
    sysname = _extract_str(chassis, "name") or None

    # Management IP
    mgmt_ip = _extract_mgmt_ip(chassis)

    # Remote port
    remote_port = _extract_remote_port(chassis)

    # Device type detection: capabilities > description > default
    device_type = _detect_type_from_capabilities(chassis)

    descr_val = _extract_str(chassis, "descr")
    if not device_type and descr_val:
        device_type = _detect_type_from_description(descr_val)

    if not device_type:
        device_type = "switch"  # LLDP neighbors are typically network gear

    normalized_mac = normalize_mac(mac)
    device = RawDevice(
        mac=mac,
        hostname=sysname,
        device_type=device_type,
        vendor=descr_val[:128] if descr_val else None,
        chassis_id=chassis_id_val,
        mgmt_ip=mgmt_ip,
        source="lldp",
    )

    link = None
    if normalized_mac and local_mac:
        link = RawLink(
            source_mac=local_mac,
            target_mac=normalized_mac,
            local_port=local_port,
            remote_port=remote_port or "unknown",
        )

    return device, link


def _parse_lldp_json(data: list | dict, iface_macs: dict[str, str]) -> tuple[list[RawDevice], list[RawLink]]:
    """Parse the JSON output from lldpctl.

    Handles multiple format variants:
    - lldpd < 1.0.x: {"lldp": {"interface": [...]}}
    - lldpd 1.0.x+: {"lldp": [{"interface": ...}]} or {"lldp": {"interface": {name: {...}}}}
    - Flat list of interfaces
    """
    devices: list[RawDevice] = []
    links: list[RawLink] = []

    # Navigate to the interface list from various wrapper formats
    if isinstance(data, dict):
        lldp = data.get("lldp", data)
        if isinstance(lldp, dict):
            interfaces = lldp.get("interface", [])
        elif isinstance(lldp, list):
            # lldpd 1.0.x wraps in a list
            interfaces = []
            for item in lldp:
                if isinstance(item, dict):
                    iface_data = item.get("interface", item)
                    if isinstance(iface_data, list):
                        interfaces.extend(iface_data)
                    elif isinstance(iface_data, dict):
                        interfaces.append(iface_data)
                    else:
                        interfaces.append(item)
        else:
            interfaces = []
    elif isinstance(data, list):
        interfaces = data
    else:
        return [], []

    # Normalize interfaces to a list of dicts
    if isinstance(interfaces, dict):
        # lldpd sometimes puts interfaces as {name: {chassis data...}}
        if all(isinstance(v, dict) for v in interfaces.values()):
            # Check if it looks like {iface_name: {chassis: ...}} format
            has_chassis_keys = any("chassis" in v for v in interfaces.values())
            if has_chassis_keys:
                interfaces = [{"name": k, **v} for k, v in interfaces.items()]
            else:
                interfaces = [interfaces]
        else:
            interfaces = [interfaces]

    for iface in interfaces:
        if not isinstance(iface, dict):
            continue

        local_port = iface.get("name", "unknown")
        # lldpd >= 1.0.18 changed format: interface is {name: {port: {}, chassis: {}}}
        # If "name" is not a string key but the only key is the iface name
        if "name" not in iface and len(iface) == 1:
            local_port = next(iter(iface.keys()))
            iface = iface[local_port]
            if not isinstance(iface, dict):
                continue

        local_mac = iface_macs.get(local_port) or iface_macs.get(local_port.split("@")[0])

        # Find neighbors: can be under "chassis" or directly embedded
        neighbors = iface.get("chassis", [])
        if isinstance(neighbors, dict):
            # Could be {chassis_name: {id: ...}} or {id: ..., name: ...}
            if "id" in neighbors:
                neighbors = [neighbors]
            else:
                # {chassis_name: {id: ..., name: ...}} format
                neighbors = list(neighbors.values()) if all(isinstance(v, dict) for v in neighbors.values()) else [neighbors]

        if not isinstance(neighbors, list):
            neighbors = [neighbors] if neighbors else []

        for chassis in neighbors:
            if not isinstance(chassis, dict):
                continue
            device, link = _parse_lldp_neighbor(chassis, local_port, local_mac)
            if device:
                devices.append(device)
            if link:
                links.append(link)

    return devices, links


def _find_cmd(name: str) -> str:
    import shutil
    found = shutil.which(name)
    if found:
        return found
    for p in [f"/usr/sbin/{name}", f"/sbin/{name}", f"/usr/bin/{name}", f"/bin/{name}"]:
        import os
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return name


def scan_lldp() -> tuple[list[RawDevice], list[RawLink], str | None]:
    """Run lldpctl and parse the results.

    Tries lldpctl first, then lldpcli as fallback.
    """
    cmds = [
        [_find_cmd("lldpctl"), "-f", "json"],
        [_find_cmd("lldpcli"), "-f", "json", "show", "neighbors"],
    ]

    for cmd in cmds:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )
            if result.returncode != 0:
                warning = result.stderr.strip() or f"{cmd[0]} failed"
                logger.warning("LLDP scan failed with %s: %s", cmd[0], warning)
                continue

            raw = result.stdout.strip()
            if not raw:
                logger.warning("LLDP scan returned empty output from %s", cmd[0])
                continue

            data = json.loads(raw)
            iface_macs = get_interface_macs()
            devices, links = _parse_lldp_json(data, iface_macs)
            logger.info("LLDP scan via %s: %d devices, %d links", cmd[0], len(devices), len(links))
            return devices, links, None
        except (FileNotFoundError, PermissionError) as exc:
            logger.warning("LLDP scan execution error with %s: %s", cmd[0], exc)
            continue
        except json.JSONDecodeError as exc:
            logger.warning("LLDP JSON parse error from %s: %s", cmd[0], exc)
            continue
        except subprocess.TimeoutExpired:
            logger.warning("LLDP scan timed out for %s", cmd[0])
            continue

    return [], [], "lldpctl/lldpcli não encontrado ou falhou — instale lldpd (Linux)"
