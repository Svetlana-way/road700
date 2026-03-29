from __future__ import annotations

import warnings

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SAWarning
from sqlalchemy.pool import StaticPool


def create_sqlite_test_engine(*, enforce_foreign_keys: bool = False) -> Engine:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    if enforce_foreign_keys:
        _install_sqlite_foreign_keys_pragma(engine)
    return engine


def reset_database(engine: Engine, metadata) -> None:
    with engine.connect() as connection:
        if connection.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")

        with warnings.catch_warnings():
            warnings.filterwarnings(
                "ignore",
                message="Cannot correctly sort tables; there are unresolvable cycles between tables",
                category=SAWarning,
            )
            tables = list(reversed(metadata.sorted_tables))

        for table in tables:
            connection.execute(table.delete())
        connection.commit()

        if connection.dialect.name == "sqlite":
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
            connection.commit()


def _install_sqlite_foreign_keys_pragma(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()
