from __future__ import annotations

import unittest

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.enums import ImportStatus
from app.models.imports import ImportConflict, ImportJob
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class SqliteTestUtilsTestCase(unittest.TestCase):
    def test_helper_enforces_foreign_keys_and_allows_safe_reset(self) -> None:
        engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=engine)

        try:
            with SessionLocal() as db:
                db.add(
                    ImportConflict(
                        import_job_id=99999,
                        entity_type="repair",
                        conflict_key="missing-job",
                        status="pending",
                    )
                )
                with self.assertRaises(IntegrityError):
                    db.commit()
                db.rollback()

            with SessionLocal() as db:
                job = ImportJob(
                    document_id=None,
                    import_type="historical_repairs",
                    source_filename="history.xlsx",
                    status=ImportStatus.COMPLETED,
                    summary={"stage": "completed"},
                    error_message=None,
                    attempts=1,
                )
                db.add(job)
                db.flush()
                db.add(
                    ImportConflict(
                        import_job_id=job.id,
                        entity_type="repair",
                        conflict_key="valid-job",
                        status="pending",
                    )
                )
                db.commit()

            reset_database(engine, Base.metadata)

            with SessionLocal() as db:
                self.assertEqual(db.query(ImportJob).count(), 0)
                self.assertEqual(db.query(ImportConflict).count(), 0)
        finally:
            engine.dispose()

    def test_metadata_enforces_import_conflict_status_constraint(self) -> None:
        engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=engine)

        try:
            with SessionLocal() as db:
                job = ImportJob(
                    document_id=None,
                    import_type="historical_repairs",
                    source_filename="history.xlsx",
                    status=ImportStatus.COMPLETED,
                    summary={"stage": "completed"},
                    error_message=None,
                    attempts=1,
                )
                db.add(job)
                db.flush()
                db.add(
                    ImportConflict(
                        import_job_id=job.id,
                        entity_type="repair",
                        conflict_key="invalid-status",
                        status="unexpected",
                    )
                )
                with self.assertRaises(IntegrityError):
                    db.commit()
                db.rollback()
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
