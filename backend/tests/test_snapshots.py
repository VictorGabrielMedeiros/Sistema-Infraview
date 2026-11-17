import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.device import Device, DeviceType
from app.models.link import Link, LinkType
from app.models.snapshot import TopologySnapshot
from app.schemas.snapshot import SnapshotCreate
from app.routers.snapshots import create_snapshot, list_snapshots, restore_snapshot, get_snapshot


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # Seed with devices
    d1 = Device(
        id="dev-1",
        mac_address="00:11:22:33:44:55",
        ip_address="192.168.1.1",
        hostname="ROUTER-CORE",
        device_type=DeviceType.router,
        is_active=True,
    )
    d2 = Device(
        id="dev-2",
        mac_address="AA:BB:CC:DD:EE:FF",
        ip_address="192.168.1.50",
        hostname="VICTOR-TI",
        device_type=DeviceType.computer,
        is_active=True,
    )
    session.add_all([d1, d2])
    session.flush()

    l1 = Link(
        id="link-1",
        source_device_id=d1.id,
        target_device_id=d2.id,
        local_port="eth0",
        remote_port="eth1",
        link_type=LinkType.lldp,
        is_active=True,
    )
    session.add(l1)
    session.commit()

    yield session
    session.close()


def test_create_and_list_snapshots(db_session):
    payload = SnapshotCreate(name="Rede Prefeitura", description="Varredura sede")
    created = create_snapshot(payload, db_session)

    assert created.id is not None
    assert created.name == "Rede Prefeitura"
    assert created.device_count == 2
    assert created.link_count == 1
    assert len(created.nodes) == 2
    assert len(created.edges) == 1

    all_snaps = list_snapshots(db_session)
    assert len(all_snaps) == 1
    assert all_snaps[0].name == "Rede Prefeitura"


def test_restore_snapshot(db_session):
    # 1. Create snapshot
    payload = SnapshotCreate(name="Rede Câmara")
    created = create_snapshot(payload, db_session)

    # 2. Simulate new scan changing active devices (e.g. dev-2 becomes inactive, new dev-3 appears)
    d2 = db_session.get(Device, "dev-2")
    d2.is_active = False

    d3 = Device(
        id="dev-3",
        mac_address="11:22:33:44:55:66",
        ip_address="10.0.0.1",
        hostname="OTHER-NET",
        device_type=DeviceType.server,
        is_active=True,
    )
    db_session.add(d3)
    db_session.commit()

    # Active devices are now dev-1 and dev-3
    active_ids = {d.id for d in db_session.query(Device).filter(Device.is_active.is_(True)).all()}
    assert active_ids == {"dev-1", "dev-3"}

    # 3. Restore "Rede Câmara" snapshot
    restored = restore_snapshot(created.id, db_session)
    assert restored.name == "Rede Câmara"

    # Now active devices should be dev-1 and dev-2 again!
    restored_active = {d.id for d in db_session.query(Device).filter(Device.is_active.is_(True)).all()}
    assert restored_active == {"dev-1", "dev-2"}

