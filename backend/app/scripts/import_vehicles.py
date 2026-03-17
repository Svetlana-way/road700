from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import xlrd
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.paths import PROJECT_ROOT
from app.db.session import SessionLocal
from app.models.enums import VehicleStatus, VehicleType
from app.models.vehicle import Vehicle, VehicleLinkHistory

DEFAULT_TRUCKS_PATH = PROJECT_ROOT / "Реестр автомобилей" / "Грузовики Парк.xls"
DEFAULT_TRAILERS_PATH = PROJECT_ROOT / "Реестр автомобилей" / "Прицепы Парк.xls"


@dataclass
class ImportStats:
    created: int = 0
    updated: int = 0
    links_created: int = 0
    links_closed: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "created": self.created,
            "updated": self.updated,
            "links_created": self.links_created,
            "links_closed": self.links_closed,
        }


def normalize_text(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith(".0") and text.replace(".", "", 1).isdigit():
        text = text[:-2]
    return text


def normalize_int(value: object) -> Optional[int]:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = normalize_text(value)
    return int(text) if text else None


def normalize_datetime(value: object) -> Optional[datetime]:
    text = normalize_text(value)
    if not text or text == "#":
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def split_registry_values(value: object) -> list[str]:
    text = normalize_text(value)
    if not text:
        return []

    normalized = text
    for separator in (";", "\n", "\r"):
        normalized = normalized.replace(separator, ",")

    return [part.strip() for part in normalized.split(",") if part.strip()]


def open_sheet(path: Path) -> tuple[list[str], list[dict[str, object]]]:
    book = xlrd.open_workbook(path.as_posix())
    sheet = book.sheet_by_index(0)
    headers = [str(sheet.cell_value(0, col)).strip() for col in range(sheet.ncols)]
    rows: list[dict[str, object]] = []
    for row_idx in range(1, sheet.nrows):
        row = {headers[col]: sheet.cell_value(row_idx, col) for col in range(sheet.ncols)}
        rows.append(row)
    return headers, rows


def find_vehicle(
    db: Session,
    vehicle_type: VehicleType,
    external_id: Optional[str],
    vin: Optional[str],
    plate_number: Optional[str],
) -> Optional[Vehicle]:
    clauses = []
    if external_id:
        clauses.append(Vehicle.external_id == external_id)
    if vin:
        clauses.append(Vehicle.vin == vin)
    if plate_number:
        clauses.append(Vehicle.plate_number == plate_number)
    if not clauses:
        return None
    return db.scalar(
        select(Vehicle).where(
            Vehicle.vehicle_type == vehicle_type,
            or_(*clauses),
        )
    )


def upsert_vehicle(
    db: Session,
    row: dict[str, object],
    vehicle_type: VehicleType,
    stats: ImportStats,
) -> Vehicle:
    external_id = normalize_text(row.get("ID в CARGO.RUN"))
    vin = normalize_text(row.get("VIN"))
    plate_number = normalize_text(row.get("Госномер"))

    vehicle = find_vehicle(
        db,
        vehicle_type=vehicle_type,
        external_id=external_id,
        vin=vin,
        plate_number=plate_number,
    )
    is_new = vehicle is None
    if vehicle is None:
        vehicle = Vehicle(vehicle_type=vehicle_type, status=VehicleStatus.ACTIVE)

    current_driver = normalize_text(row.get("Текущий водитель 2")) or normalize_text(
        row.get("Текущий водитель 1")
    )

    vehicle.external_id = external_id or vehicle.external_id
    vehicle.vin = vin or vehicle.vin
    vehicle.plate_number = plate_number or vehicle.plate_number
    vehicle.brand = normalize_text(row.get("Марка"))
    vehicle.model = normalize_text(row.get("Тип ТС")) or normalize_text(row.get("Тип прицепа"))
    vehicle.year = normalize_int(row.get("Год выпуска"))
    vehicle.column_name = normalize_text(row.get("Колонна"))
    vehicle.mechanic_name = normalize_text(row.get("Механик"))
    vehicle.current_driver_name = current_driver
    vehicle.last_coordinates_at = normalize_datetime(row.get("Дата последних координат"))
    vehicle.comment = normalize_text(row.get("Комментарий"))
    vehicle.source_payload = {key: normalize_text(value) for key, value in row.items()}

    db.add(vehicle)
    db.flush()

    if is_new:
        stats.created += 1
    else:
        stats.updated += 1

    return vehicle


def import_registry(
    db: Session,
    path: Path,
    vehicle_type: VehicleType,
    stats: ImportStats,
) -> list[dict[str, object]]:
    _, rows = open_sheet(path)
    for row in rows:
        upsert_vehicle(db, row, vehicle_type, stats)
    return rows


def create_links(
    db: Session,
    trucks_rows: list[dict[str, object]],
    trailers_rows: list[dict[str, object]],
    stats: ImportStats,
) -> None:
    by_plate = {
        vehicle.plate_number: vehicle
        for vehicle in db.scalars(select(Vehicle)).all()
        if vehicle.plate_number
    }

    today = date.today()
    imported_pairs: set[tuple[int, int]] = set()
    active_links = db.scalars(
        select(VehicleLinkHistory).where(
            VehicleLinkHistory.starts_at <= today,
            or_(
                VehicleLinkHistory.ends_at.is_(None),
                VehicleLinkHistory.ends_at >= today,
            ),
        )
    ).all()
    active_pairs = {
        (link.left_vehicle_id, link.right_vehicle_id): link
        for link in active_links
    }

    def add_link(left_plate: Optional[str], right_plate: Optional[str]) -> None:
        if not left_plate or not right_plate:
            return
        left = by_plate.get(left_plate)
        right = by_plate.get(right_plate)
        if not left or not right:
            return
        pair = (left.id, right.id)
        if pair in imported_pairs:
            return
        imported_pairs.add(pair)
        if pair in active_pairs:
            return
        db.add(
            VehicleLinkHistory(
                left_vehicle_id=left.id,
                right_vehicle_id=right.id,
                starts_at=today,
                comment="Imported current link from vehicle registries",
            )
        )
        stats.links_created += 1

    for row in trucks_rows:
        truck_plate = normalize_text(row.get("Госномер"))
        for trailer_plate in split_registry_values(row.get("Прицеп")):
            add_link(truck_plate, trailer_plate)
        for trailer_plate in split_registry_values(row.get("Привязанные прицепы")):
            add_link(truck_plate, trailer_plate)

    for row in trailers_rows:
        trailer_plate = normalize_text(row.get("Госномер"))
        for truck_plate in split_registry_values(row.get("Грузовик")):
            add_link(truck_plate, trailer_plate)
        for truck_plate in split_registry_values(row.get("Привязанные грузовики")):
            add_link(truck_plate, trailer_plate)

    for pair, link in active_pairs.items():
        if pair in imported_pairs:
            continue
        if link.ends_at is None or link.ends_at > today:
            link.ends_at = today
            stats.links_closed += 1


def import_vehicles_with_session(
    db: Session,
    trucks_path: Path = DEFAULT_TRUCKS_PATH,
    trailers_path: Path = DEFAULT_TRAILERS_PATH,
) -> ImportStats:
    stats = ImportStats()
    trucks_rows = import_registry(db, trucks_path, VehicleType.TRUCK, stats)
    trailers_rows = import_registry(db, trailers_path, VehicleType.TRAILER, stats)
    create_links(db, trucks_rows, trailers_rows, stats)
    db.commit()
    return stats


def import_vehicles(
    trucks_path: Path = DEFAULT_TRUCKS_PATH,
    trailers_path: Path = DEFAULT_TRAILERS_PATH,
) -> ImportStats:
    with SessionLocal() as db:
        stats = import_vehicles_with_session(db, trucks_path=trucks_path, trailers_path=trailers_path)
    return stats


if __name__ == "__main__":
    stats = import_vehicles()
    print(
        f"Vehicle import completed. created={stats.created}, "
        f"updated={stats.updated}, links_created={stats.links_created}"
    )
