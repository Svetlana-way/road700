from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.api.vehicles import resolve_registry_import_path
from app.db.base import Base
from app.models.enums import VehicleStatus, VehicleType
from app.models.vehicle import Vehicle, VehicleLinkHistory
from app.scripts import import_vehicles
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class ImportVehiclesScriptTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

    def test_upsert_vehicle_creates_new_active_vehicle_instead_of_updating_archived_match(self) -> None:
        with self.SessionLocal() as db:
            archived_vehicle = Vehicle(
                vehicle_type=VehicleType.TRUCK,
                external_id="truck-archived",
                vin="VIN-001",
                plate_number="A001AA116",
                brand="Old Brand",
                model="Old Model",
                status=VehicleStatus.ARCHIVED,
            )
            db.add(archived_vehicle)
            db.commit()
            archived_vehicle_id = archived_vehicle.id

            stats = import_vehicles.ImportStats()
            imported_vehicle = import_vehicles.upsert_vehicle(
                db,
                {
                    "ID в CARGO.RUN": "truck-archived",
                    "VIN": "VIN-001",
                    "Госномер": "A001AA116",
                    "Марка": "Volvo",
                    "Тип ТС": "FH",
                },
                VehicleType.TRUCK,
                stats,
            )
            imported_vehicle_id = imported_vehicle.id
            db.commit()

        self.assertEqual(stats.created, 1)
        self.assertEqual(stats.updated, 0)

        with self.SessionLocal() as db:
            archived_vehicle = db.get(Vehicle, archived_vehicle_id)
            imported_vehicle_db = db.get(Vehicle, imported_vehicle_id)
            all_vehicles = db.scalars(select(Vehicle).order_by(Vehicle.id.asc())).all()

        self.assertIsNotNone(archived_vehicle)
        self.assertIsNotNone(imported_vehicle_db)
        assert archived_vehicle is not None
        assert imported_vehicle_db is not None
        self.assertEqual(len(all_vehicles), 2)
        self.assertEqual(archived_vehicle.status, VehicleStatus.ARCHIVED)
        self.assertEqual(archived_vehicle.brand, "Old Brand")
        self.assertNotEqual(imported_vehicle_db.id, archived_vehicle.id)
        self.assertEqual(imported_vehicle_db.status, VehicleStatus.ACTIVE)
        self.assertEqual(imported_vehicle_db.brand, "Volvo")
        self.assertEqual(imported_vehicle_db.model, "FH")

    def test_create_links_ignores_archived_vehicle_participants(self) -> None:
        with self.SessionLocal() as db:
            active_truck = Vehicle(
                vehicle_type=VehicleType.TRUCK,
                external_id="truck-1",
                plate_number="A111AA116",
                status=VehicleStatus.ACTIVE,
            )
            archived_trailer = Vehicle(
                vehicle_type=VehicleType.TRAILER,
                external_id="trailer-archived",
                plate_number="B222BB116",
                status=VehicleStatus.ARCHIVED,
            )
            db.add_all([active_truck, archived_trailer])
            db.commit()

            stats = import_vehicles.ImportStats()
            import_vehicles.create_links(
                db,
                trucks_rows=[{"Госномер": "A111AA116", "Прицеп": "B222BB116"}],
                trailers_rows=[],
                stats=stats,
            )
            db.commit()

            links = db.scalars(select(VehicleLinkHistory)).all()

        self.assertEqual(stats.links_created, 0)
        self.assertEqual(len(links), 0)

    def test_resolve_registry_import_path_expands_user_home(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home_dir = Path(temp_dir)
            source_path = home_dir / "registry.xls"
            source_path.write_text("stub", encoding="utf-8")

            with patch.dict(os.environ, {"HOME": str(home_dir)}):
                resolved = resolve_registry_import_path("~/registry.xls", default_path=Path("/ignored/default.xls"))

        self.assertEqual(resolved, source_path.resolve())
