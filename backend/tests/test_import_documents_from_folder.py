from __future__ import annotations

import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.scripts import import_documents_from_folder
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class ImportDocumentsFromFolderTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.source_root = Path(cls.temp_dir.name) / "source"
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.source_root.mkdir(parents=True, exist_ok=True)
        cls.storage_root.mkdir(parents=True, exist_ok=True)

        cls.engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

        for path in self.source_root.rglob("*"):
            if path.is_file():
                path.unlink()
        for path in self.storage_root.rglob("*"):
            if path.is_file():
                path.unlink()

        with self.SessionLocal() as db:
            db.add(
                User(
                    full_name="Admin User",
                    login="admin",
                    email="admin@example.com",
                    password_hash="hash",
                    role=UserRole.ADMIN,
                    is_active=True,
                )
            )
            db.commit()

    def test_import_documents_with_session_removes_copied_file_after_processing_failure(self) -> None:
        source_file = self.source_root / "test-order.pdf"
        source_file.write_bytes(b"%PDF-1.4\n%batch-test\n")

        with self.SessionLocal() as db, patch.object(import_documents_from_folder, "STORAGE_ROOT", self.storage_root), patch.object(
            import_documents_from_folder,
            "process_document",
            side_effect=RuntimeError("ocr failure"),
        ):
            stats = import_documents_from_folder.import_documents_with_session(
                db,
                source_dir=self.source_root,
            )

        self.assertEqual(stats.created, 0)
        self.assertEqual(stats.failed, 1)
        self.assertFalse(any(path.is_file() for path in self.storage_root.rglob("*")))

        with self.SessionLocal() as db:
            self.assertEqual(db.query(Document).count(), 0)
            self.assertEqual(db.query(Repair).count(), 0)

    def test_import_documents_with_session_sets_primary_and_source_via_relation_helper(self) -> None:
        source_file = self.source_root / "primary-order.pdf"
        source_file.write_bytes(b"%PDF-1.4\n%primary-test\n")

        with self.SessionLocal() as db, patch.object(import_documents_from_folder, "STORAGE_ROOT", self.storage_root), patch.object(
            import_documents_from_folder,
            "process_document",
            side_effect=lambda current_db, document_id: None,
        ):
            stats = import_documents_from_folder.import_documents_with_session(
                db,
                source_dir=self.source_root,
            )
            document = db.scalar(select(Document).order_by(Document.id.asc()))
            repair = db.scalar(select(Repair).order_by(Repair.id.asc()))
            self.assertIsNotNone(document)
            self.assertIsNotNone(repair)
            assert document is not None
            assert repair is not None
            self.assertTrue(document.is_primary)
            self.assertEqual(repair.source_document_id, document.id)

        self.assertEqual(stats.created, 1)
        self.assertEqual(stats.failed, 0)

    def test_rebind_document_vehicle_does_not_persist_vehicle_change_when_processing_fails(self) -> None:
        with self.SessionLocal() as db:
            placeholder_vehicle = Vehicle(
                external_id=import_documents_from_folder.PLACEHOLDER_EXTERNAL_ID,
                vehicle_type=VehicleType.TRUCK,
                plate_number="IMPORT-QUEUE",
                brand="System",
                model="Placeholder",
                status=VehicleStatus.INACTIVE,
            )
            target_vehicle = Vehicle(
                external_id="truck-1",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A123BC116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, target_vehicle])
            db.flush()

            repair = Repair(
                order_number="BATCH-001",
                repair_date=date(2025, 1, 10),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=1,
                mileage=1000,
                reason="historical_import:test",
                status=RepairStatus.DRAFT,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=1,
                original_filename="A123BC116_order.pdf",
                storage_key="documents/test/batch-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.UPLOADED,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add(document)
            db.flush()

            repair.source_document_id = document.id
            db.add(
                DocumentVersion(
                    document_id=document.id,
                    version_number=1,
                    storage_key=document.storage_key,
                    parsed_payload={"extracted_fields": {"plate_number": "A123BC116"}},
                    field_confidence_map={},
                    change_summary="Initial batch import",
                )
            )
            db.commit()
            document_id = document.id
            repair_id = repair.id
            placeholder_vehicle_id = placeholder_vehicle.id

        with self.SessionLocal() as db:
            document = db.scalar(
                select(Document)
                .where(Document.id == document_id)
            )
            self.assertIsNotNone(document)
            assert document is not None
            by_vin, by_plate = import_documents_from_folder.build_vehicle_lookup(db)

            with patch.object(
                import_documents_from_folder,
                "process_document",
                side_effect=RuntimeError("ocr failure"),
            ):
                with self.assertRaises(RuntimeError):
                    import_documents_from_folder.rebind_document_vehicle(
                        db,
                        document,
                        by_vin=by_vin,
                        by_plate=by_plate,
                    )
            db.rollback()

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertEqual(repair.vehicle_id, placeholder_vehicle_id)


if __name__ == "__main__":
    unittest.main()
