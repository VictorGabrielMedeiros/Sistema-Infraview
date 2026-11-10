import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    # Ensure directory exists for file-based SQLite
    db_file = settings.database_url.replace("sqlite:///", "").split("?")[0]
    if db_file and db_file != ":memory:":
        from pathlib import Path
        db_path = Path(db_file)
        if not db_path.is_absolute():
            db_path = Path.cwd() / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)

connect_args: dict = {}
if _is_sqlite:
    # timeout = seconds waiting when DB is busy (avoids instant "database is locked")
    connect_args = {"check_same_thread": False, "timeout": 60}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)


if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_add_columns() -> None:
    """Add new columns to existing tables if they don't exist (lightweight migration)."""
    insp = inspect(engine)
    if not insp.has_table("devices"):
        return

    existing_cols = {col["name"] for col in insp.get_columns("devices")}
    migrations: list[str] = []

    if "display_name" not in existing_cols:
        migrations.append("ALTER TABLE devices ADD COLUMN display_name VARCHAR(255)")
    if "icon_type" not in existing_cols:
        migrations.append("ALTER TABLE devices ADD COLUMN icon_type VARCHAR(32)")

    if migrations:
        with engine.begin() as conn:
            for sql in migrations:
                logger.info("Running migration: %s", sql)
                conn.execute(text(sql))
        logger.info("Database migration complete: added %d column(s)", len(migrations))


def init_db() -> None:
    from app.models import device, discovery_run, link  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()
    if _is_sqlite:
        with engine.connect() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL"))
            conn.commit()
