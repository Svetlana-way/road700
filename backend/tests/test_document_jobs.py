from __future__ import annotations

import tempfile
import unittest
import warnings
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import SAWarning

from app.api.deps import get_db
from app.api import documents as documents_api
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.document import Document
from app.models.enums import DocumentStatus, ImportStatus, RepairStatus, UserRole
from app.models.imports import ImportJob
from app.models.user import User


class DocumentJobsApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.storage_root.mkdir(parents=True, exist_ok=True)
        cls.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        documents_api.STORAGE_ROOT = cls.storage_root
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        cls.engine.dispose()
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        with self.engine.begin() as connection:
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore",
                    message="Cannot correctly sort tables; there are unresolvable cycles between tables",
                    category=SAWarning,
                )
                tables = list(reversed(Base.metadata.sorted_tables))
            for table in tables:
                connection.execute(table.delete())
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
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def _upload_order_document(self, headers: dict[str, str]) -> dict:
        response = self.client.post(
            "/api/documents/upload",
            headers=headers,
            files={"file": ("job-test.pdf", b"%PDF-1.4\n%test\n", "application/pdf")},
            data={"kind": "order"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_upload_creates_queued_job_and_retry_reuses_failed_job(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]
        job_id = payload["job_id"]
        self.assertIsNotNone(job_id)
        self.assertEqual(payload["import_status"], "queued")
        self.assertEqual(payload["document"]["latest_import_job"]["status"], "queued")

        job_response = self.client.get(f"/api/jobs/{job_id}", headers=headers)
        self.assertEqual(job_response.status_code, 200, job_response.text)
        self.assertEqual(job_response.json()["status"], "queued")

        list_response = self.client.get("/api/documents?limit=8", headers=headers)
        self.assertEqual(list_response.status_code, 200, list_response.text)
        listed_document = next(item for item in list_response.json()["items"] if item["id"] == document_id)
        self.assertEqual(listed_document["latest_import_job"]["id"], job_id)
        self.assertEqual(listed_document["latest_import_job"]["status"], "queued")

        with self.SessionLocal() as db:
            self._mark_job_failed(db, job_id, document_id)

        retry_response = self.client.post(f"/api/jobs/{job_id}/retry", headers=headers)
        self.assertEqual(retry_response.status_code, 200, retry_response.text)
        retry_payload = retry_response.json()
        self.assertEqual(retry_payload["job"]["id"], job_id)
        self.assertEqual(retry_payload["job"]["status"], "retry")

        retried_job_response = self.client.get(f"/api/jobs/{job_id}", headers=headers)
        self.assertEqual(retried_job_response.status_code, 200, retried_job_response.text)
        self.assertEqual(retried_job_response.json()["status"], "retry")

    def test_repair_detail_returns_executive_report_and_document_job_status(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        repair_id = payload["document"]["repair"]["id"]
        document_id = payload["document"]["id"]
        job_id = payload["job_id"]

        response = self.client.get(f"/api/repairs/{repair_id}", headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        repair_payload = response.json()

        self.assertEqual(repair_payload["id"], repair_id)
        self.assertIn("executive_report", repair_payload)
        self.assertIsInstance(repair_payload["executive_report"]["headline"], str)
        self.assertIsInstance(repair_payload["executive_report"]["summary"], str)
        self.assertIsInstance(repair_payload["executive_report"]["status"], str)
        self.assertGreaterEqual(len(repair_payload["documents"]), 1)

        document_payload = next(item for item in repair_payload["documents"] if item["id"] == document_id)
        self.assertEqual(document_payload["latest_import_job"]["id"], job_id)
        self.assertEqual(document_payload["latest_import_job"]["status"], "queued")

    def _mark_job_failed(self, db: Session, job_id: int, document_id: int) -> None:
        job = db.get(ImportJob, job_id)
        document = db.get(Document, document_id)
        self.assertIsNotNone(job)
        self.assertIsNotNone(document)
        assert job is not None
        assert document is not None
        job.status = ImportStatus.FAILED
        job.error_message = "ocr failed"
        document.status = DocumentStatus.OCR_ERROR
        document.review_queue_priority = 100
        if document.repair is not None:
            document.repair.status = RepairStatus.OCR_ERROR
        db.add(job)
        db.add(document)
        db.commit()


if __name__ == "__main__":
    unittest.main()
