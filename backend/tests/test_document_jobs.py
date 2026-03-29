from __future__ import annotations

import tempfile
import unittest
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_db
from app.api import documents as documents_api
from app.api.repairs import build_export_warning_rows, build_report_status_summary
from app.core.paths import set_storage_root
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, ImportStatus, RepairStatus, UserRole, VehicleStatus, VehicleType
from app.models.imports import ImportJob
from app.models.repair import Repair
from app.models.user import User
from app.models.vehicle import Vehicle
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class DocumentJobsApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.storage_root.mkdir(parents=True, exist_ok=True)
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
        set_storage_root(cls.storage_root)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        cls.engine.dispose()
        cls.temp_dir.cleanup()

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

    def _make_png_bytes(self, color: tuple[int, int, int]) -> bytes:
        image = Image.new("RGB", (64, 48), color=color)
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

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

    def test_process_endpoint_reuses_existing_active_job(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]
        initial_job_id = payload["job_id"]

        first_response = self.client.post(f"/api/documents/{document_id}/process", headers=headers)
        self.assertEqual(first_response.status_code, 200, first_response.text)
        self.assertEqual(first_response.json()["job_id"], initial_job_id)

        second_response = self.client.post(f"/api/documents/{document_id}/process", headers=headers)
        self.assertEqual(second_response.status_code, 200, second_response.text)
        self.assertEqual(second_response.json()["job_id"], initial_job_id)

        with self.SessionLocal() as db:
            jobs = db.query(ImportJob).filter(ImportJob.document_id == document_id).order_by(ImportJob.id.asc()).all()
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].id, initial_job_id)
            self.assertEqual(jobs[0].status, ImportStatus.QUEUED)

    def test_database_rejects_second_active_ocr_job_for_same_document(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]

        with self.SessionLocal() as db:
            document = db.get(Document, document_id)
            self.assertIsNotNone(document)
            assert document is not None

            db.add(
                ImportJob(
                    document_id=document_id,
                    import_type="document_ocr",
                    source_filename=document.original_filename,
                    status=ImportStatus.PROCESSING,
                    summary={"document_id": document_id, "stage": "duplicate_processing"},
                    error_message=None,
                    attempts=1,
                    started_at=datetime(2025, 1, 3, 10, 0, 0),
                    finished_at=None,
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()

            jobs = db.query(ImportJob).filter(ImportJob.document_id == document_id).order_by(ImportJob.id.asc()).all()
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].status, ImportStatus.QUEUED)

    def test_process_endpoint_reuses_active_processing_job_even_if_latest_job_is_completed(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]
        initial_job_id = payload["job_id"]

        with self.SessionLocal() as db:
            initial_job = db.get(ImportJob, initial_job_id)
            document = db.get(Document, document_id)
            self.assertIsNotNone(initial_job)
            self.assertIsNotNone(document)
            assert initial_job is not None
            assert document is not None

            initial_job.status = ImportStatus.PROCESSING
            initial_job.started_at = datetime(2025, 1, 1, 9, 0, 0)
            db.add(
                ImportJob(
                    document_id=document_id,
                    import_type="document_ocr",
                    source_filename=document.original_filename,
                    status=ImportStatus.COMPLETED,
                    summary={"document_id": document_id, "stage": "completed"},
                    error_message=None,
                    attempts=1,
                    started_at=None,
                    finished_at=None,
                )
            )
            db.commit()

        response = self.client.post(f"/api/documents/{document_id}/process", headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["job_id"], initial_job_id)
        self.assertEqual(response.json()["import_status"], "processing")

        with self.SessionLocal() as db:
            jobs = db.query(ImportJob).filter(ImportJob.document_id == document_id).order_by(ImportJob.id.asc()).all()
            self.assertEqual(len(jobs), 2)
            self.assertEqual(sum(1 for job in jobs if job.status == ImportStatus.PROCESSING), 1)

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
        self.assertEqual(repair_payload["source_document_id"], document_id)
        self.assertIsInstance(repair_payload["executive_report"]["headline"], str)
        self.assertIsInstance(repair_payload["executive_report"]["summary"], str)
        self.assertIsInstance(repair_payload["executive_report"]["status"], str)
        self.assertIsInstance(repair_payload["executive_report"]["full_report_sections"], list)
        self.assertGreaterEqual(len(repair_payload["documents"]), 1)

        document_payload = next(item for item in repair_payload["documents"] if item["id"] == document_id)
        self.assertEqual(document_payload["latest_import_job"]["id"], job_id)
        self.assertEqual(document_payload["latest_import_job"]["status"], "queued")

    def test_repair_detail_does_not_expose_foreign_source_document_id_from_legacy_relation_drift(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        repair_id = payload["document"]["repair"]["id"]
        local_document_id = payload["document"]["id"]

        with self.SessionLocal() as db:
            local_repair = db.get(Repair, repair_id)
            self.assertIsNotNone(local_repair)
            assert local_repair is not None

            foreign_vehicle = Vehicle(
                external_id="truck-foreign-source",
                vehicle_type=VehicleType.TRUCK,
                plate_number="X123YZ116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add(foreign_vehicle)
            db.flush()

            foreign_repair = Repair(
                order_number="ZN-FOREIGN-001",
                repair_date=date(2025, 1, 20),
                vehicle_id=foreign_vehicle.id,
                created_by_user_id=1,
                mileage=45000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(foreign_repair)
            db.flush()

            foreign_document = Document(
                repair_id=foreign_repair.id,
                uploaded_by_user_id=1,
                original_filename="foreign-source.pdf",
                storage_key="documents/test/foreign-source.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add(foreign_document)
            db.flush()

            local_repair.source_document_id = foreign_document.id
            db.commit()

        response = self.client.get(f"/api/repairs/{repair_id}", headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        repair_payload = response.json()

        self.assertEqual(repair_payload["source_document_id"], local_document_id)
        self.assertEqual([item["id"] for item in repair_payload["documents"]], [local_document_id])

    def test_archived_document_cannot_become_primary(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        repair_id = payload["document"]["repair"]["id"]

        with self.SessionLocal() as db:
            archived_document = Document(
                repair_id=repair_id,
                uploaded_by_user_id=1,
                original_filename="archived-repeat.pdf",
                storage_key="documents/test/archived-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.ARCHIVED,
                is_primary=False,
                review_queue_priority=0,
            )
            db.add(archived_document)
            db.commit()
            archived_document_id = archived_document.id

        response = self.client.post(f"/api/documents/{archived_document_id}/set-primary", headers=headers)

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Archived documents cannot be primary")

    def test_document_cannot_be_compared_with_itself(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]

        response = self.client.get(
            f"/api/documents/{document_id}/compare",
            headers=headers,
            params={"with_document_id": document_id},
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Cannot compare a document with itself")

    def test_upload_multiple_images_merges_into_single_pdf_and_queues_job(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.post(
            "/api/documents/upload",
            headers=headers,
            files=[
                ("files", ("page-1.png", self._make_png_bytes((220, 20, 60)), "image/png")),
                ("files", ("page-2.png", self._make_png_bytes((65, 105, 225)), "image/png")),
            ],
            data={"kind": "order"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["document"]["mime_type"], "application/pdf")
        self.assertEqual(payload["document"]["source_type"], "pdf")
        self.assertEqual(payload["document"]["parsed_payload"]["upload_mode"], "merged_images")
        self.assertEqual(len(payload["document"]["parsed_payload"]["uploaded_files"]), 2)
        self.assertTrue(payload["document"]["original_filename"].endswith(".pdf"))

        with self.SessionLocal() as db:
            document = db.get(Document, payload["document"]["id"])
            self.assertIsNotNone(document)
            assert document is not None
            stored_path = self.storage_root / document.storage_key
            self.assertTrue(stored_path.exists())
            self.assertTrue(stored_path.read_bytes().startswith(b"%PDF"))

    def test_worker_processing_uses_overridden_storage_root(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]
        job_id = payload["job_id"]

        sample_text = """
Общество с ограниченной ответственностью "ЛидерТрак"
НАРЯД-ЗАКАЗ № ЛТ250012276 от 25.12.2025
Автомобиль:
FH13A42T, гос. номер: 879КВА716, шасси: YV2RT40A7LA856012, пробег: 172274
Причина
обращения:
ТО основное с заменой масла+салонный фильтр
На холостом ходу при малых оборотах вибрации по кабине.
Выполненные сервисные услуги и использованные материалы
1 ZZ000253133903 Масло моторное синтетическое DONGFENG Diesel Ultra CS, EURO-6 10W40, бочка 205 л. 37 литр 447,16 992,68 15 717,50 3 143,50 18 861,00
Рекомендации:
неисправности по вибрации по кабине на момент осмотра не обнаружено, подушки двс в норме
"""

        with patch("app.services.document_processing.extract_document_text", return_value=(sample_text, "pdf_text", None)):
            from app.services.import_jobs import claim_next_document_processing_job, run_document_processing_job

            with self.SessionLocal() as db:
                next_job = claim_next_document_processing_job(db)
                self.assertIsNotNone(next_job)
                assert next_job is not None
                self.assertEqual(next_job.id, job_id)

            with self.SessionLocal() as db:
                attached_job = db.get(ImportJob, job_id)
                self.assertIsNotNone(attached_job)
                assert attached_job is not None
                run_document_processing_job(db, attached_job)

        with self.SessionLocal() as db:
            document = db.get(Document, document_id)
            self.assertIsNotNone(document)
            assert document is not None
            self.assertNotEqual(document.status, DocumentStatus.OCR_ERROR)
            latest_job = db.get(ImportJob, job_id)
            self.assertIsNotNone(latest_job)
            assert latest_job is not None
            self.assertIn(latest_job.status, {ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_CONFLICTS})
            self.assertTrue((self.storage_root / document.storage_key).exists())

    def test_database_rejects_queued_duplicate_while_document_is_processing(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        document_id = payload["document"]["id"]
        active_job_id = payload["job_id"]

        with self.SessionLocal() as db:
            active_job = db.get(ImportJob, active_job_id)
            self.assertIsNotNone(active_job)
            assert active_job is not None

            active_job.status = ImportStatus.PROCESSING
            active_job.started_at = datetime(2025, 1, 2, 10, 0, 0)
            db.commit()

        with self.SessionLocal() as db:
            document = db.get(Document, document_id)
            self.assertIsNotNone(document)
            assert document is not None

            db.add(
                ImportJob(
                    document_id=document_id,
                    import_type="document_ocr",
                    source_filename=document.original_filename,
                    status=ImportStatus.QUEUED,
                    summary={"document_id": document_id, "stage": "queued_duplicate"},
                    error_message=None,
                    attempts=0,
                    started_at=None,
                    finished_at=None,
                )
            )
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()

            jobs = db.query(ImportJob).filter(ImportJob.document_id == document_id).order_by(ImportJob.id.asc()).all()
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0].id, active_job_id)
            self.assertEqual(jobs[0].status, ImportStatus.PROCESSING)

    def test_upload_rolls_back_document_and_file_when_queueing_fails(self) -> None:
        headers = self._get_auth_headers()
        files_before = sorted(
            str(path.relative_to(self.storage_root))
            for path in self.storage_root.rglob("*")
            if path.is_file()
        )

        with patch.object(documents_api, "queue_document_processing", side_effect=RuntimeError("queue unavailable")):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    "/api/documents/upload",
                    headers=headers,
                    files={"file": ("job-test.pdf", b"%PDF-1.4\n%test\n", "application/pdf")},
                    data={"kind": "order"},
                )

        with self.SessionLocal() as db:
            self.assertEqual(db.query(Document).count(), 0)
            self.assertEqual(db.query(Repair).count(), 0)
            self.assertEqual(db.query(ImportJob).count(), 0)

        files_after = sorted(
            str(path.relative_to(self.storage_root))
            for path in self.storage_root.rglob("*")
            if path.is_file()
        )
        self.assertEqual(files_after, files_before)

    def test_link_vehicle_rolls_back_when_queueing_fails(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-ROLLBACK",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            target_vehicle = Vehicle(
                external_id="truck-target-rollback",
                vehicle_type=VehicleType.TRUCK,
                plate_number="M111MM116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, target_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-LINK-ROLLBACK-001",
                repair_date=date(2025, 1, 21),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=1,
                mileage=150000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=1,
                original_filename="rollback-order.pdf",
                storage_key="documents/test/rollback-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add(document)
            db.flush()

            repair.source_document_id = document.id
            db.commit()

            document_id = document.id
            repair_id = repair.id
            placeholder_vehicle_id = placeholder_vehicle.id
            target_vehicle_id = target_vehicle.id

        with patch.object(documents_api, "queue_document_processing", side_effect=RuntimeError("queue unavailable")):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    f"/api/documents/{document_id}/link-vehicle",
                    headers=headers,
                    json={"vehicle_id": target_vehicle_id},
                )

        with self.SessionLocal() as db:
            refreshed_document = db.get(Document, document_id)
            refreshed_repair = db.get(Repair, repair_id)
            self.assertIsNotNone(refreshed_document)
            self.assertIsNotNone(refreshed_repair)
            assert refreshed_document is not None
            assert refreshed_repair is not None

            self.assertEqual(refreshed_document.status, DocumentStatus.NEEDS_REVIEW)
            self.assertEqual(refreshed_repair.vehicle_id, placeholder_vehicle_id)
            self.assertEqual(db.query(ImportJob).filter(ImportJob.document_id == document_id).count(), 0)

    def test_export_status_and_warnings_follow_executive_report_findings(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        repair_id = payload["document"]["repair"]["id"]
        job_id = payload["job_id"]

        sample_text = """
Общество с ограниченной ответственностью "ЛидерТрак"
НАРЯД-ЗАКАЗ № ЛТ250012276 от 25.12.2025
Автомобиль:
FH13A42T, гос. номер: 879КВА716, шасси: YV2RT40A7LA856012, пробег: 172274
Причина
обращения:
ТО основное с заменой масла+салонный фильтр
На холостом ходу при малых оборотах вибрации по кабине.
Выполненные сервисные услуги и использованные материалы
1 ZZ000253133903 Масло моторное синтетическое DONGFENG Diesel Ultra CS, EURO-6 10W40, бочка 205 л. 37 литр 447,16 992,68 15 717,50 3 143,50 18 861,00
Рекомендации:
неисправности по вибрации по кабине на момент осмотра не обнаружено, подушки двс в норме
"""

        with patch("app.services.document_processing.extract_document_text", return_value=(sample_text, "pdf_text", None)):
            from app.services.import_jobs import claim_next_document_processing_job, run_document_processing_job

            with self.SessionLocal() as db:
                next_job = claim_next_document_processing_job(db)
                self.assertIsNotNone(next_job)
                assert next_job is not None
                self.assertEqual(next_job.id, job_id)

            with self.SessionLocal() as db:
                attached_job = db.get(ImportJob, job_id)
                self.assertIsNotNone(attached_job)
                assert attached_job is not None
                run_document_processing_job(db, attached_job)

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            report_status, report_status_comment = build_report_status_summary(repair)
            warning_rows = build_export_warning_rows(repair)

        self.assertEqual(report_status, "Есть критичные несоответствия")
        self.assertIn("ручная проверка", report_status_comment)
        self.assertTrue(any(row[2] == "По заявленной вибрации проблема не подтверждена" for row in warning_rows))
        self.assertTrue(any(row[2] == "Моторное масло требует проверки на соответствие Volvo" for row in warning_rows))

    def test_report_status_stays_in_ocr_queue_when_source_document_job_is_processing(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        repair_id = payload["document"]["repair"]["id"]
        document_id = payload["document"]["id"]
        job_id = payload["job_id"]

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            document = db.get(Document, document_id)
            job = db.get(ImportJob, job_id)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            self.assertIsNotNone(job)
            assert repair is not None
            assert document is not None
            assert job is not None

            repair.source_document_id = document.id
            document.status = DocumentStatus.RECOGNIZED
            job.status = ImportStatus.PROCESSING
            db.add(repair)
            db.add(document)
            db.add(job)
            db.commit()
            db.refresh(repair)

            report_status, report_status_comment = build_report_status_summary(repair)

        self.assertEqual(report_status, "В очереди OCR")
        self.assertIn("обработке", report_status_comment)

    def test_attach_multiple_images_to_existing_repair_merges_into_single_pdf(self) -> None:
        headers = self._get_auth_headers()
        initial_payload = self._upload_order_document(headers)
        repair_id = initial_payload["document"]["repair"]["id"]

        response = self.client.post(
            "/api/documents/upload-to-repair",
            headers=headers,
            files=[
                ("files", ("scan-1.png", self._make_png_bytes((34, 139, 34)), "image/png")),
                ("files", ("scan-2.png", self._make_png_bytes((255, 140, 0)), "image/png")),
            ],
            data={"repair_id": str(repair_id), "kind": "repeat_scan"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["document"]["repair"]["id"], repair_id)
        self.assertEqual(payload["document"]["mime_type"], "application/pdf")
        self.assertEqual(payload["document"]["source_type"], "pdf")
        self.assertEqual(payload["document"]["parsed_payload"]["upload_mode"], "merged_images")
        self.assertFalse(payload["document"]["is_primary"])

    def test_repair_and_vehicle_pdf_exports_return_pdf_files(self) -> None:
        headers = self._get_auth_headers()
        payload = self._upload_order_document(headers)
        repair_id = payload["document"]["repair"]["id"]
        vehicle_id = payload["document"]["vehicle"]["id"]

        repair_response = self.client.get(f"/api/repairs/{repair_id}/export.pdf", headers=headers)
        self.assertEqual(repair_response.status_code, 200, repair_response.text)
        self.assertIn("application/pdf", repair_response.headers["content-type"])
        self.assertIn('.pdf"', repair_response.headers["content-disposition"])
        self.assertTrue(repair_response.content.startswith(b"%PDF"))

        vehicle_response = self.client.get(f"/api/vehicles/{vehicle_id}/export.pdf", headers=headers)
        self.assertEqual(vehicle_response.status_code, 200, vehicle_response.text)
        self.assertIn("application/pdf", vehicle_response.headers["content-type"])
        self.assertIn('.pdf"', vehicle_response.headers["content-disposition"])
        self.assertTrue(vehicle_response.content.startswith(b"%PDF"))

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
