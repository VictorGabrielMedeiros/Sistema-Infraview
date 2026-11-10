from app.services.discovery.correlator import (
    RawDevice,
    correlate,
    merge_device,
    normalize_mac,
)


def test_normalize_mac():
    assert normalize_mac("00:1A:2B:3C:4D:5E") == "00:1a:2b:3c:4d:5e"
    assert normalize_mac("00-1a-2b-3c-4d-5e") == "00:1a:2b:3c:4d:5e"
    assert normalize_mac("001a.2b3c.4d5e") == "00:1a:2b:3c:4d:5e"
    assert normalize_mac("invalid") is None
    assert normalize_mac(None) is None


def test_correlate_merges_lldp_and_arp_by_mac():
    lldp = [
        RawDevice(mac="00:1a:2b:3c:4d:02", hostname="rt-gateway", device_type="router", source="lldp"),
    ]
    arp = [
        RawDevice(mac="00:1a:2b:3c:4d:02", ip="192.168.1.254", hostname="rt-gateway", source="arp"),
    ]
    result = correlate(lldp, arp)
    assert len(result) == 1
    assert result[0].ip_address == "192.168.1.254"
    assert "lldp" in result[0].sources
    assert "arp" in result[0].sources


def test_correlate_adds_arp_only_device():
    result = correlate([], [RawDevice(mac="00:1a:2b:3c:4d:09", ip="192.168.1.101", source="arp")])
    assert len(result) == 1
    assert result[0].ip_address == "192.168.1.101"


def test_merge_device_ip_priority():
    # LLDP has priority 1, ARP has priority 3, SNMP has priority 2
    existing = merge_device(None, RawDevice(mac="aa:bb:cc:dd:ee:01", ip="10.0.0.1", source="lldp"))
    assert existing.ip_source == "lldp"

    # SNMP (2) should override LLDP (1)
    with_snmp = merge_device(existing, RawDevice(mac="aa:bb:cc:dd:ee:01", ip="10.0.0.50", source="snmp"))
    assert with_snmp.ip_address == "10.0.0.50"
    assert with_snmp.ip_source == "snmp"

    # ARP (3) should override SNMP (2)
    merged = merge_device(with_snmp, RawDevice(mac="aa:bb:cc:dd:ee:01", ip="10.0.0.99", source="arp"))
    assert merged.ip_address == "10.0.0.99"
    assert merged.ip_source == "arp"

    # LLDP (1) should NOT override ARP (3)
    after_lldp = merge_device(merged, RawDevice(mac="aa:bb:cc:dd:ee:01", ip="10.0.0.1", source="lldp"))
    assert after_lldp.ip_address == "10.0.0.99"
    assert after_lldp.ip_source == "arp"


def test_merge_device_hostname_priority():
    # ARP has hostname priority 1, SNMP 2, LLDP 3
    existing = merge_device(None, RawDevice(mac="aa:bb:cc:dd:ee:02", hostname="host-from-arp", source="arp"))
    assert existing.hostname == "host-from-arp"

    # SNMP (2) overrides ARP (1)
    with_snmp = merge_device(existing, RawDevice(mac="aa:bb:cc:dd:ee:02", hostname="host-from-snmp", source="snmp"))
    assert with_snmp.hostname == "host-from-snmp"

    # LLDP (3) overrides SNMP (2)
    with_lldp = merge_device(with_snmp, RawDevice(mac="aa:bb:cc:dd:ee:02", hostname="host-from-lldp", source="lldp"))
    assert with_lldp.hostname == "host-from-lldp"

    # ARP (1) does NOT override LLDP (3)
    after_arp = merge_device(with_lldp, RawDevice(mac="aa:bb:cc:dd:ee:02", hostname="new-arp", source="arp"))
    assert after_arp.hostname == "host-from-lldp"
