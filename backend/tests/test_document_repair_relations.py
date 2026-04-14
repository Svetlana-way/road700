from __future__ import annotations

import unittest
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.document_repair_relations import (
    build_canonical_source_document_id_expr,
    get_repair_source_document,
    order_repair_documents_by_source_priority,
)
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

    def test_order_repair_documents_by_source_priority_prefers_newest_active_document_when_no_primary_exists(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            first_attachment = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="older-attachment.pdf",
                storage_key="documents/test/older-attachment.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ATTACHMENT,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=20,
            )
            second_attachment = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="newer-attachment.pdf",
                storage_key="documents/test/newer-attachment.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ATTACHMENT,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=20,
            )
            db.add_all([first_attachment, second_attachment])
            db.commit()
            db.refresh(repair)

            ordered = order_repair_documents_by_source_priority(repair)

        self.assertEqual(
            [document.original_filename for document in ordered],
            ["newer-attachment.pdf", "older-attachment.pdf"],
        )

    def test_order_repair_documents_by_source_priority_orders_non_source_documents_by_recency(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            source_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="source-order.pdf",
                storage_key="documents/test/source-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
                created_at=datetime(2025, 2, 1, 12, 0, tzinfo=timezone.utc),
            )
            newer_repeat = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="newer-repeat.pdf",
                storage_key="documents/test/newer-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=20,
                created_at=datetime(2025, 2, 3, 12, 0, tzinfo=timezone.utc),
            )
            older_repeat = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="older-repeat.pdf",
                storage_key="documents/test/older-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=20,
                created_at=datetime(2025, 2, 2, 12, 0, tzinfo=timezone.utc),
            )
            db.add_all([source_document, newer_repeat, older_repeat])
            db.flush()
            repair.source_document_id = source_document.id
            db.commit()
            db.refresh(repair)

            ordered = order_repair_documents_by_source_priority(repair)

        self.assertEqual(
            [document.original_filename for document in ordered],
            ["source-order.pdf", "newer-repeat.pdf", "older-repeat.pdf"],
        )

    def test_get_repair_source_document_fallback_returns_none_when_only_attachments_available(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            db.add_all(
                [
                    Document(
                        repair_id=repair.id,
                        uploaded_by_user_id=self.user_id,
                        original_filename="older-attachment.pdf",
                        storage_key="documents/test/fallback-older-attachment.pdf",
                        mime_type="application/pdf",
                        source_type="pdf",
                        kind=DocumentKind.ATTACHMENT,
                        status=DocumentStatus.NEEDS_REVIEW,
                        is_primary=False,
                        review_queue_priority=20,
                    ),
                    Document(
                        repair_id=repair.id,
                        uploaded_by_user_id=self.user_id,
                        original_filename="newer-attachment.pdf",
                        storage_key="documents/test/fallback-newer-attachment.pdf",
                        mime_type="application/pdf",
                        source_type="pdf",
                        kind=DocumentKind.ATTACHMENT,
                        status=DocumentStatus.NEEDS_REVIEW,
                        is_primary=False,
                        review_queue_priority=20,
                    ),
                ]
            )
            db.commit()
            db.refresh(repair)

            source_document = get_repair_source_document(repair, include_archived_fallback=True)

        self.assertIsNone(source_document)

    def test_get_repair_source_document_fallback_prefers_archived_primary_eligible_document(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            db.add_all(
                [
                    Document(
                        repair_id=repair.id,
                        uploaded_by_user_id=self.user_id,
                        original_filename="archived-order.pdf",
                        storage_key="documents/test/fallback-archived-order.pdf",
                        mime_type="application/pdf",
                        source_type="pdf",
                        kind=DocumentKind.ORDER,
                        status=DocumentStatus.ARCHIVED,
                        is_primary=False,
                        review_queue_priority=0,
                    ),
                    Document(
                        repair_id=repair.id,
                        uploaded_by_user_id=self.user_id,
                        original_filename="archived-attachment.pdf",
                        storage_key="documents/test/fallback-archived-attachment.pdf",
                        mime_type="application/pdf",
                        source_type="pdf",
                        kind=DocumentKind.ATTACHMENT,
                        status=DocumentStatus.ARCHIVED,
                        is_primary=False,
                        review_queue_priority=0,
                    ),
                ]
            )
            db.commit()
            db.refresh(repair)

            source_document = get_repair_source_document(repair, include_archived_fallback=True)

        self.assertIsNotNone(source_document)
        assert source_document is not None
        self.assertEqual(source_document.original_filename, "archived-order.pdf")

    def test_build_canonical_source_document_id_expr_matches_python_helper_for_legacy_drift(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, self.repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None

            foreign_vehicle = Vehicle(
                external_id="truck-doc-relations-foreign",
                vehicle_type=VehicleType.TRUCK,
                plate_number="F222FF116",
                brand="MAN",
                model="TGX",
                status=VehicleStatus.ACTIVE,
            )
            db.add(foreign_vehicle)
            db.flush()

            foreign_repair = Repair(
                order_number="REL-FOREIGN-001",
                repair_date=date(2025, 2, 5),
                vehicle_id=foreign_vehicle.id,
                created_by_user_id=self.user_id,
                mileage=2000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(foreign_repair)
            db.flush()

            foreign_document = Document(
                repair_id=foreign_repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="foreign-primary.pdf",
                storage_key="documents/test/foreign-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
                created_at=datetime(2025, 2, 1, 12, 0, tzinfo=timezone.utc),
            )
            db.add(foreign_document)
            db.flush()

            newer_primary = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="newer-primary.pdf",
                storage_key="documents/test/newer-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
                created_at=datetime(2025, 2, 3, 12, 0, tzinfo=timezone.utc),
            )
            older_primary = Document(
                repair_id=repair.id,
                uploaded_by_user_id=self.user_id,
                original_filename="older-primary.pdf",
                storage_key="documents/test/older-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=20,
                created_at=datetime(2025, 2, 2, 12, 0, tzinfo=timezone.utc),
            )
            db.add_all([older_primary, newer_primary])
            db.flush()
            repair.source_document_id = foreign_document.id
            db.commit()
            db.refresh(repair)

            python_source = get_repair_source_document(repair)
            sql_source_document_id = db.scalar(
                select(build_canonical_source_document_id_expr()).select_from(Repair).where(Repair.id == repair.id)
            )

        self.assertIsNotNone(python_source)
        assert python_source is not None
        self.assertEqual(python_source.id, newer_primary.id)
        self.assertEqual(sql_source_document_id, newer_primary.id)


if __name__ == "__main__":
    unittest.main()
