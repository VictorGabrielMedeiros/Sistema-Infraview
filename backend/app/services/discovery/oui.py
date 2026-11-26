import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_OUI_JSON_PATH = Path(__file__).resolve().parents[2] / "data" / "oui_vendors.json"
_SYSTEM_OUI_PATHS = (
    Path("/usr/share/ieee-data/oui.txt"),
    Path("/usr/share/misc/oui.txt"),
    Path("/var/lib/ieee-data/oui.txt"),
)

_oui_cache: dict[str, str] | None = None


def _load_oui_db() -> dict[str, str]:
    global _oui_cache
    if _oui_cache is not None:
        return _oui_cache

    db: dict[str, str] = {}

    # 1. Optional system IEEE OUI database if installed on Linux
    for sys_path in _SYSTEM_OUI_PATHS:
        try:
            if sys_path.exists():
                with sys_path.open("r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if "(hex)" in line:
                            parts = line.split("(hex)")
                            if len(parts) == 2:
                                prefix = parts[0].strip().replace("-", ":").upper()
                                vendor = parts[1].strip()
                                if len(prefix) == 8 and vendor:
                                    db[prefix] = vendor
                break
        except Exception as exc:
            logger.debug("Failed reading system OUI file %s: %s", sys_path, exc)

    # 2. Local bundled & updatable JSON database (overrides verbose IEEE names with clean ones)
    try:
        if _OUI_JSON_PATH.exists():
            with _OUI_JSON_PATH.open("r", encoding="utf-8") as f:
                local_data = json.load(f)
                for k, v in local_data.items():
                    db[str(k).upper().strip()] = str(v).strip()
    except Exception as exc:
        logger.warning("Failed reading local OUI database %s: %s", _OUI_JSON_PATH, exc)

    _oui_cache = db
    return db


def is_randomized_mac(mac: str | None) -> bool:
    """
    Returns True if the MAC address is locally administered (LAA) / randomized/private.
    In IEEE 802, bit 1 (0x02) of the first octet indicates a locally administered address,
    which iOS 14+ and Android 10+ use for Private Wi-Fi Addresses.
    """
    if not mac:
        return False
    clean = mac.replace(":", "").replace("-", "").replace(".", "").strip()
    if len(clean) < 2:
        return False
    try:
        first_octet = int(clean[:2], 16)
        return (first_octet & 0x02) != 0
    except ValueError:
        return False


def lookup_oui_vendor(mac: str | None) -> str | None:
    """Looks up the manufacturer name from the first 3 octets (OUI) of a MAC address."""
    if not mac:
        return None
    if is_randomized_mac(mac):
        return None
    clean = mac.replace(":", "").replace("-", "").replace(".", "").upper().strip()
    if len(clean) < 6:
        return None
    prefix = f"{clean[0:2]}:{clean[2:4]}:{clean[4:6]}"
    return _load_oui_db().get(prefix)
