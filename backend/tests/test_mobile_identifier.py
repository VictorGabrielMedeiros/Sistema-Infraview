from app.services.discovery.mobile_identifier import identify_single_device
from app.services.discovery.oui import is_randomized_mac, lookup_oui_vendor


def test_randomized_mac_detection():
    # Bit 1 (0x02) set in first octet -> locally administered / randomized MAC
    assert is_randomized_mac("02:11:22:33:44:55") is True
    assert is_randomized_mac("DA:A1:19:00:11:22") is True
    # Standard universal Apple OUI (0x28 -> bit 1 is 0)
    assert is_randomized_mac("28:CF:DA:11:22:33") is False


def test_oui_only_does_not_overclaim_iphone_or_samsung():
    # Apple OUI alone without hostname/mDNS must NOT claim iPhone
    apple_res = identify_single_device(
        mac="28:CF:DA:11:22:33",
        ip="192.168.1.40",
        hostname=None,
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={},
    )
    assert apple_res.vendor == "Apple"
    assert apple_res.model is None
    assert apple_res.device_type is None
    assert apple_res.identification_confidence == "baixa"

    # Samsung OUI alone without mobile hostname must NOT claim Smartphone Samsung
    samsung_res = identify_single_device(
        mac="00:16:32:11:22:33",
        ip="192.168.1.41",
        hostname=None,
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={},
    )
    assert samsung_res.vendor == "Samsung"
    assert samsung_res.model is None
    assert samsung_res.device_type is None
    assert samsung_res.identification_confidence == "baixa"


def test_identifies_iphone_with_mdns_and_private_mac():
    res = identify_single_device(
        mac="DA:A1:19:AA:BB:CC",
        ip="192.168.1.88",
        hostname=None,
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={
            "192.168.1.88": {
                "hostname": "iPhone-de-Victor",
                "model": "iPhone15,2",
                "service_type": "_apple-mobdev2._tcp",
            }
        },
    )
    assert res.is_randomized_mac is True
    assert res.device_type == "phone"
    assert res.vendor == "Apple"
    assert res.model == "iPhone15,2"
    assert res.device_category_detail == "Smartphone Apple (iPhone)"
    assert res.identification_confidence == "alta"


def test_identifies_samsung_motorola_xiaomi_and_tablet():
    sam = identify_single_device(
        mac="00:16:32:11:22:33",
        ip="192.168.1.90",
        hostname="Galaxy-S23-SM-S911B",
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={},
    )
    assert sam.device_type == "phone"
    assert sam.vendor == "Samsung"
    assert sam.model == "SM-S911B"
    assert sam.device_category_detail == "Smartphone Samsung"
    assert sam.identification_confidence == "alta"

    moto = identify_single_device(
        mac="14:1A:A3:11:22:33",
        ip="192.168.1.91",
        hostname="moto-g84-5g",
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={},
    )
    assert moto.device_type == "phone"
    assert moto.vendor == "Motorola"
    assert moto.device_category_detail == "Smartphone Motorola"

    xiaomi = identify_single_device(
        mac="64:CC:2E:11:22:33",
        ip="192.168.1.92",
        hostname="Redmi-Note-12",
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={},
    )
    assert xiaomi.device_type == "phone"
    assert xiaomi.vendor == "Xiaomi"
    assert xiaomi.device_category_detail == "Smartphone Xiaomi"

    tab = identify_single_device(
        mac="28:CF:DA:99:88:77",
        ip="192.168.1.93",
        hostname="iPad-Diretoria",
        existing_vendor=None,
        existing_model=None,
        existing_type="unknown",
        sources=["arp"],
        dhcp_by_mac={},
        mdns_by_ip={},
    )
    assert tab.device_type == "tablet"
    assert tab.vendor == "Apple"
    assert tab.device_category_detail == "Tablet (iPad)"
