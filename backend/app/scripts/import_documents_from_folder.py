from __future__ import annotations

import argparse
import hashlib
import mimetypes
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.constants.vehicles import PLACEHOLDER_EXTERNAL_ID
from app.core.config import settings
from app.core.paths import PROJECT_ROOT, resolve_storage_path
from app.db.session import SessionLocal
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.application.imports.document_processing_runner import start_and_run_document_processing
from app.services.document_parsers.field_extractors import normalize_compare_token, normalize_plate_compare_token
from app.services.document_repair_relations import normalize_repair_primary_document

DEFAULT_SOURCE_DIR = PROJECT_ROOT / "Заказ-наряды"
SUPPORTED_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}
PLATE_PATTERN = re.compile(
    r"(?:[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}|[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{4}\d{2,3})",
    re.IGNORECASE,
)
VIN_PATTERN = re.compile(r"\b[A-HJ-NPR-Z0-9]{17}\b", re.IGNORECASE)


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


def process_document(db: Session, document_id: int) -> None:
    """Compatibility hook kept for tests and legacy patch-points."""
    start_and_run_document_processing(db, document_id)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Batch import repair documents from a folder")
    parser.add_argument("--path", default=str(DEFAULT_SOURCE_DIR), help="Folder with source PDF/image files")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of files to import")
    parser.add_argument(
        "--retry-unmatched-only",
        action="store_true",
        help="Retry vehicle matching for already imported documents linked to the placeholder vehicle",
    )
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


def extract_identifiers_from_text(value: Optional[str]) -> tuple[list[str], list[str]]:
    if not value:
        return [], []
    text = value.upper()
    plate_numbers = [
        normalized
        for normalized in (normalize_plate_compare_token(match) for match in PLATE_PATTERN.findall(text))
        if normalized
    ]
    vins = [normalized for normalized in (normalize_compare_token(match) for match in VIN_PATTERN.findall(text)) if normalized]
    return list(dict.fromkeys(plate_numbers)), list(dict.fromkeys(vins))


def get_admin_user(db: Session) -> User:
    preferred_login = (settings.initial_admin_login or "").strip().lower()
    stmt = select(User).where(User.role == UserRole.ADMIN)
    if preferred_login:
        preferred = db.scalar(stmt.where(func.lower(User.login) == preferred_login))
        if preferred is not None:
            return preferred

    admin = db.scalar(stmt.order_by(User.id.asc()))
    if admin is None:
        raise RuntimeError("Admin user not found")
    return admin


def ensure_placeholder_vehicle(db: Session) -> Vehicle:
    existing = db.scalar(select(Vehicle).where(Vehicle.external_id == PLACEHOLDER_EXTERNAL_ID))
    if existing is not None:
        if existing.status == VehicleStatus.ARCHIVED:
            raise RuntimeError("Archived placeholder vehicle cannot be used for batch import")
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


def build_vehicle_lookup(db: Session) -> tuple[dict[str, Vehicle], dict[str, Vehicle]]:
    vehicles = db.scalars(
        select(Vehicle).where(
            Vehicle.external_id != PLACEHOLDER_EXTERNAL_ID,
            Vehicle.status != VehicleStatus.ARCHIVED,
        )
    ).all()
    by_vin: dict[str, Vehicle] = {}
    by_plate: dict[str, Vehicle] = {}
    for vehicle in vehicles:
        vin = normalize_compare_token(vehicle.vin)
        plate = normalize_plate_compare_token(vehicle.plate_number)
        if vin and vin not in by_vin:
            by_vin[vin] = vehicle
        if plate and plate not in by_plate:
            by_plate[plate] = vehicle
    return by_vin, by_plate


def match_vehicle_from_document(
    db: Session,
    document: Document,
    *,
    by_vin: dict[str, Vehicle],
    by_plate: dict[str, Vehicle],
) -> Optional[Vehicle]:
    latest_version = max(document.versions, key=lambda version: version.version_number, default=None)
    parsed_payload = latest_version.parsed_payload if latest_version and isinstance(latest_version.parsed_payload, dict) else {}
    extracted_fields = parsed_payload.get("extracted_fields") if isinstance(parsed_payload.get("extracted_fields"), dict) else {}

    candidates_vin: list[str] = []
    candidates_plate: list[str] = []

    vin = normalize_compare_token(str(extracted_fields.get("vin"))) if extracted_fields.get("vin") else None
    plate_number = normalize_plate_compare_token(str(extracted_fields.get("plate_number"))) if extracted_fields.get("plate_number") else None
    if vin:
        candidates_vin.append(vin)
    if plate_number:
        candidates_plate.append(plate_number)

    filename_plates, filename_vins = extract_identifiers_from_text(document.original_filename)
    candidates_plate.extend(filename_plates)
    candidates_vin.extend(filename_vins)

    for candidate in candidates_vin:
        vehicle = by_vin.get(candidate)
        if vehicle is not None:
            return vehicle
    for candidate in candidates_plate:
        vehicle = by_plate.get(candidate)
        if vehicle is not None:
            return vehicle
    return None


def rebind_document_vehicle(
    db: Session,
    document: Document,
    *,
    by_vin: dict[str, Vehicle],
    by_plate: dict[str, Vehicle],
) -> bool:
    if (
        document.repair is None
        or document.status == DocumentStatus.ARCHIVED
        or document.repair.status == RepairStatus.ARCHIVED
        or document.repair.vehicle is None
        or document.repair.vehicle.status == VehicleStatus.ARCHIVED
        or (document.repair.service is not None and document.repair.service.status == ServiceStatus.ARCHIVED)
    ):
        return False

    vehicle = match_vehicle_from_document(db, document, by_vin=by_vin, by_plate=by_plate)
    if vehicle is None or document.repair.vehicle_id == vehicle.id:
        return False

    document.repair.vehicle_id = vehicle.id
    db.add(document.repair)
    process_document(db, document.id)
    return True


def create_document_record(
    db: Session,
    *,
    admin_user: User,
    placeholder_vehicle: Vehicle,
    source_path: Path,
    source_root: Path,
    storage_key: str,
    destination: Path,
) -> int:
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
        is_primary=False,
        review_queue_priority=100,
        notes=f"Batch import source: {relative_source_path}",
    )
    db.add(document)
    db.flush()

    normalize_repair_primary_document(repair)
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
    db.flush()
    return document.id


def import_documents_with_session(
    db: Session,
    *,
    source_dir: Path,
    limit: int | None = None,
    on_error: Callable[[Path, Exception], None] | None = None,
) -> ImportStats:
    if not source_dir.exists():
        raise FileNotFoundError(f"Source folder not found: {source_dir}")

    stats = ImportStats()
    admin_user = get_admin_user(db)
    placeholder_vehicle = ensure_placeholder_vehicle(db)
    db.commit()
    by_vin, by_plate = build_vehicle_lookup(db)

    files = iter_source_files(source_dir)
    if limit is not None:
        files = files[:limit]

    for path in files:
        created_document_id: Optional[int] = None
        destination: Path | None = None
        try:
            file_hash = compute_sha1(path)
            storage_key = build_storage_key_from_hash(file_hash, path.suffix)
            existing = db.scalar(select(Document).where(Document.storage_key == storage_key))
            if existing is not None:
                stats.skipped_existing += 1
                continue

            destination = resolve_storage_path(storage_key)
            if destination is None:
                raise ValueError("Invalid document storage path")
            created_document_id = create_document_record(
                db,
                admin_user=admin_user,
                placeholder_vehicle=placeholder_vehicle,
                source_path=path,
                source_root=source_dir,
                storage_key=storage_key,
                destination=destination,
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

            if rebind_document_vehicle(db, refreshed_document, by_vin=by_vin, by_plate=by_plate):
                stats.matched_vehicle += 1
            else:
                stats.unmatched_vehicle += 1

            stats.created += 1
        except Exception as exc:
            db.rollback()
            persisted_document = created_document_id is not None and db.get(Document, created_document_id) is not None
            if destination is not None and destination.exists() and not persisted_document:
                destination.unlink()
            stats.failed += 1
            if on_error is not None:
                on_error(path, exc)

    return stats


def retry_unmatched_documents_with_session(
    db: Session,
    *,
    limit: int | None = None,
) -> ImportStats:
    stats = ImportStats()
    placeholder_vehicle = ensure_placeholder_vehicle(db)
    db.commit()
    by_vin, by_plate = build_vehicle_lookup(db)

    stmt = (
        select(Document.id)
        .join(Repair, Repair.id == Document.repair_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(Repair.vehicle_id == placeholder_vehicle.id)
        .where(
            Document.status != DocumentStatus.ARCHIVED,
            Repair.status != RepairStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
        )
        .order_by(Document.id.asc())
    )
    document_ids = db.scalars(stmt).all()
    if limit is not None:
        document_ids = document_ids[:limit]

    for document_id in document_ids:
        try:
            document = db.get(Document, document_id)
            if document is None:
                stats.failed += 1
                continue
            if rebind_document_vehicle(db, document, by_vin=by_vin, by_plate=by_plate):
                db.commit()
                stats.matched_vehicle += 1
            else:
                stats.unmatched_vehicle += 1
        except Exception:
            db.rollback()
            stats.failed += 1

    return stats


def main() -> None:
    parser = build_argument_parser()
    args = parser.parse_args()
    source_dir = Path(args.path).expanduser().resolve()

    with SessionLocal() as db:
        if args.retry_unmatched_only:
            stats = retry_unmatched_documents_with_session(db, limit=args.limit)
        else:
            stats = import_documents_with_session(
                db,
                source_dir=source_dir,
                limit=args.limit,
                on_error=lambda path, exc: print(f"[FAILED] {path}: {exc}", file=sys.stderr),
            )

    print(stats.as_dict())


if __name__ == "__main__":
    main()
