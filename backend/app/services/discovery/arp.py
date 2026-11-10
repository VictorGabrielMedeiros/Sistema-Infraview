import logging
import re
import subprocess

from app.services.discovery.correlator import RawDevice, normalize_mac

logger = logging.getLogger(__name__)

NEIGH_LINE = re.compile(
    r"^(?P<ip>\d+\.\d+\.\d+\.\d+)\s+dev\s+\S+\s+lladdr\s+(?P<mac>[0-9a-f:]+)\s+(?P<state>\S+)",
    re.IGNORECASE,
)

VALID_STATES = {"REACHABLE", "STALE", "DELAY", "PROBE", "PERMANENT"}


def scan_arp() -> tuple[list[RawDevice], str | None]:
    try:
        result = subprocess.run(
            ["ip", "neigh", "show"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if result.returncode != 0:
            warning = result.stderr.strip() or "ip neigh failed"
            logger.warning("ARP scan failed: %s", warning)
            return [], warning

        entries: list[RawDevice] = []
        for line in result.stdout.splitlines():
            match = NEIGH_LINE.match(line.strip())
            if match and match.group("state").upper() in VALID_STATES:
                entries.append(
                    RawDevice(
                        mac=match.group("mac"),
                        ip=match.group("ip"),
                        source="arp",
                    )
                )
        return entries, None
    except FileNotFoundError:
        return [], "Comando 'ip' não encontrado — requer Linux"
    except subprocess.TimeoutExpired as exc:
        return [], str(exc)


def get_interface_macs() -> dict[str, str]:
    """Map interface name -> MAC address."""
    mapping: dict[str, str] = {}
    try:
        result = subprocess.run(
            ["ip", "-o", "link", "show"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and "link/ether" in line:
                iface = parts[1].rstrip(":")
                idx = parts.index("link/ether")
                if idx + 1 < len(parts):
                    mac = normalize_mac(parts[idx + 1])
                    if mac:
                        mapping[iface] = mac
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return mapping
