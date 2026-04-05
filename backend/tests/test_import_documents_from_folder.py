from __future__ import annotations

import io
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.paths import get_storage_root, set_storage_root
from app.db.base import Base
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.service import Service
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
        set_storage_root(self.storage_root)
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

        stdout = io.StringIO()
        with redirect_stdout(stdout):
            with self.SessionLocal() as db, patch.object(
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
        self.assertEqual(stdout.getvalue(), "")

        with self.SessionLocal() as db:
            self.assertEqual(db.query(Document).count(), 0)
            self.assertEqual(db.query(Repair).count(), 0)

    def test_import_documents_with_session_sets_primary_and_source_via_relation_helper(self) -> None:
        source_file = self.source_root / "primary-order.pdf"
        source_file.write_bytes(b"%PDF-1.4\n%primary-test\n")

        with self.SessionLocal() as db, patch.object(
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

    def test_import_documents_with_session_uses_runtime_storage_root_override(self) -> None:
        source_file = self.source_root / "runtime-storage-order.pdf"
        source_file.write_bytes(b"%PDF-1.4\n%runtime-storage-test\n")
        override_root = Path(self.temp_dir.name) / "storage-override"
        override_root.mkdir(parents=True, exist_ok=True)
        set_storage_root(override_root)

        with self.SessionLocal() as db, patch.object(
            import_documents_from_folder,
            "process_document",
            side_effect=lambda current_db, document_id: None,
        ):
            stats = import_documents_from_folder.import_documents_with_session(
                db,
                source_dir=self.source_root,
            )
            document = db.scalar(select(Document).order_by(Document.id.asc()))
            self.assertIsNotNone(document)
            assert document is not None

        self.assertEqual(stats.created, 1)
        self.assertTrue((override_root / document.storage_key).exists())
        self.assertFalse((self.storage_root / document.storage_key).exists())
        self.assertEqual(get_storage_root(), override_root.resolve())

    def test_import_documents_with_session_rejects_storage_key_traversal(self) -> None:
        source_file = self.source_root / "traversal-order.pdf"
        source_file.write_bytes(b"%PDF-1.4\n%runtime-storage-test\n")
        outside_file = self.storage_root.parent / "outside-import.pdf"
        outside_file.unlink(missing_ok=True)

        with self.SessionLocal() as db, patch.object(
            import_documents_from_folder,
            "build_storage_key_from_hash",
            return_value="../outside-import.pdf",
        ):
            stats = import_documents_from_folder.import_documents_with_session(
                db,
                source_dir=self.source_root,
            )

        self.assertEqual(stats.created, 0)
        self.assertEqual(stats.failed, 1)
        self.assertFalse(outside_file.exists())

        with self.SessionLocal() as db:
            self.assertEqual(db.query(Document).count(), 0)
            self.assertEqual(db.query(Repair).count(), 0)

    def test_get_admin_user_prefers_configured_login_ignoring_case(self) -> None:
        with self.SessionLocal() as db:
            db.add(
                User(
                    full_name="Preferred Admin",
                    login="preferred.admin",
                    email="preferred-admin@example.com",
                    password_hash="hash",
                    role=UserRole.ADMIN,
                    is_active=True,
                )
            )
            db.commit()

            with patch.object(import_documents_from_folder.settings, "initial_admin_login", " Preferred.Admin "):
                admin = import_documents_from_folder.get_admin_user(db)

        self.assertEqual(admin.login, "preferred.admin")

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

    def test_rebind_document_vehicle_skips_archived_current_vehicle_context(self) -> None:
        with self.SessionLocal() as db:
            archived_vehicle = Vehicle(
                external_id="truck-archived-current",
                vehicle_type=VehicleType.TRUCK,
                plate_number="ARCHCURR-116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ARCHIVED,
            )
            target_vehicle = Vehicle(
                external_id="truck-target-active",
                vehicle_type=VehicleType.TRUCK,
                plate_number="D333BC116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([archived_vehicle, target_vehicle])
            db.flush()

            repair = Repair(
                order_number="BATCH-ARCH-CURRENT-001",
                repair_date=date(2025, 1, 14),
                vehicle_id=archived_vehicle.id,
                created_by_user_id=1,
                mileage=4100,
                reason="historical_import:archived_current_vehicle",
                status=RepairStatus.DRAFT,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=1,
                original_filename="D333BC116_archived_current_vehicle.pdf",
                storage_key="documents/test/batch-archived-current-vehicle-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
            )
            db.add(document)
            db.flush()
            repair.source_document_id = document.id
            db.add(
                DocumentVersion(
                    document_id=document.id,
                    version_number=1,
                    storage_key=document.storage_key,
                    parsed_payload={"extracted_fields": {"plate_number": "D333BC116"}},
                    field_confidence_map={},
                    change_summary="Archived current vehicle context",
                )
            )
            db.commit()
            document_id = document.id
            repair_id = repair.id
            archived_vehicle_id = archived_vehicle.id

        with self.SessionLocal() as db, patch.object(import_documents_from_folder, "process_document") as process_mock:
            document = db.scalar(select(Document).where(Document.id == document_id))
            self.assertIsNotNone(document)
            assert document is not None
            by_vin, by_plate = import_documents_from_folder.build_vehicle_lookup(db)

            changed = import_documents_from_folder.rebind_document_vehicle(
                db,
                document,
                by_vin=by_vin,
                by_plate=by_plate,
            )
            db.commit()
            process_mock.assert_not_called()

        self.assertFalse(changed)

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertEqual(repair.vehicle_id, archived_vehicle_id)

    def test_rebind_document_vehicle_ignores_archived_matching_vehicle(self) -> None:
        with self.SessionLocal() as db:
            placeholder_vehicle = Vehicle(
                external_id=import_documents_from_folder.PLACEHOLDER_EXTERNAL_ID,
                vehicle_type=VehicleType.TRUCK,
                plate_number="IMPORT-QUEUE",
                brand="System",
                model="Placeholder",
                status=VehicleStatus.INACTIVE,
            )
            archived_vehicle = Vehicle(
                external_id="truck-archived-batch",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A777BC116",
                vin="YV2RT40A7LA856099",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ARCHIVED,
            )
            db.add_all([placeholder_vehicle, archived_vehicle])
            db.flush()

            repair = Repair(
                order_number="BATCH-ARCHIVED-001",
                repair_date=date(2025, 1, 11),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=1,
                mileage=2000,
                reason="historical_import:archived_match",
                status=RepairStatus.DRAFT,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=1,
                original_filename="A777BC116_order.pdf",
                storage_key="documents/test/batch-archived-order.pdf",
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
                    parsed_payload={"extracted_fields": {"plate_number": "A777BC116", "vin": "YV2RT40A7LA856099"}},
                    field_confidence_map={},
                    change_summary="Initial batch import",
                )
            )
            db.commit()
            document_id = document.id
            repair_id = repair.id
            placeholder_vehicle_id = placeholder_vehicle.id

        with self.SessionLocal() as db:
            document = db.scalar(select(Document).where(Document.id == document_id))
            self.assertIsNotNone(document)
            assert document is not None
            by_vin, by_plate = import_documents_from_folder.build_vehicle_lookup(db)

            changed = import_documents_from_folder.rebind_document_vehicle(
                db,
                document,
                by_vin=by_vin,
                by_plate=by_plate,
            )
            db.commit()

        self.assertFalse(changed)

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertEqual(repair.vehicle_id, placeholder_vehicle_id)

    def test_ensure_placeholder_vehicle_rejects_archived_placeholder(self) -> None:
        with self.SessionLocal() as db:
            db.add(
                Vehicle(
                    external_id=import_documents_from_folder.PLACEHOLDER_EXTERNAL_ID,
                    vehicle_type=VehicleType.TRUCK,
                    plate_number="IMPORT-QUEUE",
                    brand="System",
                    model="Placeholder",
                    status=VehicleStatus.ARCHIVED,
                )
            )
            db.commit()

            with self.assertRaisesRegex(RuntimeError, "Archived placeholder vehicle cannot be used for batch import"):
                import_documents_from_folder.ensure_placeholder_vehicle(db)

    def test_retry_unmatched_documents_skips_archived_repairs(self) -> None:
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
                external_id="truck-retry-active",
                vehicle_type=VehicleType.TRUCK,
                plate_number="B111BC116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, target_vehicle])
            db.flush()

            repair = Repair(
                order_number="BATCH-RETRY-ARCH-001",
                repair_date=date(2025, 1, 12),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=1,
                mileage=3000,
                reason="historical_import:retry_archived",
                status=RepairStatus.ARCHIVED,
                is_preliminary=False,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=1,
                original_filename="B111BC116_retry_archived.pdf",
                storage_key="documents/test/batch-retry-archived-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
            )
            db.add(document)
            db.flush()
            repair.source_document_id = document.id
            db.add(
                DocumentVersion(
                    document_id=document.id,
                    version_number=1,
                    storage_key=document.storage_key,
                    parsed_payload={"extracted_fields": {"plate_number": "B111BC116"}},
                    field_confidence_map={},
                    change_summary="Retry unmatched archived repair",
                )
            )
            db.commit()
            repair_id = repair.id
            placeholder_vehicle_id = placeholder_vehicle.id

        with self.SessionLocal() as db, patch.object(import_documents_from_folder, "process_document") as process_mock:
            stats = import_documents_from_folder.retry_unmatched_documents_with_session(db)
            process_mock.assert_not_called()

        self.assertEqual(stats.matched_vehicle, 0)
        self.assertEqual(stats.unmatched_vehicle, 0)

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertEqual(repair.vehicle_id, placeholder_vehicle_id)

    def test_retry_unmatched_documents_skips_archived_service_repairs(self) -> None:
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
                external_id="truck-retry-service-active",
                vehicle_type=VehicleType.TRUCK,
                plate_number="C222BC116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            archived_service = Service(
                name="Archived Batch Retry Service",
                city="Kazan",
                status=ServiceStatus.ARCHIVED,
                created_by_user_id=1,
            )
            db.add_all([placeholder_vehicle, target_vehicle, archived_service])
            db.flush()

            repair = Repair(
                order_number="BATCH-RETRY-SVC-001",
                repair_date=date(2025, 1, 13),
                vehicle_id=placeholder_vehicle.id,
                service_id=archived_service.id,
                created_by_user_id=1,
                mileage=4000,
                reason="historical_import:retry_archived_service",
                status=RepairStatus.DRAFT,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=1,
                original_filename="C222BC116_retry_archived_service.pdf",
                storage_key="documents/test/batch-retry-archived-service-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
            )
            db.add(document)
            db.flush()
            repair.source_document_id = document.id
            db.add(
                DocumentVersion(
                    document_id=document.id,
                    version_number=1,
                    storage_key=document.storage_key,
                    parsed_payload={"extracted_fields": {"plate_number": "C222BC116"}},
                    field_confidence_map={},
                    change_summary="Retry unmatched archived service",
                )
            )
            db.commit()
            repair_id = repair.id
            placeholder_vehicle_id = placeholder_vehicle.id

        with self.SessionLocal() as db, patch.object(import_documents_from_folder, "process_document") as process_mock:
            stats = import_documents_from_folder.retry_unmatched_documents_with_session(db)
            process_mock.assert_not_called()

        self.assertEqual(stats.matched_vehicle, 0)
        self.assertEqual(stats.unmatched_vehicle, 0)

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertEqual(repair.vehicle_id, placeholder_vehicle_id)


if __name__ == "__main__":
    unittest.main()
