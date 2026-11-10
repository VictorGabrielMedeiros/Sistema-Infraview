from concurrent.futures import ThreadPoolExecutor, as_completed
import ipaddress
import logging
import platform
import re
import socket
import subprocess

from app.config import settings
from app.services.discovery.correlator import RawDevice

logger = logging.getLogger(__name__)


def _detect_subnet() -> str | None:
    # 1) If user explicitly specified SCAN_SUBNET in .env
    if settings.scan_subnet:
        try:
            net = ipaddress.ip_network(settings.scan_subnet.strip(), strict=False)
            return str(net)
        except ValueError:
            logger.warning("SCAN_SUBNET configurada inválida: %s", settings.scan_subnet)

    # 2) Try Linux `ip -4 route show default`
    try:
        result = subprocess.run(
            ["ip", "-4", "route", "show", "default"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        for line in result.stdout.splitlines():
            parts = line.split()
            if "dev" in parts:
                dev_idx = parts.index("dev")
                iface = parts[dev_idx + 1]
                addr_result = subprocess.run(
                    ["ip", "-4", "addr", "show", iface],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=False,
                )
                match = re.search(r"inet (\d+\.\d+\.\d+\.\d+/\d+)", addr_result.stdout)
                if match:
                    network = ipaddress.ip_network(match.group(1), strict=False)
                    return str(network)
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError):
        pass

    # 3) Fallback socket detection for local IP (/24 assumed)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            if local_ip and not local_ip.startswith("127."):
                network = ipaddress.ip_network(f"{local_ip}/24", strict=False)
                return str(network)
    except Exception:
        pass

    return None


def _ping_host(ip: str) -> str | None:
    is_win = platform.system().lower() == "windows"
    param = "-n" if is_win else "-c"
    timeout_flag = "-w" if is_win else "-W"
    timeout_val = str(settings.ping_timeout_sec * 1000) if is_win else str(settings.ping_timeout_sec)
    try:
        result = subprocess.run(
            ["ping", param, "1", timeout_flag, timeout_val, ip],
            capture_output=True,
            text=True,
            timeout=settings.ping_timeout_sec + 2,
            check=False,
        )
        if result.returncode == 0:
            return ip
    except (subprocess.TimeoutExpired, Exception):
        return None
    return None


def scan_ping() -> tuple[list[RawDevice], str | None]:
    if not settings.ping_enabled:
        return [], None

    subnet = _detect_subnet()
    if not subnet:
        return [], "Não foi possível detectar sub-rede para ping sweep"

    try:
        network = ipaddress.ip_network(subnet, strict=False)
    except ValueError:
        return [], f"Sub-rede inválida: {subnet}"

    # Limit to at most 254 hosts to avoid long blocking sweeps
    hosts = [str(h) for h in list(network.hosts())[:254]]

    found: list[RawDevice] = []
    with ThreadPoolExecutor(max_workers=32) as pool:
        futures = {pool.submit(_ping_host, ip): ip for ip in hosts}
        for future in as_completed(futures):
            ip = future.result()
            if ip:
                found.append(RawDevice(ip=ip, source="ping"))

    logger.info("Ping sweep: %d hosts responded in %s", len(found), subnet)
    return found, None
