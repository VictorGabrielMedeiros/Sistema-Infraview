from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
import re
import socket

from app.services.discovery.correlator import CorrelatedDevice

logger = logging.getLogger(__name__)

# NetBIOS Node Status request for wildcard name '*'
_NETBIOS_REQUEST = (
    b"\x82\x28\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00"
    b"\x20CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\x00"
    b"\x00\x21\x00\x01"
)


def query_netbios_name(ip: str, timeout: float = 0.4) -> str | None:
    """Query NetBIOS Node Status (UDP 137) to get the Windows/Samba computer name."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    try:
        sock.sendto(_NETBIOS_REQUEST, (ip, 137))
        data, _ = sock.recvfrom(1024)
        if len(data) > 57:
            num_names = data[56]
            offset = 57
            for _ in range(num_names):
                if offset + 18 > len(data):
                    break
                name_bytes = data[offset : offset + 15]
                name_type = data[offset + 15]
                flags = int.from_bytes(data[offset + 16 : offset + 18], "big")
                is_group = (flags & 0x8000) != 0

                # 0x00 = Workstation/Computer name; 0x20 = Server service name
                if not is_group and name_type in (0x00, 0x20):
                    name = name_bytes.decode("ascii", errors="ignore").strip()
                    if name and not name.startswith("IS~"):
                        return name
                offset += 18
    except Exception:
        pass
    finally:
        sock.close()
    return None


def query_dns_name(ip: str, timeout: float = 0.4) -> str | None:
    """Query reverse DNS (PTR) record from local DNS/router."""
    old_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(timeout)
        host, _, _ = socket.gethostbyaddr(ip)
        if host and host != ip:
            # If it's a domain-qualified name like VICTOR-TI.local or victor-ti.lan, strip domain if appropriate
            clean_host = host
            if "." in clean_host:
                first_part = clean_host.split(".")[0]
                # If first part looks like a real machine name and not generic IP
                if not re.match(r"^(ip|host|dhcp|node|cpe)-?\d+", first_part, re.IGNORECASE):
                    clean_host = first_part
            return clean_host
    except Exception:
        pass
    finally:
        socket.setdefaulttimeout(old_timeout)
    return None


def _infer_type_from_hostname(hostname: str) -> str | None:
    lower = hostname.lower()

    if any(k in lower for k in ("printer", "print", "impressora", "laserjet", "epson", "brother", "canon")):
        return "printer"
    if any(k in lower for k in ("server", "servidor", "proxmox", "esxi", "storage")):
        return "server"
    if any(k in lower for k in ("switch", "catalyst")):
        return "switch"
    if any(k in lower for k in ("router", "roteador", "gateway", "firewall", "pfsense", "fortigate")):
        return "router"
    if any(k in lower for k in ("accesspoint", "unifi", "aironet")):
        return "access_point"
    if any(k in lower for k in ("hikvision", "dahua", "intelbras", "ipcam", "camera", "nvr", "dvr")):
        return "camera"
    if any(k in lower for k in ("smarttv", "samsung-tv", "lg-tv", "bravia", "roku", "chromecast", "appletv", "firetv")):
        return "tv"
    if any(k in lower for k in ("desktop", "notebook", "laptop", "workstation", "macbook")):
        return "computer"

    # Regex checks with word boundaries / separators for short acronyms
    if re.search(r"[-_](ap|wifi)([-_]|$)", lower) or re.search(r"^(ap|wifi)[-_]", lower):
        return "access_point"
    if re.search(r"[-_](sw)([-_]|$)", lower) or re.search(r"^(sw)[-_]", lower):
        return "switch"
    if re.search(r"[-_](rt)([-_]|$)", lower) or re.search(r"^(rt)[-_]", lower):
        return "router"
    if re.search(r"[-_](srv)([-_]|$)", lower) or re.search(r"^(srv)[-_]", lower):
        return "server"
    if re.search(r"[-_](pc|ti|desk|not)([-_]|$)", lower) or re.search(r"^(pc|ti|desk|not)[-_]", lower):
        return "computer"

    return None


def resolve_single_device(device: CorrelatedDevice) -> None:
    if not device.ip_address:
        return

    # If hostname is already meaningful (not IP or None), keep it
    if device.hostname and device.hostname != device.ip_address:
        return

    # 1. Try NetBIOS first (most reliable for Windows machines on LAN e.g. "VICTOR-TI")
    netbios_name = query_netbios_name(device.ip_address)
    if netbios_name:
        device.hostname = netbios_name
        if "netbios" not in device.sources:
            device.sources.append("netbios")
        if device.device_type == "unknown":
            device.device_type = "computer"
        return

    # 2. Try Reverse DNS
    dns_name = query_dns_name(device.ip_address)
    if dns_name:
        device.hostname = dns_name
        if "dns" not in device.sources:
            device.sources.append("dns")
        inferred = _infer_type_from_hostname(dns_name)
        if inferred and device.device_type == "unknown":
            device.device_type = inferred


def resolve_hostnames(devices: list[CorrelatedDevice]) -> list[CorrelatedDevice]:
    """Resolve NetBIOS and DNS names for all discovered devices in parallel."""
    target_devices = [d for d in devices if d.ip_address]
    if not target_devices:
        return devices

    workers = min(32, max(4, len(target_devices)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(resolve_single_device, d) for d in target_devices]
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as exc:
                logger.debug("Error resolving hostname: %s", exc)

    return devices
