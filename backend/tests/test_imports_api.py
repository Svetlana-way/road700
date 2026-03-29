from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.audit import AuditLog
from app.models.enums import ImportStatus, UserRole
from app.models.imports import ImportConflict, ImportJob
from app.models.user import User
from app.services.historical_repairs_import import HistoricalRepairImportResult
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class ImportsApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        cls.engine.dispose()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

        with self.SessionLocal() as db:
            db.add(
                User(
                    full_name="Admin User",
                    login="admin",
                    email="admin@example.com",
                    password_hash=get_password_hash("secret123"),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
            )
            db.commit()

    def _get_auth_headers(self) -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "secret123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def _valid_xlsx_bytes(self) -> bytes:
        return b"PK\x03\x04fake-xlsx-content"

    def test_upload_historical_repairs_returns_service_summary(self) -> None:
        headers = self._get_auth_headers()
        result = HistoricalRepairImportResult(
            job_id=41,
            status=ImportStatus.COMPLETED_WITH_CONFLICTS,
            source_filename="history.xlsx",
            rows_total=12,
            grouped_repairs=4,
            created_repairs=3,
            duplicate_repairs=1,
            conflicts_created=2,
            created_services=1,
            created_works=5,
            created_parts=7,
            repair_limit_applied=10,
            first_repair_id=501,
            recent_repair_ids=[501, 502, 503],
            sample_conflicts=["duplicate repair", "vehicle not found"],
        )

        with patch("app.api.imports.import_historical_repairs", return_value=result) as import_mock:
            response = self.client.post(
                "/api/imports/historical-repairs",
                headers=headers,
                files={
                    "file": (
                        "history.xlsx",
                        self._valid_xlsx_bytes(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
                data={"repair_limit": "10"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["job_id"], 41)
        self.assertEqual(payload["status"], "completed_with_conflicts")
        self.assertEqual(payload["source_filename"], "history.xlsx")
        self.assertEqual(payload["created_repairs"], 3)
        self.assertEqual(payload["sample_conflicts"], ["duplicate repair", "vehicle not found"])

        self.assertEqual(import_mock.call_count, 1)
        kwargs = import_mock.call_args.kwargs
        self.assertEqual(kwargs["filename"], "history.xlsx")
        self.assertEqual(kwargs["repair_limit"], 10)
        self.assertEqual(kwargs["current_admin"].login, "admin")

    def test_upload_historical_repairs_maps_service_value_error_to_400(self) -> None:
        headers = self._get_auth_headers()

        with patch("app.api.imports.import_historical_repairs", side_effect=ValueError("bad import file")):
            response = self.client.post(
                "/api/imports/historical-repairs",
                headers=headers,
                files={
                    "file": (
                        "history.xlsx",
                        self._valid_xlsx_bytes(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "bad import file")

    def test_upload_historical_repairs_rejects_non_xlsx_before_service_call(self) -> None:
        headers = self._get_auth_headers()

        with patch("app.api.imports.import_historical_repairs") as import_mock:
            response = self.client.post(
                "/api/imports/historical-repairs",
                headers=headers,
                files={"file": ("history.csv", b"plate,service\n", "text/csv")},
            )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Поддерживается только .xlsx выгрузка исторических ремонтов")
        import_mock.assert_not_called()

    def test_resolve_import_conflict_updates_status_and_writes_audit_log(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            job = ImportJob(
                import_type="historical_repairs",
                source_filename="history.xlsx",
                status=ImportStatus.COMPLETED_WITH_CONFLICTS,
                summary={"stage": "completed"},
                error_message=None,
                attempts=1,
            )
            db.add(job)
            db.flush()
            conflict = ImportConflict(
                import_job_id=job.id,
                entity_type="repair",
                conflict_key="A123BC116|service|reg|2025-01-10",
                incoming_payload={"plate_number": "A123BC116"},
                existing_payload={"reason": "historical_import:key"},
                resolution_payload=None,
                status="pending",
            )
            db.add(conflict)
            db.commit()
            conflict_id = conflict.id

        response = self.client.patch(
            f"/api/imports/conflicts/{conflict_id}",
            headers=headers,
            json={"status": "resolved", "comment": "Связали с существующим ремонтом"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["message"], "Конфликт отмечен как решённый")
        self.assertEqual(payload["conflict"]["status"], "resolved")
        self.assertEqual(payload["conflict"]["source_filename"], "history.xlsx")
        self.assertEqual(payload["conflict"]["resolution_payload"]["comment"], "Связали с существующим ремонтом")
        self.assertEqual(payload["conflict"]["resolution_payload"]["resolved_by_user_name"], "Admin User")

        with self.SessionLocal() as db:
            conflict = db.get(ImportConflict, conflict_id)
            self.assertIsNotNone(conflict)
            assert conflict is not None
            self.assertEqual(conflict.status, "resolved")
            self.assertEqual(conflict.resolution_payload["status"], "resolved")
            self.assertEqual(conflict.resolution_payload["comment"], "Связали с существующим ремонтом")
            self.assertEqual(conflict.resolution_payload["resolved_by_user_id"], 1)
            self.assertIn("resolved_at", conflict.resolution_payload)

            audit_entries = db.query(AuditLog).filter(AuditLog.entity_type == "import_conflict").all()
            self.assertEqual(len(audit_entries), 1)
            self.assertEqual(audit_entries[0].entity_id, str(conflict_id))
            self.assertEqual(audit_entries[0].action_type, "import_conflict_resolved")
            self.assertEqual(audit_entries[0].old_value["status"], "pending")
            self.assertEqual(audit_entries[0].new_value["status"], "resolved")

    def test_list_import_jobs_filters_by_import_type(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            db.add_all(
                [
                    ImportJob(
                        import_type="document_ocr",
                        source_filename="ocr-1.pdf",
                        status=ImportStatus.QUEUED,
                        summary={"stage": "queued"},
                        error_message=None,
                        attempts=0,
                    ),
                    ImportJob(
                        import_type="historical_repairs",
                        source_filename="history.xlsx",
                        status=ImportStatus.COMPLETED,
                        summary={"stage": "completed"},
                        error_message=None,
                        attempts=1,
                    ),
                ]
            )
            db.commit()

        response = self.client.get(
            "/api/imports/jobs?import_type=historical_repairs&limit=10",
            headers=headers,
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["import_type"], "historical_repairs")
        self.assertEqual(payload["items"][0]["source_filename"], "history.xlsx")

    def test_list_import_conflicts_filters_by_status_and_includes_source_filename(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            completed_job = ImportJob(
                import_type="historical_repairs",
                source_filename="history.xlsx",
                status=ImportStatus.COMPLETED_WITH_CONFLICTS,
                summary={"stage": "completed"},
                error_message=None,
                attempts=1,
            )
            db.add(completed_job)
            db.flush()
            db.add_all(
                [
                    ImportConflict(
                        import_job_id=completed_job.id,
                        entity_type="repair",
                        conflict_key="pending-key",
                        status="pending",
                    ),
                    ImportConflict(
                        import_job_id=completed_job.id,
                        entity_type="repair",
                        conflict_key="resolved-key",
                        status="resolved",
                        resolution_payload={"status": "resolved"},
                    ),
                ]
            )
            db.commit()

        response = self.client.get("/api/imports/conflicts?status=pending&limit=10", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["conflict_key"], "pending-key")
        self.assertEqual(payload["items"][0]["status"], "pending")
        self.assertEqual(payload["items"][0]["source_filename"], "history.xlsx")

    def test_get_import_conflict_returns_source_filename(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            job = ImportJob(
                import_type="historical_repairs",
                source_filename="history.xlsx",
                status=ImportStatus.COMPLETED_WITH_CONFLICTS,
                summary={"stage": "completed"},
                error_message=None,
                attempts=1,
            )
            db.add(job)
            db.flush()
            conflict = ImportConflict(
                import_job_id=job.id,
                entity_type="repair",
                conflict_key="details-key",
                incoming_payload={"plate_number": "A123BC116"},
                status="pending",
            )
            db.add(conflict)
            db.commit()
            conflict_id = conflict.id

        response = self.client.get(f"/api/imports/conflicts/{conflict_id}", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["id"], conflict_id)
        self.assertEqual(payload["conflict_key"], "details-key")
        self.assertEqual(payload["source_filename"], "history.xlsx")

    def test_resolve_import_conflict_rejects_invalid_status(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            job = ImportJob(
                import_type="historical_repairs",
                source_filename="history.xlsx",
                status=ImportStatus.COMPLETED_WITH_CONFLICTS,
                summary={"stage": "completed"},
                error_message=None,
                attempts=1,
            )
            db.add(job)
            db.flush()
            conflict = ImportConflict(
                import_job_id=job.id,
                entity_type="repair",
                conflict_key="conflict-key",
                status="pending",
            )
            db.add(conflict)
            db.commit()
            conflict_id = conflict.id

        response = self.client.patch(
            f"/api/imports/conflicts/{conflict_id}",
            headers=headers,
            json={"status": "pending"},
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Поддерживаются только статусы resolved и ignored",
        )

        with self.SessionLocal() as db:
            conflict = db.get(ImportConflict, conflict_id)
            self.assertIsNotNone(conflict)
            assert conflict is not None
            self.assertEqual(conflict.status, "pending")
            self.assertEqual(db.query(AuditLog).count(), 0)


if __name__ == "__main__":
    unittest.main()
