from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import settings


class RepairSourceDocumentAlignmentMigrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "repair_source_alignment.db"
        self.database_url = f"sqlite+pysqlite:///{self.database_path}"
        self.backend_root = Path(__file__).resolve().parents[1]
        self.alembic_config = Config(str(self.backend_root / "alembic.ini"))
        self.alembic_config.set_main_option("script_location", str(self.backend_root / "alembic"))
        self.original_database_url_override = settings.database_url_override
        settings.database_url_override = self.database_url

    def tearDown(self) -> None:
        settings.database_url_override = self.original_database_url_override
        self.temp_dir.cleanup()

    def test_upgrade_head_heals_invalid_source_document_refs_and_adds_sqlite_fk(self) -> None:
        command.upgrade(self.alembic_config, "20260329_0016")

        engine = create_engine(self.database_url, future=True)
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    insert into vehicles (
                        external_id,
                        vehicle_type,
                        plate_number,
                        brand,
                        model,
                        status
                    ) values
                        ('truck-local', 'TRUCK', 'A111AA116', 'Volvo', 'FH', 'ACTIVE'),
                        ('truck-foreign', 'TRUCK', 'B222BB116', 'Scania', 'R', 'ACTIVE'),
                        ('truck-orphan', 'TRUCK', 'C333CC116', 'MAN', 'TGX', 'ACTIVE'),
                        ('truck-archived', 'TRUCK', 'D444DD116', 'DAF', 'XF', 'ACTIVE')
                    """
                )
            )
            connection.execute(
                text(
                    """
                    insert into repairs (
                        order_number,
                        repair_date,
                        vehicle_id,
                        service_id,
                        created_by_user_id,
                        source_document_id,
                        mileage,
                        reason,
                        employee_comment,
                        work_total,
                        parts_total,
                        vat_total,
                        grand_total,
                        expected_total,
                        status,
                        is_preliminary,
                        is_partially_recognized,
                        is_manually_completed
                    ) values
                        ('ZN-LOCAL-001', '2025-01-20', 1, null, null, null, 1000, null, null, 0, 0, 0, 0, null, 'IN_REVIEW', 1, 0, 0),
                        ('ZN-FOREIGN-001', '2025-01-21', 2, null, null, null, 2000, null, null, 0, 0, 0, 0, null, 'IN_REVIEW', 1, 0, 0),
                        ('ZN-ORPHAN-001', '2025-01-22', 3, null, null, 99999, 3000, null, null, 0, 0, 0, 0, null, 'IN_REVIEW', 1, 0, 0),
                        ('ZN-ARCHIVED-001', '2025-01-23', 4, null, null, null, 4000, null, null, 0, 0, 0, 0, null, 'IN_REVIEW', 1, 0, 0)
                    """
                )
            )
            connection.execute(
                text(
                    """
                    insert into documents (
                        repair_id,
                        uploaded_by_user_id,
                        original_filename,
                        storage_key,
                        mime_type,
                        source_type,
                        kind,
                        status,
                        is_primary,
                        ocr_confidence,
                        review_queue_priority,
                        notes
                    ) values
                        (1, null, 'local-primary.pdf', 'documents/test/local-primary.pdf', 'application/pdf', 'pdf', 'ORDER', 'NEEDS_REVIEW', 1, null, 100, null),
                        (2, null, 'foreign-primary.pdf', 'documents/test/foreign-primary.pdf', 'application/pdf', 'pdf', 'ORDER', 'NEEDS_REVIEW', 1, null, 100, null),
                        (4, null, 'archived-order.pdf', 'documents/test/archived-order.pdf', 'application/pdf', 'pdf', 'ORDER', 'ARCHIVED', 1, null, 0, null),
                        (4, null, 'active-repeat.pdf', 'documents/test/active-repeat.pdf', 'application/pdf', 'pdf', 'REPEAT_SCAN', 'NEEDS_REVIEW', 0, null, 90, null)
                    """
                )
            )
            connection.execute(text("update repairs set source_document_id = 2 where id = 1"))
            connection.execute(text("update repairs set source_document_id = 3 where id = 4"))

        command.upgrade(self.alembic_config, "head")
        engine.dispose()
        engine = create_engine(self.database_url, future=True)

        inspector = inspect(engine)
        repairs_foreign_keys = inspector.get_foreign_keys("repairs")
        self.assertTrue(
            any(
                fk["referred_table"] == "documents" and fk["constrained_columns"] == ["source_document_id"]
                for fk in repairs_foreign_keys
            ),
            repairs_foreign_keys,
        )

        with engine.connect() as connection:
            repair_rows = connection.execute(
                text(
                    """
                    select id, source_document_id
                    from repairs
                    order by id asc
                    """
                )
            ).mappings().all()
            self.assertEqual(
                [(row["id"], row["source_document_id"]) for row in repair_rows],
                [(1, 1), (2, None), (3, None), (4, 4)],
            )

            local_documents = connection.execute(
                text(
                    """
                    select id, is_primary
                    from documents
                    where repair_id = 1
                    order by id asc
                    """
                )
            ).mappings().all()
            self.assertEqual([(row["id"], row["is_primary"]) for row in local_documents], [(1, 1)])

            archived_repair_documents = connection.execute(
                text(
                    """
                    select id, is_primary
                    from documents
                    where repair_id = 4
                    order by id asc
                    """
                )
            ).mappings().all()
            self.assertEqual([(row["id"], row["is_primary"]) for row in archived_repair_documents], [(3, 0), (4, 1)])

        engine.dispose()


if __name__ == "__main__":
    unittest.main()
