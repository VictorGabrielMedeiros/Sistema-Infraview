import logging
import re
import shutil
import subprocess

logger = logging.getLogger(__name__)


def scan_mdns(timeout_sec: int = 3) -> dict[str, dict[str, str]]:
    """
    Discovers device names and model metadata announced via mDNS (Avahi) on the LAN.
    Returns mapping of IP address -> {"hostname": ..., "model": ..., "service": ...}.
    """
    results: dict[str, dict[str, str]] = {}

    avahi_bin = shutil.which("avahi-browse")
    if not avahi_bin:
        return results

    try:
        proc = subprocess.run(
            [avahi_bin, "-artp"],
            capture_output=True,
            text=True,
            timeout=timeout_sec + 2,
            check=False,
        )
        if proc.returncode != 0 or not proc.stdout:
            return results

        for line in proc.stdout.splitlines():
            # Parseable format: =;iface;IPv4;Name;Service;Domain;hostname.local;192.168.1.50;port;"txt1" "txt2"
            if not line.startswith("="):
                continue
            parts = line.split(";")
            if len(parts) < 9:
                continue
            proto = parts[2]
            if proto != "IPv4":
                continue

            svc_name = parts[3].strip()
            svc_type = parts[4].strip()
            mdns_host = parts[6].replace(".local", "").strip()
            ip = parts[7].strip()
            txt_raw = parts[9] if len(parts) > 9 else ""

            if not ip:
                continue

            entry = results.setdefault(ip, {})
            if mdns_host and not entry.get("hostname"):
                entry["hostname"] = mdns_host
            if svc_name and not entry.get("service_name"):
                entry["service_name"] = svc_name
            if svc_type:
                entry["service_type"] = svc_type

            # Extract Apple/mobile model=... from TXT records
            model_match = re.search(r'"model=([^"]+)"', txt_raw)
            if model_match and not entry.get("model"):
                entry["model"] = model_match.group(1).strip()

    except Exception as exc:
        logger.debug("mDNS scan skipped/failed: %s", exc)

    return results
