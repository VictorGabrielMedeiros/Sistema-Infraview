import os
import platform
import shutil
import subprocess

from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/system", tags=["system"])


def _find_binary(name: str) -> str | None:
    found = shutil.which(name)
    if found:
        return found
    fallbacks = [
        f"/usr/sbin/{name}",
        f"/sbin/{name}",
        f"/usr/bin/{name}",
        f"/bin/{name}",
        f"/usr/local/sbin/{name}",
        f"/usr/local/bin/{name}",
    ]
    for p in fallbacks:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


@router.get("/info")
def system_info():
    lldp_bin = _find_binary("lldpctl") or _find_binary("lldpcli")
    lldpd_installed = lldp_bin is not None

    ip_bin = _find_binary("ip")
    ip_cmd = ip_bin is not None

    lldpd_running = False
    if lldpd_installed:
        # 1. Tentar via systemctl
        sysctl_bin = _find_binary("systemctl")
        if sysctl_bin:
            try:
                result = subprocess.run(
                    [sysctl_bin, "is-active", "lldpd"],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                lldpd_running = result.stdout.strip() == "active"
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass

        # 2. Verificar socket de comunicação do daemon lldpd
        if not lldpd_running:
            socket_paths = [
                "/run/lldpd.socket",
                "/var/run/lldpd.socket",
                "/run/lldpd/lldpd.socket",
                "/var/run/lldpd/lldpd.socket",
            ]
            if any(os.path.exists(sp) for sp in socket_paths):
                lldpd_running = True

        # 3. Teste direto via lldpctl
        if not lldpd_running and lldp_bin:
            try:
                res = subprocess.run([lldp_bin], capture_output=True, timeout=2)
                if b"cannot connect" not in res.stderr.lower():
                    lldpd_running = True
            except Exception:
                pass

    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "platform": platform.system(),
        "platform_release": platform.release(),
        "python_version": platform.python_version(),
        "lldpd_installed": lldpd_installed,
        "lldpd_running": lldpd_running,
        "ip_command": ip_cmd,
        "ping_enabled": settings.ping_enabled,
        "scan_subnet": settings.scan_subnet,
        "snmp_community_configured": bool(settings.snmp_community),
    }
