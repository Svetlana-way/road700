from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.document import Document, DocumentVersion
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.scripts import sync_service_catalog
from app.services import service_catalog
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class SyncServiceCatalogTestCase(unittest.TestCase):
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
                brand="Dong Feng",
                model="KL",
                status=VehicleStatus.ACTIVE,
            )
            archived_catalog_service = Service(
                name="ООО «АХВ Трак Сервис»",
                status=ServiceStatus.ARCHIVED,
                city="Archived City",
                created_by_user_id=1,
            )
            db.add(admin)
            db.flush()
            archived_catalog_service.created_by_user_id = admin.id
            db.add_all([vehicle, archived_catalog_service])
            db.flush()

            repair = Repair(
                order_number="SYNC-001",
                repair_date=date(2025, 1, 10),
                vehicle_id=vehicle.id,
                service_id=None,
                created_by_user_id=admin.id,
                mileage=1000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="sync-order.pdf",
                storage_key="documents/test/sync-order.pdf",
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
                    parsed_payload={"source_path": "AXB/sync-order.pdf"},
                    field_confidence_map={},
                    change_summary="Initial import",
                )
            )
            db.commit()
            self.repair_id = repair.id
            self.archived_service_id = archived_catalog_service.id

    def test_sync_service_catalog_does_not_bind_repair_to_archived_catalog_service(self) -> None:
        with patch.object(sync_service_catalog, "SessionLocal", self.SessionLocal):
            stats = sync_service_catalog.sync_service_catalog()

        self.assertEqual(stats.repairs_updated, 0)
        self.assertEqual(stats.repairs_skipped, 1)

        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertIsNone(repair.service_id)

            archived_service = db.get(Service, self.archived_service_id)
            self.assertIsNotNone(archived_service)
            assert archived_service is not None
            self.assertEqual(archived_service.status, ServiceStatus.ARCHIVED)
            active_catalog_service = db.scalar(
                select(Service).where(
                    Service.name == "ООО «АХВ Трак Сервис»",
                    Service.status != ServiceStatus.ARCHIVED,
                )
            )
            self.assertIsNone(active_catalog_service)

    def test_sync_service_catalog_ignores_archived_documents_during_backfill(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            source_document = db.scalar(select(Document).where(Document.repair_id == self.repair_id, Document.is_primary.is_(True)))
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(repair)
            self.assertIsNotNone(source_document)
            self.assertIsNotNone(admin)
            assert repair is not None
            assert source_document is not None
            assert admin is not None

            active_service = Service(
                name="ООО «АХВ Трак Сервис»",
                status=ServiceStatus.CONFIRMED,
                city="Kazan",
                created_by_user_id=admin.id,
                confirmed_by_user_id=admin.id,
            )
            db.add(active_service)
            db.flush()

            active_version = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == source_document.id))
            self.assertIsNotNone(active_version)
            assert active_version is not None
            active_version.parsed_payload = {"source_path": "uploads/no-match/sync-order.pdf"}

            archived_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="archived-sync-order.pdf",
                storage_key="documents/test/archived-sync-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.ARCHIVED,
                is_primary=False,
                review_queue_priority=0,
            )
            db.add(archived_document)
            db.flush()
            db.add(
                DocumentVersion(
                    document_id=archived_document.id,
                    version_number=1,
                    storage_key=archived_document.storage_key,
                    parsed_payload={"source_path": "AXB/archived-sync-order.pdf"},
                    field_confidence_map={},
                    change_summary="Archived import",
                )
            )
            db.commit()

        with patch.object(sync_service_catalog, "SessionLocal", self.SessionLocal):
            stats = sync_service_catalog.sync_service_catalog()

        self.assertEqual(stats.repairs_updated, 0)

        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertIsNone(repair.service_id)

    def test_sync_service_catalog_skips_attachment_only_repairs_during_backfill(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            source_document = db.scalar(select(Document).where(Document.repair_id == self.repair_id, Document.is_primary.is_(True)))
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(repair)
            self.assertIsNotNone(source_document)
            self.assertIsNotNone(admin)
            assert repair is not None
            assert source_document is not None
            assert admin is not None

            active_service = Service(
                name="ООО «АХВ Трак Сервис»",
                status=ServiceStatus.CONFIRMED,
                city="Kazan",
                created_by_user_id=admin.id,
                confirmed_by_user_id=admin.id,
            )
            db.add(active_service)
            db.flush()

            source_document.kind = DocumentKind.ATTACHMENT
            source_document.is_primary = False
            repair.source_document_id = None
            active_version = db.scalar(select(DocumentVersion).where(DocumentVersion.document_id == source_document.id))
            self.assertIsNotNone(active_version)
            assert active_version is not None
            active_version.parsed_payload = {"source_path": "AXB/attachment-only.pdf"}
            db.commit()

        with patch.object(sync_service_catalog, "SessionLocal", self.SessionLocal):
            stats = sync_service_catalog.sync_service_catalog()

        self.assertEqual(stats.repairs_updated, 0)
        self.assertEqual(stats.repairs_skipped, 1)

        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertIsNone(repair.service_id)

    def test_sync_service_catalog_skips_archived_repairs_during_backfill(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            admin = db.scalar(select(User).where(User.login == "admin"))
            source_document = db.scalar(select(Document).where(Document.repair_id == self.repair_id, Document.is_primary.is_(True)))
            self.assertIsNotNone(repair)
            self.assertIsNotNone(admin)
            self.assertIsNotNone(source_document)
            assert repair is not None
            assert admin is not None
            assert source_document is not None

            active_service = Service(
                name="ООО «АХВ Трак Сервис»",
                status=ServiceStatus.CONFIRMED,
                city="Kazan",
                created_by_user_id=admin.id,
                confirmed_by_user_id=admin.id,
            )
            db.add(active_service)
            repair.status = RepairStatus.ARCHIVED
            db.commit()

        with patch.object(sync_service_catalog, "SessionLocal", self.SessionLocal):
            stats = sync_service_catalog.sync_service_catalog()

        self.assertEqual(stats.repairs_updated, 0)

        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertIsNone(repair.service_id)
            self.assertEqual(repair.status, RepairStatus.ARCHIVED)

    def test_ensure_service_catalog_synced_skips_unreadable_docx_cards(self) -> None:
        with TemporaryDirectory() as temp_dir:
            Path(temp_dir, "broken-card.docx").write_bytes(b"not-a-docx")
            service_catalog.get_service_catalog_entries.cache_clear()
            try:
                with self.SessionLocal() as db, patch.object(
                    service_catalog,
                    "get_service_catalog_dir",
                    return_value=Path(temp_dir),
                ), patch.object(service_catalog.logger, "warning") as warning_mock:
                    synced = service_catalog.ensure_service_catalog_synced(db)

                self.assertTrue(any(item.name == "ООО «АХВ Трак Сервис»" for item in synced))
                warning_mock.assert_called_once()
            finally:
                service_catalog.get_service_catalog_entries.cache_clear()


if __name__ == "__main__":
    unittest.main()
