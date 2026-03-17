from __future__ import annotations

import argparse
import hashlib
import mimetypes
import shutil
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.paths import PROJECT_ROOT, STORAGE_ROOT
from app.db.session import SessionLocal
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.document_processing import process_document

DEFAULT_SOURCE_DIR = PROJECT_ROOT / "Заказ-наряды"
PLACEHOLDER_EXTERNAL_ID = "__batch_import_placeholder__"
SUPPORTED_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}


@dataclass
class ImportStats:
    created: int = 0
    skipped_existing: int = 0
    matched_vehicle: int = 0
    unmatched_vehicle: int = 0
    failed: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "created": self.created,
            "skipped_existing": self.skipped_existing,
            "matched_vehicle": self.matched_vehicle,
            "unmatched_vehicle": self.unmatched_vehicle,
            "failed": self.failed,
        }


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Batch import repair documents from a folder")
    parser.add_argument("--path", default=str(DEFAULT_SOURCE_DIR), help="Folder with source PDF/image files")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of files to import")
    return parser


def iter_source_files(source_dir: Path) -> list[Path]:
    files = [
        path
        for path in source_dir.rglob("*")
        if path.is_file() and not path.name.startswith(".") and path.suffix.lower() in SUPPORTED_SUFFIXES
    ]
    return sorted(files)


def compute_sha1(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def detect_source_type_from_path(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return "pdf"
    return "image"


def build_storage_key_from_hash(file_hash: str, suffix: str) -> str:
    normalized_suffix = suffix.lower()
    return f"documents/batch-import/{file_hash[:2]}/{file_hash}{normalized_suffix}"


def normalize_identifier(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = "".join(ch for ch in value.upper() if ch.isalnum())
    return normalized or None


def get_admin_user(db: Session) -> User:
    preferred_login = (settings.initial_admin_login or "").strip()
    stmt = select(User).where(User.role == UserRole.ADMIN)
    if preferred_login:
        preferred = db.scalar(stmt.where(User.login == preferred_login))
        if preferred is not None:
            return preferred

    admin = db.scalar(stmt.order_by(User.id.asc()))
    if admin is None:
        raise RuntimeError("Admin user not found")
    return admin


def ensure_placeholder_vehicle(db: Session) -> Vehicle:
    existing = db.scalar(select(Vehicle).where(Vehicle.external_id == PLACEHOLDER_EXTERNAL_ID))
    if existing is not None:
        return existing

    vehicle = Vehicle(
        external_id=PLACEHOLDER_EXTERNAL_ID,
        vehicle_type=VehicleType.TRUCK,
        plate_number="IMPORT-QUEUE",
        brand="System",
        model="Batch import placeholder",
        comment="Temporary vehicle for batch-imported documents before OCR vehicle matching",
        status=VehicleStatus.INACTIVE,
    )
    db.add(vehicle)
    db.flush()
    return vehicle


def match_vehicle_from_document(db: Session, document: Document) -> Optional[Vehicle]:
    latest_version = max(document.versions, key=lambda version: version.version_number, default=None)
    parsed_payload = latest_version.parsed_payload if latest_version and isinstance(latest_version.parsed_payload, dict) else {}
    extracted_fields = parsed_payload.get("extracted_fields") if isinstance(parsed_payload.get("extracted_fields"), dict) else {}

    vin = normalize_identifier(str(extracted_fields.get("vin"))) if extracted_fields.get("vin") else None
    plate_number = normalize_identifier(str(extracted_fields.get("plate_number"))) if extracted_fields.get("plate_number") else None
    if not vin and not plate_number:
        return None

    candidates = db.scalars(
        select(Vehicle).where(Vehicle.external_id != PLACEHOLDER_EXTERNAL_ID)
    ).all()

    for vehicle in candidates:
        if vin and normalize_identifier(vehicle.vin) == vin:
            return vehicle
    for vehicle in candidates:
        if plate_number and normalize_identifier(vehicle.plate_number) == plate_number:
            return vehicle
    return None


def create_document_record(
    db: Session,
    *,
    admin_user: User,
    placeholder_vehicle: Vehicle,
    source_path: Path,
    source_root: Path,
    storage_key: str,
) -> int:
    destination = STORAGE_ROOT / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination)

    relative_source_path = source_path.relative_to(source_root).as_posix()
    mime_type = mimetypes.guess_type(source_path.name)[0]

    repair = Repair(
        order_number=None,
        repair_date=date.today(),
        vehicle_id=placeholder_vehicle.id,
        created_by_user_id=admin_user.id,
        mileage=0,
        reason="Batch import from source folder",
        employee_comment=None,
        status=RepairStatus.DRAFT,
        is_preliminary=True,
    )
    db.add(repair)
    db.flush()

    document = Document(
        repair_id=repair.id,
        uploaded_by_user_id=admin_user.id,
        original_filename=source_path.name,
        storage_key=storage_key,
        mime_type=mime_type,
        source_type=detect_source_type_from_path(source_path),
        kind=DocumentKind.ORDER,
        status=DocumentStatus.UPLOADED,
        is_primary=True,
        review_queue_priority=100,
        notes=f"Batch import source: {relative_source_path}",
    )
    db.add(document)
    db.flush()

    repair.source_document_id = document.id
    db.add(
        DocumentVersion(
            document_id=document.id,
            version_number=1,
            storage_key=storage_key,
            parsed_payload={
                "pipeline": "batch_import",
                "document_kind": DocumentKind.ORDER.value,
                "ocr_status": "queued",
                "uploaded_by_user_id": admin_user.id,
                "source_path": relative_source_path,
            },
            field_confidence_map={},
            change_summary="Initial batch import",
        )
    )
    db.commit()
    return document.id


def import_documents_with_session(
    db: Session,
    *,
    source_dir: Path,
    limit: int | None = None,
) -> ImportStats:
    if not source_dir.exists():
        raise FileNotFoundError(f"Source folder not found: {source_dir}")

    stats = ImportStats()
    admin_user = get_admin_user(db)
    placeholder_vehicle = ensure_placeholder_vehicle(db)
    db.commit()

    files = iter_source_files(source_dir)
    if limit is not None:
        files = files[:limit]

    for path in files:
        file_hash = compute_sha1(path)
        storage_key = build_storage_key_from_hash(file_hash, path.suffix)
        existing = db.scalar(select(Document).where(Document.storage_key == storage_key))
        if existing is not None:
            stats.skipped_existing += 1
            continue

        created_document_id: Optional[int] = None
        destination = STORAGE_ROOT / storage_key
        try:
            created_document_id = create_document_record(
                db,
                admin_user=admin_user,
                placeholder_vehicle=placeholder_vehicle,
                source_path=path,
                source_root=source_dir,
                storage_key=storage_key,
            )
            process_document(db, created_document_id)
            document = db.scalar(
                select(Document)
                .where(Document.id == created_document_id)
            )
            if document is None or document.repair is None:
                raise RuntimeError(f"Document {created_document_id} was not reloaded after processing")

            refreshed_document = db.scalar(
                select(Document)
                .where(Document.id == created_document_id)
            )
            if refreshed_document is None or refreshed_document.repair is None:
                raise RuntimeError(f"Document {created_document_id} was not found after OCR")

            vehicle = match_vehicle_from_document(db, refreshed_document)
            if vehicle is not None and refreshed_document.repair.vehicle_id != vehicle.id:
                refreshed_document.repair.vehicle_id = vehicle.id
                db.add(refreshed_document.repair)
                db.commit()
                process_document(db, refreshed_document.id)
                stats.matched_vehicle += 1
            else:
                stats.unmatched_vehicle += 1

            stats.created += 1
        except Exception as exc:
            db.rollback()
            if created_document_id is None and destination.exists():
                destination.unlink()
            stats.failed += 1
            print(f"[FAILED] {path}: {exc}")

    return stats


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()
    source_dir = Path(args.path).expanduser().resolve()

    with SessionLocal() as db:
        stats = import_documents_with_session(db, source_dir=source_dir, limit=args.limit)

    print(stats.as_dict())


if __name__ == "__main__":
    main()
