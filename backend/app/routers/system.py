import platform
import shutil
import subprocess

from fastapi import APIRouter

from app.config import settings

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/info")
def system_info():
    lldpd = shutil.which("lldpctl") is not None
    ip_cmd = shutil.which("ip") is not None

    lldpd_running = False
    if lldpd:
        try:
            result = subprocess.run(
                ["systemctl", "is-active", "lldpd"],
                capture_output=True,
                text=True,
                timeout=3,
            )
            lldpd_running = result.stdout.strip() == "active"
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "platform": platform.system(),
        "platform_release": platform.release(),
        "python_version": platform.python_version(),
        "lldpd_installed": lldpd,
        "lldpd_running": lldpd_running,
        "ip_command": ip_cmd,
        "ping_enabled": settings.ping_enabled,
        "scan_subnet": settings.scan_subnet,
        "snmp_community_configured": bool(settings.snmp_community),
    }
