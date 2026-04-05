from __future__ import annotations

import unittest
from datetime import date

from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.document_repair_relations import order_repair_documents_by_source_priority
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class DocumentRepairRelationsTestCase(unittest.TestCase):
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
                external_id="truck-doc-relations",
                vehicle_type=VehicleType.TRUCK,
                plate_number="R111RR116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([admin, vehicle])
            db.flush()

            repair = Repair(
                order_number="REL-001",
                repair_date=date(2025, 2, 4),
                vehicle_id=vehicle.id,
                created_by_user_id=admin.id,
                mileage=1000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.commit()
            self.repair_id = repair.id
            self.user_id = admin.id

    def test_order_repair_documents_by_source_priority_excludes_archived_documents(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            archived_primary = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="archived-primary.pdf",
                storage_key="documents/test/archived-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.ARCHIVED,
                is_primary=True,
                review_queue_priority=0,
            )
            active_repeat = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="active-repeat.pdf",
                storage_key="documents/test/active-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=20,
            )
            active_attachment = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="active-attachment.pdf",
                storage_key="documents/test/active-attachment.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ATTACHMENT,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=20,
            )
            db.add_all([archived_primary, active_repeat, active_attachment])
            db.commit()
            db.refresh(repair)

            ordered = order_repair_documents_by_source_priority(repair)

        self.assertEqual([document.original_filename for document in ordered], ["active-repeat.pdf", "active-attachment.pdf"])

    def test_order_repair_documents_by_source_priority_returns_empty_when_only_archived_documents_remain(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            db.add(
                Document(
                    repair_id=repair.id,
                    uploaded_by_user_id=self.user_id,
                    original_filename="archived-only.pdf",
                    storage_key="documents/test/archived-only.pdf",
                    mime_type="application/pdf",
                    source_type="pdf",
                    kind=DocumentKind.ORDER,
                    status=DocumentStatus.ARCHIVED,
                    is_primary=True,
                    review_queue_priority=0,
                )
            )
            db.commit()
            db.refresh(repair)

            ordered = order_repair_documents_by_source_priority(repair)

        self.assertEqual(ordered, [])


if __name__ == "__main__":
    unittest.main()
