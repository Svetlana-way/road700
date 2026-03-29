from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings


class QueryPatternIndexesMigrationTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "query_indexes.db"
        self.database_url = f"sqlite+pysqlite:///{self.database_path}"
        self.backend_root = Path(__file__).resolve().parents[1]
        self.alembic_config = Config(str(self.backend_root / "alembic.ini"))
        self.alembic_config.set_main_option("script_location", str(self.backend_root / "alembic"))
        self.original_database_url_override = settings.database_url_override
        settings.database_url_override = self.database_url

    def tearDown(self) -> None:
        settings.database_url_override = self.original_database_url_override
        self.temp_dir.cleanup()

    def test_upgrade_head_adds_composite_indexes_for_hot_paths(self) -> None:
        command.upgrade(self.alembic_config, "head")

        engine = create_engine(self.database_url, future=True)
        inspector = inspect(engine)

        audit_indexes = {item["name"]: item["column_names"] for item in inspector.get_indexes("audit_log")}
        import_job_indexes = {item["name"]: item["column_names"] for item in inspector.get_indexes("import_jobs")}
        import_conflict_indexes = {
            item["name"]: item["column_names"] for item in inspector.get_indexes("import_conflicts")
        }
        repair_check_indexes = {item["name"]: item["column_names"] for item in inspector.get_indexes("repair_checks")}

        self.assertEqual(audit_indexes.get("ix_audit_log_created_at_id"), ["created_at", "id"])
        self.assertEqual(import_job_indexes.get("ix_import_jobs_created_at_id"), ["created_at", "id"])
        self.assertEqual(
            import_conflict_indexes.get("ix_import_conflicts_status_created_at_id"),
            ["status", "created_at", "id"],
        )
        self.assertEqual(
            repair_check_indexes.get("ix_repair_checks_is_resolved_repair_id"),
            ["is_resolved", "repair_id"],
        )

        engine.dispose()


if __name__ == "__main__":
    unittest.main()
