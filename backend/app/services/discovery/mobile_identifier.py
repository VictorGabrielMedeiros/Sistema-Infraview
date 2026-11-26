import logging
import re
from dataclasses import dataclass

from app.services.discovery.correlator import CorrelatedDevice
from app.services.discovery.dhcp import read_dhcp_leases
from app.services.discovery.mdns import scan_mdns
from app.services.discovery.oui import is_randomized_mac, lookup_oui_vendor

logger = logging.getLogger(__name__)


@dataclass
class MobileIdentificationResult:
    device_type: str | None = None
    vendor: str | None = None
    model: str | None = None
    hostname: str | None = None
    is_randomized_mac: bool = False
    identification_method: str | None = None
    identification_confidence: str | None = None
    device_category_detail: str | None = None
    extra_sources: list[str] | None = None


def identify_single_device(
    mac: str | None,
    ip: str | None,
    hostname: str | None,
    existing_vendor: str | None,
    existing_model: str | None,
    existing_type: str,
    sources: list[str],
    dhcp_by_mac: dict[str, dict[str, str]],
    mdns_by_ip: dict[str, dict[str, str]],
) -> MobileIdentificationResult:
    res = MobileIdentificationResult(extra_sources=[])
    methods: list[str] = []

    randomized = is_randomized_mac(mac)
    res.is_randomized_mac = randomized

    # 1. Enrich hostname from DHCP leases if missing
    effective_hostname = hostname
    if mac and mac in dhcp_by_mac:
        dhcp_info = dhcp_by_mac[mac]
        if not effective_hostname or effective_hostname == ip:
            effective_hostname = dhcp_info.get("hostname")
            res.hostname = effective_hostname
        res.extra_sources.append("dhcp")
        methods.append("DHCP")

    # 2. Enrich hostname/model from mDNS if available
    mdns_model: str | None = None
    mdns_service: str | None = None
    if ip and ip in mdns_by_ip:
        mdns_info = mdns_by_ip[ip]
        if (not effective_hostname or effective_hostname == ip) and mdns_info.get("hostname"):
            effective_hostname = mdns_info["hostname"]
            res.hostname = effective_hostname
        if mdns_info.get("model"):
            mdns_model = mdns_info["model"]
        mdns_service = mdns_info.get("service_name") or mdns_info.get("service_type")
        res.extra_sources.append("mdns")
        methods.append("mDNS")

    # 3. OUI Vendor lookup (only for non-randomized MACs)
    oui_vendor = lookup_oui_vendor(mac) if mac else None
    if oui_vendor:
        methods.append("OUI (MAC)")
        if not existing_vendor:
            res.vendor = oui_vendor
    elif randomized and not existing_vendor:
        res.vendor = "MAC Privado / Aleatório"

    if effective_hostname and effective_hostname != ip:
        if "Hostname" not in methods:
            methods.append("Hostname")

    # Combine text signals for careful mobile pattern matching
    combined_text = " ".join(
        part for part in (effective_hostname, mdns_model, mdns_service) if part
    ).lower()
    vendor_lower = (res.vendor or existing_vendor or "").lower()

    # Preserve already-established infrastructure / SNMP / LLDP classifications
    if existing_type in ("switch", "router", "firewall", "access_point", "server", "printer"):
        res.identification_method = " + ".join(methods) if methods else (", ".join(sources).upper() or None)
        res.identification_confidence = "alta" if ("lldp" in sources or "snmp" in sources) else "media"
        return res

    # 4. Evidence-based Mobile Identification (never assert brand/model from OUI alone!)

    # --- Apple iPad (Tablet) ---
    if re.search(r"\bipad\b|ipad[-_]", combined_text) or (mdns_model and mdns_model.lower().startswith("ipad")):
        res.device_type = "tablet"
        res.vendor = "Apple"
        res.model = mdns_model or existing_model
        res.device_category_detail = "Tablet (iPad)"
        res.identification_confidence = "alta" if (mdns_model or oui_vendor == "Apple") else "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Apple iPhone (Smartphone) ---
    if re.search(r"\biphone\b|iphone[-_]", combined_text) or (mdns_model and mdns_model.lower().startswith("iphone")):
        res.device_type = "phone"
        res.vendor = "Apple"
        res.model = mdns_model or existing_model
        res.device_category_detail = "Smartphone Apple (iPhone)"
        res.identification_confidence = "alta" if (mdns_model or oui_vendor == "Apple") else "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Generic Tablet (Samsung Tab, Lenovo Tab, Redmi Pad, etc.) ---
    if re.search(r"galaxy[-_\s]?tab|redmi[-_\s]?pad|mi[-_\s]?pad|lenovo[-_\s]?tab|\btablet\b", combined_text):
        res.device_type = "tablet"
        if "galaxy" in combined_text or oui_vendor == "Samsung":
            res.vendor = "Samsung"
        elif "redmi" in combined_text or "mi" in combined_text or oui_vendor == "Xiaomi":
            res.vendor = "Xiaomi"
        res.model = mdns_model or existing_model
        res.device_category_detail = "Tablet"
        res.identification_confidence = "alta" if oui_vendor else "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Samsung Smartphone ---
    samsung_model_match = re.search(r"\b(sm-[a-z0-9]+)\b", combined_text, re.IGNORECASE)
    if (
        re.search(r"galaxy[-_\s]?(s\d|a\d|m\d|z|note|fold|flip)|samsung[-_\s]?(s\d|a\d|m\d|galaxy)", combined_text)
        or samsung_model_match
        or (oui_vendor == "Samsung" and "android" in combined_text)
    ):
        res.device_type = "phone"
        res.vendor = "Samsung"
        if samsung_model_match:
            res.model = samsung_model_match.group(1).upper()
        elif mdns_model:
            res.model = mdns_model
        res.device_category_detail = "Smartphone Samsung"
        res.identification_confidence = "alta" if (oui_vendor == "Samsung" and (samsung_model_match or mdns_model)) else "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Motorola Smartphone ---
    moto_model_match = re.search(r"\b(moto[\s_-]?[gezcx]\d+[a-z0-9]*|motorola[\s_-]?edge[\s_-]?\d+)\b", combined_text, re.IGNORECASE)
    if (
        moto_model_match
        or re.search(r"\bmotorola\b|moto[-_]", combined_text)
        or (oui_vendor == "Motorola" and "android" in combined_text)
    ):
        res.device_type = "phone"
        res.vendor = "Motorola"
        if moto_model_match:
            res.model = moto_model_match.group(1).replace("_", " ").title()
        elif mdns_model:
            res.model = mdns_model
        res.device_category_detail = "Smartphone Motorola"
        res.identification_confidence = "alta" if (oui_vendor == "Motorola" and moto_model_match) else "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Xiaomi Smartphone ---
    xiaomi_model_match = re.search(r"\b(redmi[\s_-]?note[\s_-]?\d+[a-z0-9]*|redmi[\s_-]?[a-z0-9]+|poco[\s_-]?[a-z0-9]+)\b", combined_text, re.IGNORECASE)
    if (
        xiaomi_model_match
        or re.search(r"\bxiaomi\b|\bredmi\b|\bpoco\b", combined_text)
        or (oui_vendor == "Xiaomi" and "android" in combined_text)
    ):
        res.device_type = "phone"
        res.vendor = "Xiaomi"
        if xiaomi_model_match:
            res.model = xiaomi_model_match.group(1).replace("_", " ").title()
        elif mdns_model:
            res.model = mdns_model
        res.device_category_detail = "Smartphone Xiaomi"
        res.identification_confidence = "alta" if (oui_vendor == "Xiaomi" and xiaomi_model_match) else "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Other Mobile Devices (Pixel, OnePlus, Oppo, Realme, generic Android, etc.) ---
    if re.search(r"\b(android|pixel|oneplus|oppo|realme|zenfone|huawei[-_]?p\d|honor)\b", combined_text):
        res.device_type = "phone"
        if "pixel" in combined_text:
            res.vendor = res.vendor or "Google"
        res.model = mdns_model or existing_model
        res.device_category_detail = "Outro Dispositivo Móvel"
        res.identification_confidence = "media"
        res.identification_method = " + ".join(methods) or "Hostname"
        return res

    # --- Private/Randomized MAC without explicit hostname/mDNS ---
    if randomized and existing_type == "unknown":
        res.device_category_detail = "Dispositivo Móvel Não Identificado (MAC Privado)"
        res.identification_confidence = "baixa"
        res.identification_method = " + ".join(methods + ["MAC Privado (LAA)"]) if methods else "MAC Privado (LAA)"
        return res

    # --- Vendor known via OUI alone (insufficient evidence for smartphone model!) ---
    if oui_vendor and existing_type == "unknown":
        res.identification_method = " + ".join(methods)
        res.identification_confidence = "baixa"
        if "apple" in vendor_lower or "samsung" in vendor_lower or "xiaomi" in vendor_lower or "motorola" in vendor_lower:
            res.device_category_detail = f"Dispositivo {oui_vendor} (tipo não confirmado)"
        return res

    if methods:
        res.identification_method = " + ".join(methods)
        res.identification_confidence = "media" if effective_hostname else "baixa"

    return res


def identify_mobile_devices(devices: list[CorrelatedDevice]) -> list[CorrelatedDevice]:
    """
    Runs multi-source mobile identification (OUI, DHCP leases, mDNS, Hostname, Private MAC check)
    across all correlated devices.
    """
    dhcp_by_mac = read_dhcp_leases()
    mdns_by_ip = scan_mdns()

    for item in devices:
        res = identify_single_device(
            mac=item.mac_address,
            ip=item.ip_address,
            hostname=item.hostname,
            existing_vendor=item.vendor,
            existing_model=item.model,
            existing_type=item.device_type,
            sources=item.sources,
            dhcp_by_mac=dhcp_by_mac,
            mdns_by_ip=mdns_by_ip,
        )
        if res.hostname and (not item.hostname or item.hostname == item.ip_address):
            item.hostname = res.hostname
        if res.vendor and not item.vendor:
            item.vendor = res.vendor
        if res.model and not item.model:
            item.model = res.model
        if res.device_type and item.device_type == "unknown":
            item.device_type = res.device_type
        for s in res.extra_sources or []:
            if s not in item.sources:
                item.sources.append(s)

        # Attach metadata attributes for persistence in runner
        item.is_randomized_mac = res.is_randomized_mac  # type: ignore[attr-defined]
        item.identification_method = res.identification_method  # type: ignore[attr-defined]
        item.identification_confidence = res.identification_confidence  # type: ignore[attr-defined]
        item.device_category_detail = res.device_category_detail  # type: ignore[attr-defined]

    return devices
