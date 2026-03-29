from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.core.config import settings


class ImportSchemaAlignmentMigrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "schema_alignment.db"
        self.database_url = f"sqlite+pysqlite:///{self.database_path}"
        self.backend_root = Path(__file__).resolve().parents[1]
        self.alembic_config = Config(str(self.backend_root / "alembic.ini"))
        self.alembic_config.set_main_option("script_location", str(self.backend_root / "alembic"))
        self.original_database_url_override = settings.database_url_override
        settings.database_url_override = self.database_url

    def tearDown(self) -> None:
        settings.database_url_override = self.original_database_url_override
        self.temp_dir.cleanup()

    def test_upgrade_head_aligns_import_foreign_keys_and_heals_orphans(self) -> None:
        command.upgrade(self.alembic_config, "20260319_0013")

        engine = create_engine(self.database_url, future=True)
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    insert into import_jobs (
                        import_type,
                        source_filename,
                        status,
                        summary,
                        error_message,
                        document_id,
                        attempts,
                        started_at,
                        finished_at
                    ) values (
                        'document_ocr',
                        'orphan-document.pdf',
                        'QUEUED',
                        null,
                        null,
                        999,
                        0,
                        null,
                        null
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    insert into import_conflicts (
                        import_job_id,
                        entity_type,
                        conflict_key,
                        incoming_payload,
                        existing_payload,
                        resolution_payload,
                        status
                    ) values (
                        99999,
                        'repair',
                        'orphan-conflict-key',
                        null,
                        null,
                        null,
                        'pending'
                    )
                    """
                )
            )

        command.upgrade(self.alembic_config, "head")
        engine.dispose()
        engine = create_engine(self.database_url, future=True)

        inspector = inspect(engine)
        import_jobs_foreign_keys = inspector.get_foreign_keys("import_jobs")
        import_conflicts_foreign_keys = inspector.get_foreign_keys("import_conflicts")

        self.assertTrue(
            any(fk["referred_table"] == "documents" and fk["constrained_columns"] == ["document_id"] for fk in import_jobs_foreign_keys),
            import_jobs_foreign_keys,
        )
        self.assertTrue(
            any(
                fk["referred_table"] == "import_jobs" and fk["constrained_columns"] == ["import_job_id"]
                for fk in import_conflicts_foreign_keys
            ),
            import_conflicts_foreign_keys,
        )

        with engine.connect() as connection:
            orphan_document_job = connection.execute(
                text(
                    """
                    select id, document_id
                    from import_jobs
                    where source_filename = 'orphan-document.pdf'
                    """
                )
            ).mappings().one()
            self.assertIsNone(orphan_document_job["document_id"])

            healed_conflict = connection.execute(
                text(
                    """
                    select id, import_job_id
                    from import_conflicts
                    where conflict_key = 'orphan-conflict-key'
                    """
                )
            ).mappings().one()
            self.assertNotEqual(healed_conflict["import_job_id"], 99999)

            placeholder_job = connection.execute(
                text(
                    """
                    select import_type, source_filename, status, error_message
                    from import_jobs
                    where id = :job_id
                    """
                ),
                {"job_id": healed_conflict["import_job_id"]},
            ).mappings().one()
            self.assertEqual(placeholder_job["import_type"], "legacy_conflict_placeholder")
            self.assertEqual(placeholder_job["status"], "FAILED")
            self.assertEqual(placeholder_job["source_filename"], f"legacy_orphan_conflict_{healed_conflict['id']}")
            self.assertIn("orphan import_conflict", placeholder_job["error_message"])

        engine.dispose()


if __name__ == "__main__":
    unittest.main()
