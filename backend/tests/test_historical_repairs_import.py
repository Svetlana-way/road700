from __future__ import annotations

import io
import unittest
from datetime import date
from unittest.mock import patch

from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.enums import ImportStatus, UserRole, VehicleStatus, VehicleType
from app.models.imports import ImportConflict, ImportJob
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services import historical_repairs_import
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class HistoricalRepairsImportTestCase(unittest.TestCase):
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

        with self.SessionLocal() as db:
            admin = User(
                full_name="Admin User",
                login="admin",
                email="admin@example.com",
                password_hash="hash",
                role=UserRole.ADMIN,
                is_active=True,
            )
            vehicle = Vehicle(
                external_id="truck-1",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A123BC116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([admin, vehicle])
            db.commit()

    def test_import_marks_job_failed_and_rolls_back_repairs_when_processing_raises(self) -> None:
        group = historical_repairs_import.HistoricalRepairGroup(
            source_key="A123BC116|service|reg|2025-01-10",
            raw_plate="A123BC116",
            normalized_plate="A123BC116",
            repair_date=date(2025, 1, 10),
            raw_service_name="Service 1",
            registrator="Registrar",
            order_number="ORD-1",
            column_name=None,
            vehicle_type_label=None,
            vehicle_model=None,
            mileage=12345,
            lines=[],
        )

        with self.SessionLocal() as db:
            admin = db.query(User).filter(User.login == "admin").one()

            with (
                patch.object(historical_repairs_import, "ensure_service_catalog_synced", return_value=None),
                patch.object(historical_repairs_import, "parse_groups", return_value=({"group-1": group}, 1)),
                patch.object(
                    historical_repairs_import,
                    "resolve_or_create_service",
                    side_effect=RuntimeError("service sync failed"),
                ),
            ):
                with self.assertRaises(RuntimeError):
                    historical_repairs_import.import_historical_repairs(
                        db,
                        file_obj=io.BytesIO(b"fake-xlsx"),
                        filename="history.xlsx",
                        current_admin=admin,
                    )

        with self.SessionLocal() as db:
            jobs = db.query(ImportJob).order_by(ImportJob.id.asc()).all()
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].status, ImportStatus.FAILED)
            self.assertEqual(jobs[0].source_filename, "history.xlsx")
            self.assertIn("service sync failed", jobs[0].error_message or "")
            self.assertEqual(jobs[0].attempts, 1)
            self.assertIsNotNone(jobs[0].started_at)
            self.assertIsNotNone(jobs[0].finished_at)
            self.assertEqual((jobs[0].summary or {}).get("stage"), "failed")
            self.assertEqual(db.query(Repair).count(), 0)
            self.assertEqual(db.query(ImportConflict).count(), 0)

    def test_import_marks_job_completed_with_timestamps_and_summary(self) -> None:
        group = historical_repairs_import.HistoricalRepairGroup(
            source_key="A123BC116|service|reg|2025-01-10",
            raw_plate="A123BC116",
            normalized_plate="A123BC116",
            repair_date=date(2025, 1, 10),
            raw_service_name=None,
            registrator="Registrar",
            order_number="ORD-1",
            column_name=None,
            vehicle_type_label=None,
            vehicle_model=None,
            mileage=12345,
            lines=[],
        )

        with self.SessionLocal() as db:
            admin = db.query(User).filter(User.login == "admin").one()

            with (
                patch.object(historical_repairs_import, "ensure_service_catalog_synced", return_value=None),
                patch.object(historical_repairs_import, "parse_groups", return_value=({"group-1": group}, 1)),
            ):
                result = historical_repairs_import.import_historical_repairs(
                    db,
                    file_obj=io.BytesIO(b"fake-xlsx"),
                    filename="history.xlsx",
                    current_admin=admin,
                )

            self.assertEqual(result.status, ImportStatus.COMPLETED)

        with self.SessionLocal() as db:
            jobs = db.query(ImportJob).order_by(ImportJob.id.asc()).all()
            repairs = db.query(Repair).order_by(Repair.id.asc()).all()
            self.assertEqual(len(jobs), 1)
            self.assertEqual(len(repairs), 1)
            self.assertEqual(jobs[0].status, ImportStatus.COMPLETED)
            self.assertEqual(jobs[0].attempts, 1)
            self.assertIsNotNone(jobs[0].started_at)
            self.assertIsNotNone(jobs[0].finished_at)
            self.assertEqual((jobs[0].summary or {}).get("stage"), "completed")
            self.assertEqual((jobs[0].summary or {}).get("created_repairs"), 1)


if __name__ == "__main__":
    unittest.main()
