from __future__ import annotations

import json
import shutil
import tempfile
import uuid
import zipfile
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, Float, Integer, Numeric, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from app.core.paths import STORAGE_ROOT
from app.db.base import Base
from app.db.session import engine
from app.models.audit import AuditLog


BACKUP_DIR = STORAGE_ROOT / "backups"
BACKUP_FORMAT = "road700_backup_v1"
DATABASE_SNAPSHOT_ENTRY = "database.json"
BACKUP_MANIFEST_SUFFIX = ".manifest.json"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_backup_dir() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def build_backup_id() -> str:
    return f"{utc_now().strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:8]}"


def archive_path_for(backup_id: str) -> Path:
    return BACKUP_DIR / f"{backup_id}.zip"


def manifest_path_for(backup_id: str) -> Path:
    return BACKUP_DIR / f"{backup_id}{BACKUP_MANIFEST_SUFFIX}"


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    return value


def deserialize_value(column, value: Any) -> Any:
    if value is None:
        return None

    column_type = column.type
    if isinstance(column_type, DateTime) and isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(column_type, Date) and isinstance(value, str):
        return date.fromisoformat(value)
    if isinstance(column_type, Numeric):
        return Decimal(str(value))
    if isinstance(column_type, SqlEnum):
        enum_class = getattr(column_type, "enum_class", None)
        return enum_class(value) if enum_class is not None else value
    if isinstance(column_type, Boolean):
        return bool(value)
    if isinstance(column_type, Integer):
        return int(value)
    if isinstance(column_type, Float):
        return float(value)
    return value


def iter_storage_files() -> list[Path]:
    if not STORAGE_ROOT.exists():
        return []

    files: list[Path] = []
    for path in STORAGE_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if BACKUP_DIR in path.parents:
            continue
        files.append(path)
    return sorted(files)


def build_database_snapshot(db: Session) -> dict[str, Any]:
    tables_payload: list[dict[str, Any]] = []
    for table in Base.metadata.sorted_tables:
        rows = db.execute(select(table)).mappings().all()
        tables_payload.append(
            {
                "table": table.name,
                "rows": [
                    {column_name: serialize_value(value) for column_name, value in row.items()}
                    for row in rows
                ],
            }
        )
    return {
        "format": BACKUP_FORMAT,
        "created_at": utc_now().isoformat(),
        "tables": tables_payload,
    }


def write_manifest(manifest: dict[str, Any]) -> None:
    manifest_path_for(manifest["backup_id"]).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def read_manifest(manifest_path: Path) -> dict[str, Any]:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def manifest_to_item(manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "backup_id": str(manifest["backup_id"]),
        "filename": str(manifest["filename"]),
        "created_at": manifest["created_at"],
        "backup_type": str(manifest.get("backup_type") or "full"),
        "source": str(manifest.get("source") or "manual"),
        "status": str(manifest.get("status") or "ready"),
        "size_bytes": int(manifest.get("size_bytes") or 0),
        "storage_files_total": int(manifest.get("storage_files_total") or 0),
        "tables_total": int(manifest.get("tables_total") or 0),
    }


def list_backup_items() -> list[dict[str, Any]]:
    ensure_backup_dir()
    items: list[dict[str, Any]] = []
    for manifest_path in BACKUP_DIR.glob(f"*{BACKUP_MANIFEST_SUFFIX}"):
        manifest = read_manifest(manifest_path)
        archive_path = archive_path_for(str(manifest["backup_id"]))
        if not archive_path.exists():
            manifest["status"] = "missing"
            manifest["size_bytes"] = 0
        items.append(manifest_to_item(manifest))
    items.sort(key=lambda item: (item["created_at"], item["backup_id"]), reverse=True)
    return items


def create_backup_archive(db: Session, *, source: str = "manual") -> dict[str, Any]:
    ensure_backup_dir()
    backup_id = build_backup_id()
    created_at = utc_now()
    archive_path = archive_path_for(backup_id)
    snapshot = build_database_snapshot(db)
    storage_files = iter_storage_files()

    with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            DATABASE_SNAPSHOT_ENTRY,
            json.dumps(snapshot, ensure_ascii=False, indent=2),
        )
        for file_path in storage_files:
            relative_path = file_path.relative_to(STORAGE_ROOT)
            archive.write(file_path, arcname=f"storage/{relative_path.as_posix()}")

    manifest = {
        "backup_id": backup_id,
        "filename": archive_path.name,
        "created_at": created_at.isoformat(),
        "backup_type": "full",
        "source": source,
        "status": "ready",
        "size_bytes": archive_path.stat().st_size,
        "storage_files_total": len(storage_files),
        "tables_total": len(snapshot["tables"]),
    }
    write_manifest(manifest)
    return manifest_to_item(manifest)


def load_backup_item_or_raise(backup_id: str) -> dict[str, Any]:
    manifest_path = manifest_path_for(backup_id)
    if not manifest_path.exists():
        raise FileNotFoundError("Backup manifest not found")
    manifest = read_manifest(manifest_path)
    return manifest_to_item(manifest)


def load_database_snapshot(backup_id: str) -> dict[str, Any]:
    archive_path = archive_path_for(backup_id)
    if not archive_path.exists():
        raise FileNotFoundError("Backup archive not found")
    with zipfile.ZipFile(archive_path, mode="r") as archive:
        payload = json.loads(archive.read(DATABASE_SNAPSHOT_ENTRY).decode("utf-8"))
    if payload.get("format") != BACKUP_FORMAT:
        raise ValueError("Unsupported backup format")
    return payload


def restore_database_snapshot(connection: Connection, snapshot: dict[str, Any]) -> None:
    tables_by_name = {table.name: table for table in Base.metadata.sorted_tables}
    for table in reversed(Base.metadata.sorted_tables):
        connection.execute(table.delete())

    for table_payload in snapshot.get("tables", []):
        table = tables_by_name.get(str(table_payload.get("table")))
        if table is None:
            continue
        rows = []
        for row in table_payload.get("rows", []):
            converted_row = {}
            for column in table.columns:
                if column.name in row:
                    converted_row[column.name] = deserialize_value(column, row[column.name])
            rows.append(converted_row)
        if rows:
            connection.execute(table.insert(), rows)


def reset_postgres_sequences(connection: Connection) -> None:
    if connection.dialect.name != "postgresql":
        return

    for table in Base.metadata.sorted_tables:
        primary_keys = list(table.primary_key.columns)
        if len(primary_keys) != 1:
            continue
        primary_key = primary_keys[0]
        if not isinstance(primary_key.type, Integer):
            continue
        connection.execute(
            text(
                f"SELECT setval("
                f"pg_get_serial_sequence('{table.name}', '{primary_key.name}'), "
                f"COALESCE((SELECT MAX({primary_key.name}) FROM {table.name}), 1), "
                f"COALESCE((SELECT MAX({primary_key.name}) IS NOT NULL FROM {table.name}), false)"
                f")"
            )
        )


def extract_storage_snapshot_to_temp(backup_id: str) -> Path:
    archive_path = archive_path_for(backup_id)
    if not archive_path.exists():
        raise FileNotFoundError("Backup archive not found")

    temp_dir = Path(tempfile.mkdtemp(prefix="road700-backup-", dir=BACKUP_DIR))
    with zipfile.ZipFile(archive_path, mode="r") as archive:
        for member in archive.namelist():
            if not member.startswith("storage/") or member.endswith("/"):
                continue
            relative_name = member.removeprefix("storage/")
            relative_path = Path(relative_name)
            if ".." in relative_path.parts:
                continue
            destination = temp_dir / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member, mode="r") as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)
    return temp_dir


def replace_storage_with_snapshot(snapshot_dir: Path) -> None:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    for child in STORAGE_ROOT.iterdir():
        if child == BACKUP_DIR:
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()

    for child in snapshot_dir.iterdir():
        destination = STORAGE_ROOT / child.name
        shutil.move(str(child), str(destination))


def restore_backup_archive(
    backup_id: str,
    *,
    requested_by_login: str,
    requested_by_user_id: int | None,
) -> dict[str, Any]:
    backup_item = load_backup_item_or_raise(backup_id)
    snapshot = load_database_snapshot(backup_id)
    extracted_storage_dir = extract_storage_snapshot_to_temp(backup_id)
    restored_at = utc_now()

    try:
        with engine.begin() as connection:
            restore_database_snapshot(connection, snapshot)
            reset_postgres_sequences(connection)
            connection.execute(
                AuditLog.__table__.insert().values(
                    user_id=None,
                    entity_type="system",
                    entity_id="backups",
                    action_type="backup_restored",
                    old_value=None,
                    new_value={
                        "backup_id": backup_id,
                        "filename": backup_item["filename"],
                        "requested_by_user_id": requested_by_user_id,
                        "requested_by_login": requested_by_login,
                        "restored_at": restored_at.isoformat(),
                    },
                    created_at=restored_at,
                    updated_at=restored_at,
                )
            )

        replace_storage_with_snapshot(extracted_storage_dir)
    finally:
        shutil.rmtree(extracted_storage_dir, ignore_errors=True)

    return backup_item
