import logging
from pathlib import Path

from app.services.discovery.correlator import normalize_mac

logger = logging.getLogger(__name__)

_DNSMASQ_LEASE_FILES = (
    Path("/var/lib/misc/dnsmasq.leases"),
    Path("/tmp/dnsmasq.leases"),
    Path("/var/lib/NetworkManager/dnsmasq-eth0.leases"),
)
_ISC_DHCP_LEASE_FILES = (
    Path("/var/lib/dhcp/dhcpd.leases"),
    Path("/var/lib/dhcp3/dhcpd.leases"),
)


def read_dhcp_leases() -> dict[str, dict[str, str]]:
    """
    Reads local DHCP lease files (dnsmasq / isc-dhcpd) when available on the server.
    Returns a dict keyed by normalized MAC address and IP address containing hostname.
    """
    by_mac: dict[str, dict[str, str]] = {}

    for path in _DNSMASQ_LEASE_FILES:
        try:
            if not path.exists():
                continue
            for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                parts = line.split()
                # Format: <expiry> <mac> <ip> <hostname> <client-id>
                if len(parts) >= 4:
                    mac = normalize_mac(parts[1])
                    ip = parts[2]
                    hostname = parts[3]
                    if mac and hostname and hostname != "*":
                        by_mac[mac] = {"ip": ip, "hostname": hostname, "source": "dhcp"}
        except Exception as exc:
            logger.debug("Error reading dnsmasq lease %s: %s", path, exc)

    for path in _ISC_DHCP_LEASE_FILES:
        try:
            if not path.exists():
                continue
            current_ip: str | None = None
            current_mac: str | None = None
            current_host: str | None = None
            for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = raw.strip()
                if line.startswith("lease ") and line.endswith("{"):
                    current_ip = line.split()[1]
                    current_mac = None
                    current_host = None
                elif line.startswith("hardware ethernet ") and current_ip:
                    current_mac = normalize_mac(line.replace("hardware ethernet ", "").rstrip(";").strip())
                elif line.startswith("client-hostname ") and current_ip:
                    current_host = line.replace("client-hostname ", "").rstrip(";").strip().strip('"')
                elif line == "}":
                    if current_mac and current_host:
                        by_mac[current_mac] = {
                            "ip": current_ip or "",
                            "hostname": current_host,
                            "source": "dhcp",
                        }
                    current_ip = None
        except Exception as exc:
            logger.debug("Error reading isc-dhcp lease %s: %s", path, exc)

    return by_mac
