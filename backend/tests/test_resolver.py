from app.services.discovery.correlator import CorrelatedDevice
from app.services.discovery.resolver import _infer_type_from_hostname, resolve_single_device


def test_infer_type_from_hostname():
    assert _infer_type_from_hostname("VICTOR-TI") == "computer"
    assert _infer_type_from_hostname("DESKTOP-ABC123") == "computer"
    assert _infer_type_from_hostname("NOTEBOOK-DELL") == "computer"
    assert _infer_type_from_hostname("PRINTER-HP-LASER") == "printer"
    assert _infer_type_from_hostname("SRV-DATABASE") == "server"
    assert _infer_type_from_hostname("SW-CORE-01") == "switch"
    assert _infer_type_from_hostname("RT-GATEWAY") == "router"
    assert _infer_type_from_hostname("AP-RECEPCAO") == "access_point"
    assert _infer_type_from_hostname("unknown-device") is None


def test_resolve_single_device_preserves_existing_hostname():
    device = CorrelatedDevice(
        mac_address="00:11:22:33:44:55",
        ip_address="192.168.1.100",
        hostname="EXISTING-SERVER",
        device_type="server",
    )
    resolve_single_device(device)
    assert device.hostname == "EXISTING-SERVER"
    assert device.device_type == "server"

