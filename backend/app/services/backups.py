from __future__ import annotations

import json
import re
import shutil
import tempfile
import uuid
import warnings
import zipfile
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum as SqlEnum, Float, Integer, Numeric, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.exc import SAWarning
from sqlalchemy.orm import Session

from app.core.paths import get_storage_root
from app.core.security import rotate_auth_session_epoch
from app.db.base import Base
from app.db.session import engine
from app.models.audit import AuditLog


BACKUP_FORMAT = "road700_backup_v1"
DATABASE_SNAPSHOT_ENTRY = "database.json"
BACKUP_MANIFEST_SUFFIX = ".manifest.json"
REPAIR_DOCUMENT_CYCLE_TABLES = ("repairs", "documents")
REPAIR_DOCUMENT_CYCLE_DEPENDENCIES = ("users", "vehicles", "services")
BACKUP_INCLUDED_SECTIONS = ("database", "storage_files")
BACKUP_EXCLUDED_SECTIONS = ("backup_archives",)
BACKUP_RESTORE_EFFECTS = ("replace_database", "replace_storage_files", "keep_backup_archives", "relogin_required")
BACKUP_ID_PATTERN = re.compile(r"^\d{8}T\d{6}Z_[0-9a-f]{8}$")


class InvalidBackupIdError(ValueError):
    pass


class CorruptBackupError(ValueError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_backup_dir() -> Path:
    return get_storage_root() / "backups"


def ensure_backup_dir() -> None:
    get_backup_dir().mkdir(parents=True, exist_ok=True)


def build_backup_id() -> str:
    return f"{utc_now().strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:8]}"


def validate_backup_id(backup_id: str) -> str:
    normalized_backup_id = str(backup_id).strip()
    if not BACKUP_ID_PATTERN.fullmatch(normalized_backup_id):
        raise InvalidBackupIdError("Invalid backup id")
    return normalized_backup_id


def resolve_backup_path(backup_id: str, suffix: str) -> Path:
    normalized_backup_id = validate_backup_id(backup_id)
    backup_dir = get_backup_dir().resolve()
    candidate = (backup_dir / f"{normalized_backup_id}{suffix}").resolve()
    try:
        candidate.relative_to(backup_dir)
    except ValueError as error:
        raise InvalidBackupIdError("Invalid backup id") from error
    return candidate


def archive_path_for(backup_id: str) -> Path:
    return resolve_backup_path(backup_id, ".zip")


def manifest_path_for(backup_id: str) -> Path:
    return resolve_backup_path(backup_id, BACKUP_MANIFEST_SUFFIX)


def resolve_snapshot_member_path(base_dir: Path, relative_name: str) -> Path | None:
    if not relative_name:
        return None
    relative_path = Path(relative_name)
    if relative_path.is_absolute():
        return None

    base_dir = base_dir.resolve()
    candidate = (base_dir / relative_path).resolve()
    try:
        candidate.relative_to(base_dir)
    except ValueError:
        return None
    return candidate


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
    storage_root = get_storage_root()
    backup_dir = get_backup_dir()
    if not storage_root.exists():
        return []

    files: list[Path] = []
    for path in storage_root.rglob("*"):
        if not path.is_file():
            continue
        if backup_dir in path.parents:
            continue
        files.append(path)
    return sorted(files)


def get_backup_table_order() -> list:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Cannot correctly sort tables; there are unresolvable cycles between tables",
            category=SAWarning,
        )
        sorted_tables = list(Base.metadata.sorted_tables)

    cycle_tables_by_name = {table.name: table for table in sorted_tables if table.name in REPAIR_DOCUMENT_CYCLE_TABLES}
    if len(cycle_tables_by_name) < 2:
        return sorted_tables

    non_cycle_tables = [table for table in sorted_tables if table.name not in cycle_tables_by_name]
    dependency_indexes = [
        index
        for index, table in enumerate(non_cycle_tables)
        if table.name in REPAIR_DOCUMENT_CYCLE_DEPENDENCIES
    ]
    insert_index = (max(dependency_indexes) + 1) if dependency_indexes else 0

    return [
        *non_cycle_tables[:insert_index],
        *(cycle_tables_by_name[name] for name in REPAIR_DOCUMENT_CYCLE_TABLES if name in cycle_tables_by_name),
        *non_cycle_tables[insert_index:],
    ]


def build_database_snapshot(db: Session) -> dict[str, Any]:
    tables_payload: list[dict[str, Any]] = []
    for table in get_backup_table_order():
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
    manifest_path = manifest_path_for(manifest["backup_id"])
    temp_path = manifest_path.with_name(f".{manifest_path.name}.{uuid.uuid4().hex}.tmp")
    temp_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temp_path.replace(manifest_path)


def read_manifest(manifest_path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CorruptBackupError("Backup manifest is corrupt") from error

    if not isinstance(payload, dict):
        raise CorruptBackupError("Backup manifest is corrupt")

    raw_backup_id = payload.get("backup_id")
    if not isinstance(raw_backup_id, str):
        raise CorruptBackupError("Backup manifest is corrupt")

    try:
        backup_id = validate_backup_id(raw_backup_id)
    except InvalidBackupIdError as error:
        raise CorruptBackupError("Backup manifest is corrupt") from error

    manifest_name = manifest_path.name
    if manifest_name.endswith(BACKUP_MANIFEST_SUFFIX):
        expected_backup_id = manifest_name.removesuffix(BACKUP_MANIFEST_SUFFIX)
        try:
            normalized_expected_backup_id = validate_backup_id(expected_backup_id)
        except InvalidBackupIdError:
            normalized_expected_backup_id = None
        if normalized_expected_backup_id is not None and normalized_expected_backup_id != backup_id:
            raise CorruptBackupError("Backup manifest id mismatch")

    payload["backup_id"] = backup_id
    return payload


def manifest_to_item(manifest: dict[str, Any]) -> dict[str, Any]:
    def coerce_manifest_literal_list(value: Any, *, allowed: tuple[str, ...]) -> list[str]:
        if not isinstance(value, list):
            return list(allowed)
        items = [item for item in value if isinstance(item, str) and item in allowed]
        return list(dict.fromkeys(items)) or list(allowed)

    try:
        backup_id = validate_backup_id(str(manifest["backup_id"]))
    except (KeyError, InvalidBackupIdError, TypeError) as error:
        raise CorruptBackupError("Backup manifest is corrupt") from error

    raw_created_at = manifest.get("created_at")
    if isinstance(raw_created_at, datetime):
        created_at = raw_created_at.isoformat()
    elif isinstance(raw_created_at, str):
        try:
            created_at = datetime.fromisoformat(raw_created_at).isoformat()
        except ValueError as error:
            raise CorruptBackupError("Backup manifest is corrupt") from error
    else:
        raise CorruptBackupError("Backup manifest is corrupt")

    try:
        return {
            "backup_id": backup_id,
            "filename": str(manifest["filename"]),
            "created_at": created_at,
            "backup_type": str(manifest.get("backup_type") or "full"),
            "source": str(manifest.get("source") or "manual"),
            "status": str(manifest.get("status") or "ready"),
            "size_bytes": int(manifest.get("size_bytes") or 0),
            "storage_files_total": int(manifest.get("storage_files_total") or 0),
            "tables_total": int(manifest.get("tables_total") or 0),
            "included_sections": coerce_manifest_literal_list(
                manifest.get("included_sections"),
                allowed=BACKUP_INCLUDED_SECTIONS,
            ),
            "excluded_sections": coerce_manifest_literal_list(
                manifest.get("excluded_sections"),
                allowed=BACKUP_EXCLUDED_SECTIONS,
            ),
            "restore_effects": coerce_manifest_literal_list(
                manifest.get("restore_effects"),
                allowed=BACKUP_RESTORE_EFFECTS,
            ),
        }
    except (KeyError, TypeError, ValueError) as error:
        raise CorruptBackupError("Backup manifest is corrupt") from error


def build_corrupt_backup_item(manifest_path: Path) -> dict[str, Any] | None:
    manifest_name = manifest_path.name
    if not manifest_name.endswith(BACKUP_MANIFEST_SUFFIX):
        return None

    backup_id = manifest_name.removesuffix(BACKUP_MANIFEST_SUFFIX)
    try:
        normalized_backup_id = validate_backup_id(backup_id)
    except InvalidBackupIdError:
        return None

    archive_path = archive_path_for(normalized_backup_id)
    created_at = datetime.fromtimestamp(manifest_path.stat().st_mtime, tz=timezone.utc).isoformat()
    return {
        "backup_id": normalized_backup_id,
        "filename": archive_path.name,
        "created_at": created_at,
        "backup_type": "full",
        "source": "manual",
        "status": "corrupt",
        "size_bytes": archive_path.stat().st_size if archive_path.exists() else 0,
        "storage_files_total": 0,
        "tables_total": 0,
        "included_sections": list(BACKUP_INCLUDED_SECTIONS),
        "excluded_sections": list(BACKUP_EXCLUDED_SECTIONS),
        "restore_effects": list(BACKUP_RESTORE_EFFECTS),
    }


def list_backup_items() -> list[dict[str, Any]]:
    ensure_backup_dir()
    backup_dir = get_backup_dir()
    items: list[dict[str, Any]] = []
    for manifest_path in backup_dir.glob(f"*{BACKUP_MANIFEST_SUFFIX}"):
        try:
            manifest = read_manifest(manifest_path)
            archive_path = archive_path_for(str(manifest["backup_id"]))
            if not archive_path.exists():
                manifest["status"] = "missing"
                manifest["size_bytes"] = 0
            items.append(manifest_to_item(manifest))
        except CorruptBackupError:
            corrupt_item = build_corrupt_backup_item(manifest_path)
            if corrupt_item is not None:
                items.append(corrupt_item)
    items.sort(key=lambda item: (item["created_at"], item["backup_id"]), reverse=True)
    return items


def create_backup_archive(db: Session, *, source: str = "manual") -> dict[str, Any]:
    ensure_backup_dir()
    backup_id = build_backup_id()
    created_at = utc_now()
    archive_path = archive_path_for(backup_id)
    snapshot = build_database_snapshot(db)
    storage_files = iter_storage_files()
    storage_root = get_storage_root()

    with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            DATABASE_SNAPSHOT_ENTRY,
            json.dumps(snapshot, ensure_ascii=False, indent=2),
        )
        for file_path in storage_files:
            relative_path = file_path.relative_to(storage_root)
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
        "included_sections": list(BACKUP_INCLUDED_SECTIONS),
        "excluded_sections": list(BACKUP_EXCLUDED_SECTIONS),
        "restore_effects": list(BACKUP_RESTORE_EFFECTS),
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
    try:
        with zipfile.ZipFile(archive_path, mode="r") as archive:
            payload = json.loads(archive.read(DATABASE_SNAPSHOT_ENTRY).decode("utf-8"))
    except (OSError, zipfile.BadZipFile, KeyError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise CorruptBackupError("Backup archive is corrupt") from error
    if not isinstance(payload, dict):
        raise CorruptBackupError("Backup archive is corrupt")
    if payload.get("format") != BACKUP_FORMAT:
        raise CorruptBackupError("Unsupported backup format")
    tables = payload.get("tables")
    if not isinstance(tables, list):
        raise CorruptBackupError("Backup archive is corrupt")
    for table_payload in tables:
        if not isinstance(table_payload, dict):
            raise CorruptBackupError("Backup archive is corrupt")
        if not isinstance(table_payload.get("table"), str):
            raise CorruptBackupError("Backup archive is corrupt")
        rows = table_payload.get("rows")
        if not isinstance(rows, list):
            raise CorruptBackupError("Backup archive is corrupt")
        for row in rows:
            if not isinstance(row, dict):
                raise CorruptBackupError("Backup archive is corrupt")
    return payload


def restore_database_snapshot(connection: Connection, snapshot: dict[str, Any]) -> None:
    ordered_tables = get_backup_table_order()
    tables_by_name = {table.name: table for table in ordered_tables}
    repairs_table = tables_by_name.get("repairs")
    documents_table = tables_by_name.get("documents")

    if repairs_table is not None:
        connection.execute(repairs_table.update().values(source_document_id=None))
    if documents_table is not None:
        connection.execute(documents_table.update().values(repair_id=None))

    for table in reversed(ordered_tables):
        connection.execute(table.delete())

    deferred_repair_source_updates: list[tuple[int, int]] = []
    deferred_document_repair_updates: list[tuple[int, int]] = []

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

            if table.name == "repairs":
                source_document_id = converted_row.get("source_document_id")
                repair_id = converted_row.get("id")
                if source_document_id is not None and repair_id is not None:
                    deferred_repair_source_updates.append((int(repair_id), int(source_document_id)))
                    converted_row["source_document_id"] = None

            if table.name == "documents":
                repair_id = converted_row.get("repair_id")
                document_id = converted_row.get("id")
                if repair_id is not None and document_id is not None:
                    deferred_document_repair_updates.append((int(document_id), int(repair_id)))
                    converted_row["repair_id"] = None

            rows.append(converted_row)
        if rows:
            connection.execute(table.insert(), rows)

    if repairs_table is not None:
        for repair_id, source_document_id in deferred_repair_source_updates:
            connection.execute(
                repairs_table.update()
                .where(repairs_table.c.id == repair_id)
                .values(source_document_id=source_document_id)
            )

    if documents_table is not None:
        for document_id, repair_id in deferred_document_repair_updates:
            connection.execute(
                documents_table.update()
                .where(documents_table.c.id == document_id)
                .values(repair_id=repair_id)
            )


def reset_postgres_sequences(connection: Connection) -> None:
    if connection.dialect.name != "postgresql":
        return

    for table in get_backup_table_order():
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

    temp_dir = Path(tempfile.mkdtemp(prefix="road700-backup-", dir=get_backup_dir()))
    try:
        with zipfile.ZipFile(archive_path, mode="r") as archive:
            for member in archive.namelist():
                if not member.startswith("storage/") or member.endswith("/"):
                    continue
                relative_name = member.removeprefix("storage/")
                destination = resolve_snapshot_member_path(temp_dir, relative_name)
                if destination is None:
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member, mode="r") as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target)
        return temp_dir
    except (OSError, zipfile.BadZipFile, KeyError) as error:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise CorruptBackupError("Backup archive is corrupt") from error


def move_storage_children(source_dir: Path, destination_dir: Path) -> None:
    destination_dir.mkdir(parents=True, exist_ok=True)
    if not source_dir.exists():
        return

    for child in source_dir.iterdir():
        destination = destination_dir / child.name
        if destination.exists():
            if destination.is_dir():
                shutil.rmtree(destination)
            else:
                destination.unlink()
        shutil.move(str(child), str(destination))


def snapshot_current_storage_to_temp() -> Path:
    ensure_backup_dir()
    storage_root = get_storage_root()
    backup_dir = get_backup_dir()
    temp_dir = Path(tempfile.mkdtemp(prefix="road700-storage-current-", dir=backup_dir))
    storage_root.mkdir(parents=True, exist_ok=True)
    for child in storage_root.iterdir():
        if child == backup_dir:
            continue
        destination = temp_dir / child.name
        shutil.move(str(child), str(destination))
    return temp_dir


def replace_storage_with_snapshot(snapshot_dir: Path) -> None:
    storage_root = get_storage_root()
    backup_dir = get_backup_dir()
    storage_root.mkdir(parents=True, exist_ok=True)
    for child in storage_root.iterdir():
        if child == backup_dir:
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
    move_storage_children(snapshot_dir, storage_root)


def restore_backup_archive(
    backup_id: str,
    *,
    requested_by_login: str,
    requested_by_user_id: int | None,
) -> dict[str, Any]:
    backup_item = load_backup_item_or_raise(backup_id)
    snapshot = load_database_snapshot(backup_id)
    extracted_storage_dir = extract_storage_snapshot_to_temp(backup_id)
    current_storage_dir = snapshot_current_storage_to_temp()
    restored_at = utc_now()

    try:
        replace_storage_with_snapshot(extracted_storage_dir)
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
        except Exception:
            replace_storage_with_snapshot(current_storage_dir)
            raise
        rotate_auth_session_epoch()
    finally:
        shutil.rmtree(extracted_storage_dir, ignore_errors=True)
        shutil.rmtree(current_storage_dir, ignore_errors=True)

    return backup_item
