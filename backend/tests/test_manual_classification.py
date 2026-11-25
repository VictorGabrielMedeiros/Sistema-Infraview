import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.device import Device, DeviceType
from app.routers.devices import update_device
from app.schemas.device import DeviceUpdate
from app.services.discovery.correlator import CorrelatedDevice
from app.services.discovery.runner import _upsert_device


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()


def test_manual_classification_persists_across_discovery_and_restores(db_session):
    # 1. Discovery creates a device automatically classified as computer
    correlated = CorrelatedDevice(
        mac_address="AA:BB:CC:DD:EE:01",
        ip_address="192.168.1.50",
        hostname="HP-LASER-FINANCEIRO",
        device_type="computer",
        sources=["netbios"],
    )
    device = _upsert_device(db_session, correlated)
    db_session.commit()

    assert device.device_type == DeviceType.computer
    assert device.auto_device_type == DeviceType.computer
    assert device.manual_device_type is None

    # 2. User manually overrides type to printer
    updated = update_device(
        device.id,
        DeviceUpdate(device_type=DeviceType.printer),
        db_session,
    )
    assert updated.device_type == DeviceType.printer
    assert updated.manual_device_type == DeviceType.printer
    assert updated.auto_device_type == DeviceType.computer

    # 3. New discovery runs and reports computer (or server via SNMP) -> must NOT overwrite manual
    re_discovered = CorrelatedDevice(
        mac_address="AA:BB:CC:DD:EE:01",
        ip_address="192.168.1.50",
        hostname="HP-LASER-FINANCEIRO",
        device_type="server",
        sources=["snmp"],
    )
    after_scan = _upsert_device(db_session, re_discovered)
    db_session.commit()

    assert after_scan.device_type == DeviceType.printer
    assert after_scan.manual_device_type == DeviceType.printer
    assert after_scan.auto_device_type == DeviceType.server

    # 4. User restores automatic classification
    restored = update_device(
        device.id,
        DeviceUpdate(restore_auto_type=True),
        db_session,
    )
    assert restored.manual_device_type is None
    assert restored.device_type == DeviceType.server
