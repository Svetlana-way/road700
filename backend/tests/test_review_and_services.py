from __future__ import annotations

import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import services as services_api
from app.api import documents as documents_api
from app.api.deps import get_db
from app.core.paths import get_storage_root, set_storage_root
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.audit import AuditLog
from app.models.document import Document, DocumentVersion
from app.models.enums import CatalogStatus, CheckSeverity, DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair, RepairCheck, RepairPart, RepairWork
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory
from app.services.service_catalog import (
    ServiceCatalogEntry,
    ensure_service_catalog_synced,
    find_service_catalog_entry,
    resolve_service_by_name,
)
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class ReviewAndServicesApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.storage_root.mkdir(parents=True, exist_ok=True)
        cls.original_storage_root = get_storage_root()
        set_storage_root(cls.storage_root)
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
        set_storage_root(cls.original_storage_root)
        cls.engine.dispose()
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

        with self.SessionLocal() as db:
            admin = User(
                full_name="Admin User",
                login="admin",
                email="admin@example.com",
                password_hash=get_password_hash("secret123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            employee = User(
                full_name="Employee User",
                login="employee",
                email="employee@example.com",
                password_hash=get_password_hash("secret123"),
                role=UserRole.EMPLOYEE,
                is_active=True,
            )
            db.add_all([admin, employee])
            db.flush()

            vehicle = Vehicle(
                external_id="truck-1",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A123BC116",
                brand="Dong Feng",
                model="KL",
                status=VehicleStatus.ACTIVE,
            )
            service = Service(
                name="Service Alpha",
                city="Kazan",
                status=ServiceStatus.CONFIRMED,
                created_by_user_id=admin.id,
                confirmed_by_user_id=admin.id,
            )
            db.add_all([vehicle, service])
            db.flush()

            db.add(
                VehicleAssignmentHistory(
                    vehicle_id=vehicle.id,
                    user_id=employee.id,
                    starts_at=date(2025, 1, 1),
                    ends_at=None,
                    assigned_by_user_id=admin.id,
                    comment="Primary assignment",
                )
            )

            repair = Repair(
                order_number="ZN-001",
                repair_date=date(2025, 1, 15),
                vehicle_id=vehicle.id,
                service_id=service.id,
                created_by_user_id=employee.id,
                mileage=120000,
                grand_total=15000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.flush()

            db.add(
                Document(
                    repair_id=repair.id,
                    uploaded_by_user_id=employee.id,
                    original_filename="repair-order.pdf",
                    storage_key="documents/test/repair-order.pdf",
                    mime_type="application/pdf",
                    source_type="pdf",
                    kind=DocumentKind.ORDER,
                    status=DocumentStatus.NEEDS_REVIEW,
                    is_primary=True,
                    review_queue_priority=100,
                )
            )
            db.commit()

    def _get_auth_headers(self, username: str, password: str = "secret123") -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_employee_can_execute_review_action_for_assigned_vehicle(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            document = db.get(Document, 1)
            self.assertIsNotNone(document)
            document_id = document.id

        response = self.client.post(
            f"/api/review/queue/{document_id}/action",
            headers=headers,
            json={"action": "send_to_review", "comment": "Need another pass"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["document_status"], "needs_review")
        self.assertEqual(payload["repair_status"], "in_review")

    def test_employee_cannot_confirm_repair_with_unresolved_findings(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            self.assertIsNotNone(repair)
            assert repair is not None
            db.add(
                RepairCheck(
                    repair_id=repair.id,
                    check_type="ocr_total_mismatch",
                    severity=CheckSeverity.SUSPICIOUS,
                    title="Сумма строк не совпадает с итоговой суммой",
                    details="Требуется ручная проверка",
                    is_resolved=False,
                )
            )
            db.commit()

        response = self.client.post(
            "/api/review/queue/1/action",
            headers=headers,
            json={"action": "employee_confirm", "comment": "Проверил"},
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertIn("Сначала разберите все предупреждения", response.json()["detail"])

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            self.assertEqual(repair.status, RepairStatus.IN_REVIEW)
            self.assertEqual(document.status, DocumentStatus.NEEDS_REVIEW)

    def test_employee_resolving_last_check_does_not_bypass_review_confirmation(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            document.status = DocumentStatus.RECOGNIZED
            check = RepairCheck(
                repair_id=repair.id,
                check_type="ocr_service_missing",
                severity=CheckSeverity.WARNING,
                title="Не удалось определить сервис",
                details="Сервис у ремонта не назначен. Нужна ручная проверка.",
                is_resolved=False,
            )
            db.add(check)
            db.commit()
            check_id = check.id

        response = self.client.patch(
            f"/api/repairs/1/checks/{check_id}",
            headers=headers,
            json={"is_resolved": True, "comment": "Проверил предупреждение"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["status"], RepairStatus.IN_REVIEW.value)
        patched_check = next(item for item in payload["checks"] if item["id"] == check_id)
        self.assertTrue(patched_check["is_resolved"])

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            self.assertEqual(repair.status, RepairStatus.IN_REVIEW)
            self.assertEqual(document.status, DocumentStatus.RECOGNIZED)

    def test_employee_can_access_own_preliminary_repair_after_server_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign",
                vehicle_type=VehicleType.TRUCK,
                plate_number="B456CD116",
                brand="Sitrak",
                model="C7H",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-001",
                repair_date=date(2025, 1, 16),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=1000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-order.pdf",
                storage_key="documents/test/uploaded-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            repair_id = repair.id
            document_id = document.id

        repair_response = self.client.get(f"/api/repairs/{repair_id}", headers=headers)
        self.assertEqual(repair_response.status_code, 200, repair_response.text)
        self.assertEqual(repair_response.json()["id"], repair_id)

        documents_response = self.client.get("/api/documents?limit=8", headers=headers)
        self.assertEqual(documents_response.status_code, 200, documents_response.text)
        visible_document_ids = [item["id"] for item in documents_response.json()["items"]]
        self.assertIn(document_id, visible_document_ids)

    def test_employee_can_execute_review_action_for_own_preliminary_repair_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-2",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-2",
                vehicle_type=VehicleType.TRUCK,
                plate_number="C789EF116",
                brand="Howo",
                model="T5G",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-REVIEW-001",
                repair_date=date(2025, 1, 17),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=2000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-review-order.pdf",
                storage_key="documents/test/uploaded-review-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            document_id = document.id

        response = self.client.post(
            f"/api/review/queue/{document_id}/action",
            headers=headers,
            json={"action": "send_to_review", "comment": "Повторная ручная проверка"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["document_status"], DocumentStatus.NEEDS_REVIEW.value)
        self.assertEqual(payload["repair_status"], RepairStatus.IN_REVIEW.value)

    def test_employee_can_reprocess_own_preliminary_document_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-3",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-3",
                vehicle_type=VehicleType.TRUCK,
                plate_number="D012GH116",
                brand="Foton",
                model="Auman",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-PROCESS-001",
                repair_date=date(2025, 1, 18),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=3000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-process-order.pdf",
                storage_key="documents/test/uploaded-process-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            document_id = document.id

        with patch.object(documents_api, "queue_document_processing", autospec=True) as queue_mock:
            queue_mock.return_value = type(
                "QueuedJobStub",
                (),
                {"id": 501, "status": type("JobStatusStub", (), {"value": "queued"})()},
            )()

            response = self.client.post(
                f"/api/documents/{document_id}/process",
                headers=headers,
            )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["document"]["id"], document_id)
        self.assertEqual(payload["job_id"], 501)
        self.assertEqual(payload["import_status"], "queued")
        queue_mock.assert_called_once()

    def test_dashboard_summary_includes_own_preliminary_repair_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-4",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-4",
                vehicle_type=VehicleType.TRUCK,
                plate_number="E345IJ116",
                brand="Shaanxi",
                model="X3000",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-DASH-001",
                repair_date=date(2025, 1, 19),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=4000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-dashboard-order.pdf",
                storage_key="documents/test/uploaded-dashboard-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.commit()

        response = self.client.get("/api/dashboard/summary", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["vehicles_total"], 1)
        self.assertEqual(payload["repairs_total"], 2)
        self.assertEqual(payload["documents_total"], 2)
        self.assertEqual(payload["documents_review_queue"], 2)

    def test_dashboard_details_include_own_preliminary_document_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-5",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-5",
                vehicle_type=VehicleType.TRUCK,
                plate_number="F678KL116",
                brand="JAC",
                model="K7",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-DQ-001",
                repair_date=date(2025, 1, 20),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=5000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-dashboard-details-order.pdf",
                storage_key="documents/test/uploaded-dashboard-details-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=130,
                ocr_confidence=0.42,
            )
            db.add(document)
            db.flush()

            repair.source_document_id = document.id
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            document_id = document.id

        quality_response = self.client.get("/api/dashboard/data-quality", headers=headers)
        self.assertEqual(quality_response.status_code, 200, quality_response.text)
        quality_payload = quality_response.json()
        self.assertEqual(quality_payload["documents_needs_review"], 2)
        self.assertEqual(quality_payload["documents_low_confidence"], 1)

        details_response = self.client.get("/api/dashboard/data-quality/details?limit=8", headers=headers)
        self.assertEqual(details_response.status_code, 200, details_response.text)
        details_payload = details_response.json()
        self.assertEqual(details_payload["counts"]["documents"], 2)
        visible_document_ids = [item["document_id"] for item in details_payload["documents"]]
        self.assertIn(document_id, visible_document_ids)

    def test_dashboard_work_and_part_items_ignore_legacy_foreign_source_document_id(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(admin)
            assert admin is not None

            local_vehicle = Vehicle(
                external_id="truck-dashboard-local",
                vehicle_type=VehicleType.TRUCK,
                plate_number="E555EE116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-dashboard-foreign",
                vehicle_type=VehicleType.TRUCK,
                plate_number="F666FF116",
                brand="Scania",
                model="R",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([local_vehicle, foreign_vehicle])
            db.flush()

            local_repair = Repair(
                order_number="ZN-DASH-LOCAL-001",
                repair_date=date(2025, 1, 24),
                vehicle_id=local_vehicle.id,
                created_by_user_id=admin.id,
                mileage=21000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            foreign_repair = Repair(
                order_number="ZN-DASH-FOREIGN-001",
                repair_date=date(2025, 1, 25),
                vehicle_id=foreign_vehicle.id,
                created_by_user_id=admin.id,
                mileage=22000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add_all([local_repair, foreign_repair])
            db.flush()

            local_document = Document(
                repair_id=local_repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="dashboard-local-primary.pdf",
                storage_key="documents/test/dashboard-local-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            foreign_document = Document(
                repair_id=foreign_repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="dashboard-foreign-primary.pdf",
                storage_key="documents/test/dashboard-foreign-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add_all([local_document, foreign_document])
            db.flush()

            local_repair.source_document_id = foreign_document.id
            db.add_all(
                [
                    RepairWork(
                        repair_id=local_repair.id,
                        work_code="PRE-001",
                        work_name="Предварительная диагностика",
                        quantity=1,
                        price=1500,
                        line_total=1500,
                        status=CatalogStatus.PRELIMINARY,
                    ),
                    RepairPart(
                        repair_id=local_repair.id,
                        article="P-001",
                        part_name="Тестовая деталь",
                        quantity=1,
                        price=2500,
                        line_total=2500,
                        status=CatalogStatus.PRELIMINARY,
                    ),
                ]
            )
            db.commit()
            local_document_id = local_document.id

        response = self.client.get("/api/dashboard/data-quality/details?limit=8", headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        work_item = next(item for item in payload["works"] if item["work_name"] == "Предварительная диагностика")
        part_item = next(item for item in payload["parts"] if item["part_name"] == "Тестовая деталь")
        self.assertEqual(work_item["document_id"], local_document_id)
        self.assertEqual(part_item["document_id"], local_document_id)

    def test_employee_sees_audit_entries_for_own_preliminary_repair_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(employee)
            self.assertIsNotNone(admin)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-6",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-6",
                vehicle_type=VehicleType.TRUCK,
                plate_number="G901MN116",
                brand="FAW",
                model="J7",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-AUDIT-001",
                repair_date=date(2025, 1, 21),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=6000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-audit-order.pdf",
                storage_key="documents/test/uploaded-audit-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.flush()

            db.add_all(
                [
                    AuditLog(
                        user_id=admin.id,
                        entity_type="repair",
                        entity_id=str(repair.id),
                        action_type="admin_repair_note",
                        old_value=None,
                        new_value={"repair_id": repair.id},
                    ),
                    AuditLog(
                        user_id=admin.id,
                        entity_type="document",
                        entity_id=str(document.id),
                        action_type="admin_document_note",
                        old_value=None,
                        new_value={"document_id": document.id},
                    ),
                ]
            )
            db.commit()

        response = self.client.get("/api/audit?limit=50", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        action_types = [item["action_type"] for item in payload["items"]]
        self.assertIn("admin_repair_note", action_types)
        self.assertIn("admin_document_note", action_types)

    def test_employee_can_download_own_preliminary_document_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-7",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-7",
                vehicle_type=VehicleType.TRUCK,
                plate_number="H234OP116",
                brand="Sitrak",
                model="C7H Max",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-DOWNLOAD-001",
                repair_date=date(2025, 1, 22),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=7000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-download-order.pdf",
                storage_key="documents/test/uploaded-download-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            document_id = document.id
            storage_key = document.storage_key

        file_path = self.storage_root / storage_key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(b"%PDF-1.4\n%relink-download-test\n")

        response = self.client.get(
            f"/api/documents/{document_id}/download",
            headers=headers,
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn("application/pdf", response.headers["content-type"])
        self.assertTrue(response.content.startswith(b"%PDF-1.4"))

    def test_employee_can_export_own_preliminary_repair_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-8",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-8",
                vehicle_type=VehicleType.TRUCK,
                plate_number="J567RS116",
                brand="Mercedes-Benz",
                model="Actros",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-EXPORT-001",
                repair_date=date(2025, 1, 23),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=8000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="uploaded-export-order.pdf",
                storage_key="documents/test/uploaded-export-order.pdf",
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
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            repair_id = repair.id

        xlsx_response = self.client.get(
            f"/api/repairs/{repair_id}/export",
            headers=headers,
        )
        self.assertEqual(xlsx_response.status_code, 200, xlsx_response.text)
        self.assertIn(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            xlsx_response.headers["content-type"],
        )
        self.assertTrue(xlsx_response.content.startswith(b"PK"))

        pdf_response = self.client.get(
            f"/api/repairs/{repair_id}/export.pdf",
            headers=headers,
        )
        self.assertEqual(pdf_response.status_code, 200, pdf_response.text)
        self.assertIn("application/pdf", pdf_response.headers["content-type"])
        self.assertTrue(pdf_response.content.startswith(b"%PDF"))

    def test_employee_can_compare_own_preliminary_documents_after_vehicle_relink(self) -> None:
        headers = self._get_auth_headers("employee")

        with self.SessionLocal() as db:
            employee = db.scalar(select(User).where(User.login == "employee"))
            self.assertIsNotNone(employee)

            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number="PLACEHOLDER-9",
                brand="Placeholder",
                model="Upload",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-foreign-9",
                vehicle_type=VehicleType.TRUCK,
                plate_number="K890TU116",
                brand="MAN",
                model="TGX",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([placeholder_vehicle, foreign_vehicle])
            db.flush()

            repair = Repair(
                order_number="ZN-UPL-COMPARE-001",
                repair_date=date(2025, 1, 24),
                vehicle_id=placeholder_vehicle.id,
                created_by_user_id=employee.id,
                mileage=9000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            primary_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="compare-primary.pdf",
                storage_key="documents/test/compare-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            repeat_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="compare-repeat.pdf",
                storage_key="documents/test/compare-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=90,
            )
            db.add_all([primary_document, repeat_document])
            db.flush()

            db.add_all(
                [
                    DocumentVersion(
                        document_id=primary_document.id,
                        version_number=1,
                        storage_key=primary_document.storage_key,
                        parsed_payload={
                            "extracted_fields": {
                                "order_number": "ZN-UPL-COMPARE-001",
                                "grand_total": 10000,
                            },
                            "extracted_items": {
                                "works": [{"name": "ТО"}],
                                "parts": [{"name": "Фильтр"}],
                            },
                        },
                        field_confidence_map={},
                        change_summary="Primary OCR",
                    ),
                    DocumentVersion(
                        document_id=repeat_document.id,
                        version_number=1,
                        storage_key=repeat_document.storage_key,
                        parsed_payload={
                            "extracted_fields": {
                                "order_number": "ZN-UPL-COMPARE-001-R2",
                                "grand_total": 12500,
                            },
                            "extracted_items": {
                                "works": [{"name": "ТО"}, {"name": "Диагностика"}],
                                "parts": [{"name": "Фильтр"}, {"name": "Масло"}],
                            },
                        },
                        field_confidence_map={},
                        change_summary="Repeat OCR",
                    ),
                ]
            )

            repair.source_document_id = primary_document.id
            repair.vehicle_id = foreign_vehicle.id
            db.commit()
            primary_document_id = primary_document.id
            repeat_document_id = repeat_document.id

        response = self.client.get(
            f"/api/documents/{repeat_document_id}/compare",
            headers=headers,
            params={"with_document_id": primary_document_id},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["left_document"]["id"], repeat_document_id)
        self.assertEqual(payload["right_document"]["id"], primary_document_id)
        self.assertEqual(payload["works_count_left"], 2)
        self.assertEqual(payload["works_count_right"], 1)
        self.assertEqual(payload["parts_count_left"], 2)
        self.assertEqual(payload["parts_count_right"], 1)
        differing_fields = {item["field_name"] for item in payload["compared_fields"] if item["is_different"]}
        self.assertIn("order_number", differing_fields)
        self.assertIn("grand_total", differing_fields)

    def test_admin_can_review_comparison_and_promote_document_to_primary(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(admin)

            comparison_vehicle = Vehicle(
                external_id="truck-compare-admin",
                vehicle_type=VehicleType.TRUCK,
                plate_number="L123UV116",
                brand="Volvo",
                model="FH",
                status=VehicleStatus.ACTIVE,
            )
            db.add(comparison_vehicle)
            db.flush()

            repair = Repair(
                order_number="ZN-ADMIN-COMPARE-001",
                repair_date=date(2025, 1, 25),
                vehicle_id=comparison_vehicle.id,
                created_by_user_id=admin.id,
                mileage=10000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            primary_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="admin-primary.pdf",
                storage_key="documents/test/admin-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            candidate_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="admin-repeat.pdf",
                storage_key="documents/test/admin-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=90,
            )
            db.add_all([primary_document, candidate_document])
            db.flush()

            repair.source_document_id = primary_document.id
            db.commit()
            primary_document_id = primary_document.id
            candidate_document_id = candidate_document.id
            repair_id = repair.id

        response = self.client.post(
            f"/api/documents/{candidate_document_id}/compare/review",
            headers=headers,
            json={
                "with_document_id": primary_document_id,
                "action": "make_document_primary",
                "comment": "Повторный скан качественнее",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["action"], "make_document_primary")
        self.assertEqual(payload["document_id"], candidate_document_id)
        self.assertEqual(payload["repair_id"], repair_id)
        self.assertEqual(payload["source_document_id"], candidate_document_id)

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            new_primary = db.get(Document, candidate_document_id)
            old_primary = db.get(Document, primary_document_id)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(new_primary)
            self.assertIsNotNone(old_primary)
            assert repair is not None
            assert new_primary is not None
            assert old_primary is not None
            self.assertEqual(repair.source_document_id, candidate_document_id)
            self.assertTrue(new_primary.is_primary)
            self.assertFalse(old_primary.is_primary)
            self.assertIn("Повторный скан качественнее", new_primary.notes or "")

    def test_comparison_review_accepts_canonical_source_document_even_if_primary_flag_drifted(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(admin)
            assert admin is not None

            vehicle = Vehicle(
                external_id="truck-compare-primary-drift",
                vehicle_type=VehicleType.TRUCK,
                plate_number="P777PP116",
                brand="Mercedes",
                model="Actros",
                status=VehicleStatus.ACTIVE,
            )
            db.add(vehicle)
            db.flush()

            repair = Repair(
                order_number="ZN-COMPARE-PRIMARY-DRIFT",
                repair_date=date(2025, 1, 28),
                vehicle_id=vehicle.id,
                created_by_user_id=admin.id,
                mileage=18000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            primary_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="canonical-source.pdf",
                storage_key="documents/test/canonical-source.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=100,
            )
            candidate_document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="candidate-repeat.pdf",
                storage_key="documents/test/candidate-repeat-drift.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=90,
            )
            db.add_all([primary_document, candidate_document])
            db.flush()

            repair.source_document_id = primary_document.id
            db.commit()
            primary_document_id = primary_document.id
            candidate_document_id = candidate_document.id

        response = self.client.post(
            f"/api/documents/{candidate_document_id}/compare/review",
            headers=headers,
            json={
                "with_document_id": primary_document_id,
                "action": "keep_current_primary",
                "comment": "canonical source should stay accepted",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["action"], "keep_current_primary")
        self.assertEqual(payload["source_document_id"], primary_document_id)

    def test_comparison_review_ignores_legacy_foreign_source_document_id_in_response_and_audit(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            admin = db.scalar(select(User).where(User.login == "admin"))
            self.assertIsNotNone(admin)
            assert admin is not None

            local_vehicle = Vehicle(
                external_id="truck-compare-drift-local",
                vehicle_type=VehicleType.TRUCK,
                plate_number="M321OP116",
                brand="MAN",
                model="TGX",
                status=VehicleStatus.ACTIVE,
            )
            foreign_vehicle = Vehicle(
                external_id="truck-compare-drift-foreign",
                vehicle_type=VehicleType.TRUCK,
                plate_number="N654QR116",
                brand="Scania",
                model="R",
                status=VehicleStatus.ACTIVE,
            )
            db.add_all([local_vehicle, foreign_vehicle])
            db.flush()

            local_repair = Repair(
                order_number="ZN-COMPARE-DRIFT-001",
                repair_date=date(2025, 1, 26),
                vehicle_id=local_vehicle.id,
                created_by_user_id=admin.id,
                mileage=12000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            foreign_repair = Repair(
                order_number="ZN-COMPARE-DRIFT-FOREIGN",
                repair_date=date(2025, 1, 27),
                vehicle_id=foreign_vehicle.id,
                created_by_user_id=admin.id,
                mileage=15000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add_all([local_repair, foreign_repair])
            db.flush()

            primary_document = Document(
                repair_id=local_repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="drift-primary.pdf",
                storage_key="documents/test/drift-primary.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            candidate_document = Document(
                repair_id=local_repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="drift-repeat.pdf",
                storage_key="documents/test/drift-repeat.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.REPEAT_SCAN,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=False,
                review_queue_priority=90,
            )
            foreign_document = Document(
                repair_id=foreign_repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="foreign-source.pdf",
                storage_key="documents/test/foreign-source-drift.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add_all([primary_document, candidate_document, foreign_document])
            db.flush()

            local_repair.source_document_id = foreign_document.id
            db.commit()
            primary_document_id = primary_document.id
            candidate_document_id = candidate_document.id
            local_repair_id = local_repair.id

        response = self.client.post(
            f"/api/documents/{candidate_document_id}/compare/review",
            headers=headers,
            json={
                "with_document_id": primary_document_id,
                "action": "keep_current_primary",
                "comment": "Оставляем текущий основной документ",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["action"], "keep_current_primary")
        self.assertEqual(payload["source_document_id"], primary_document_id)

        with self.SessionLocal() as db:
            repair = db.get(Repair, local_repair_id)
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertNotEqual(repair.source_document_id, primary_document_id)

            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "repair",
                    AuditLog.entity_id == str(local_repair_id),
                    AuditLog.action_type == "document_comparison_reviewed",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.old_value["source_document_id"], primary_document_id)
            self.assertEqual(audit_entry.new_value["source_document_id"], primary_document_id)

    def test_manual_service_assignment_updates_single_warning_without_duplicates(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None

            repair.service_id = None
            document.status = DocumentStatus.RECOGNIZED
            db.add(
                DocumentVersion(
                    document_id=document.id,
                    version_number=1,
                    storage_key=document.storage_key,
                    parsed_payload={
                        "extracted_fields": {},
                        "manual_review_reasons": ["service_name_missing"],
                    },
                    field_confidence_map={},
                    change_summary="Initial OCR payload",
                )
            )
            db.add(
                RepairCheck(
                    repair_id=repair.id,
                    check_type="ocr_service_missing",
                    severity=CheckSeverity.WARNING,
                    title="Не удалось определить сервис",
                    details="Сервис у ремонта не назначен. Нужна ручная проверка.",
                    calculation_payload={"reason": "service_name_missing"},
                    is_resolved=False,
                )
            )
            db.commit()

        assign_response = self.client.patch(
            "/api/repairs/1/service",
            headers=headers,
            json={"service_name": "Service Alpha"},
        )
        self.assertEqual(assign_response.status_code, 200, assign_response.text)

        repeat_assign_response = self.client.patch(
            "/api/repairs/1/service",
            headers=headers,
            json={"service_name": "Service Alpha"},
        )
        self.assertEqual(repeat_assign_response.status_code, 200, repeat_assign_response.text)

        clear_response = self.client.patch(
            "/api/repairs/1/service",
            headers=headers,
            json={"service_name": ""},
        )
        self.assertEqual(clear_response.status_code, 200, clear_response.text)

        restore_response = self.client.patch(
            "/api/repairs/1/service",
            headers=headers,
            json={"service_name": "Service Alpha"},
        )
        self.assertEqual(restore_response.status_code, 200, restore_response.text)

        payload = restore_response.json()
        service_checks = [item for item in payload["checks"] if item["check_type"] == "ocr_service_missing"]
        self.assertEqual(len(service_checks), 1)
        self.assertTrue(service_checks[0]["is_resolved"])
        self.assertEqual(payload["service"]["name"], "Service Alpha")
        latest_payload = payload["documents"][0]["versions"][0]["parsed_payload"]
        self.assertEqual(latest_payload["manual_review_reasons"], [])
        self.assertEqual(latest_payload["extracted_fields"]["service_name"], "Service Alpha")

    def test_admin_created_service_keeps_confirmed_status(self) -> None:
        headers = self._get_auth_headers("admin")

        with patch.object(services_api, "ensure_service_catalog_synced", autospec=True) as sync_mock, patch.object(
            services_api,
            "find_service_catalog_entry",
            autospec=True,
            return_value=None,
        ):
            sync_mock.return_value = ()
            response = self.client.post(
                "/api/services",
                headers=headers,
                json={
                    "name": "Custom Confirmed Service",
                    "city": "Moscow",
                    "status": "confirmed",
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["status"], "confirmed")
        self.assertIsNotNone(payload["confirmed_by_user_id"])

    def test_list_services_does_not_persist_sync_side_effects(self) -> None:
        headers = self._get_auth_headers("admin")

        def mutate_without_commit(db: Session, *, commit: bool = False):
            service_item = db.scalar(select(Service).where(Service.name == "Service Alpha"))
            self.assertIsNotNone(service_item)
            service_item.city = "Transient City"
            db.add(service_item)
            db.flush()
            return (service_item,)

        with patch.object(services_api, "ensure_service_catalog_synced", autospec=True, side_effect=mutate_without_commit):
            response = self.client.get("/api/services", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        service_payload = next(item for item in payload["items"] if item["name"] == "Service Alpha")
        self.assertEqual(service_payload["city"], "Transient City")

        with self.SessionLocal() as db:
            persisted = db.scalar(select(Service).where(Service.name == "Service Alpha"))
            self.assertIsNotNone(persisted)
            self.assertEqual(persisted.city, "Kazan")

    def test_confirmed_service_stays_visible_after_rename_outside_catalog(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            service_item = db.scalar(select(Service).where(Service.name == "Service Alpha"))
            self.assertIsNotNone(service_item)
            service_item.name = "Renamed Catalog Service"
            service_item.created_by_user_id = None
            service_item.confirmed_by_user_id = 1
            db.add(service_item)
            db.commit()

        with patch.object(services_api, "ensure_service_catalog_synced", autospec=True) as sync_mock, patch.object(
            services_api,
            "get_service_catalog_names",
            autospec=True,
            return_value=(),
        ):
            sync_mock.return_value = ()
            response = self.client.get("/api/services", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertTrue(any(item["name"] == "Renamed Catalog Service" for item in payload["items"]))

    def test_catalog_sync_preserves_admin_confirmed_overrides(self) -> None:
        with self.SessionLocal() as db:
            admin = db.scalar(select(User).where(User.login == "admin"))
            service_item = db.scalar(select(Service).where(Service.name == "Service Alpha"))
            self.assertIsNotNone(admin)
            self.assertIsNotNone(service_item)
            service_item.city = "Manual City"
            service_item.contact = "manual@example.com"
            service_item.comment = "Manual comment"
            service_item.status = ServiceStatus.CONFIRMED
            service_item.confirmed_by_user_id = admin.id
            db.add(service_item)
            db.commit()

            with patch(
                "app.services.service_catalog.get_service_catalog_entries",
                return_value=(
                    ServiceCatalogEntry(
                        name="Service Alpha",
                        city="Catalog City",
                        contact="catalog@example.com",
                        comment="Catalog comment",
                        aliases=("Service Alpha",),
                    ),
                ),
            ):
                ensure_service_catalog_synced(db, commit=False)

            db.refresh(service_item)
            self.assertEqual(service_item.city, "Manual City")
            self.assertEqual(service_item.contact, "manual@example.com")
            self.assertEqual(service_item.comment, "Manual comment")

    def test_builtin_fallback_catalog_syncs_axb_logistics_and_klever_services(self) -> None:
        with self.SessionLocal() as db:
            ensure_service_catalog_synced(db, commit=False)

            axb_service = db.scalar(select(Service).where(Service.name == "ООО «АХВ Трак Сервис»"))
            logistics_service = db.scalar(select(Service).where(Service.name == "ООО «ЛОГИСТИКА»"))
            klever_service = db.scalar(select(Service).where(Service.name == "ООО «КЛЕВЕР ТРАК»"))

            self.assertIsNotNone(axb_service)
            self.assertIsNotNone(logistics_service)
            self.assertIsNotNone(klever_service)
            self.assertEqual(axb_service.status, ServiceStatus.CONFIRMED)
            self.assertEqual(logistics_service.status, ServiceStatus.CONFIRMED)
            self.assertEqual(klever_service.status, ServiceStatus.CONFIRMED)

    def test_builtin_fallback_catalog_resolves_axb_logistics_and_klever_aliases(self) -> None:
        with self.SessionLocal() as db:
            axb_entry = find_service_catalog_entry("AXB")
            logistics_entry = find_service_catalog_entry('Общество с ограниченной ответственностью "ЛОГИСТИКА"')
            klever_entry = find_service_catalog_entry("Клевер Трак")

            self.assertIsNotNone(axb_entry)
            self.assertIsNotNone(logistics_entry)
            self.assertIsNotNone(klever_entry)
            self.assertEqual(axb_entry.name, "ООО «АХВ Трак Сервис»")
            self.assertEqual(logistics_entry.name, "ООО «ЛОГИСТИКА»")
            self.assertEqual(klever_entry.name, "ООО «КЛЕВЕР ТРАК»")

            axb_service = resolve_service_by_name(db, "AXB")
            logistics_service = resolve_service_by_name(
                db,
                'Общество с ограниченной ответственностью "ЛОГИСТИКА"',
            )
            klever_service = resolve_service_by_name(db, "Клевер Трак")

            self.assertIsNotNone(axb_service)
            self.assertIsNotNone(logistics_service)
            self.assertIsNotNone(klever_service)
            self.assertEqual(axb_service.name, "ООО «АХВ Трак Сервис»")
            self.assertEqual(logistics_service.name, "ООО «ЛОГИСТИКА»")

    def test_cannot_assign_employee_to_archived_vehicle(self) -> None:
        headers = self._get_auth_headers("admin")

        with self.SessionLocal() as db:
            archived_vehicle = Vehicle(
                external_id="truck-archived",
                vehicle_type=VehicleType.TRUCK,
                plate_number="X999XX116",
                brand="Archived",
                model="Truck",
                status=VehicleStatus.ARCHIVED,
            )
            db.add(archived_vehicle)
            db.commit()
            archived_vehicle_id = archived_vehicle.id

        response = self.client.post(
            "/api/users/2/vehicle-assignments",
            headers=headers,
            json={
                "vehicle_id": archived_vehicle_id,
                "starts_at": "2025-02-01",
            },
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Нельзя назначить сотрудника на архивную технику")

    def test_delete_endpoint_archives_repair_instead_of_removing_it(self) -> None:
        headers = self._get_auth_headers("admin")

        response = self.client.delete("/api/repairs/1", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["message"], "Заказ-наряд и связанные документы отправлены в архив")

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            self.assertEqual(repair.status, RepairStatus.ARCHIVED)
            self.assertEqual(document.status, DocumentStatus.ARCHIVED)


if __name__ == "__main__":
    unittest.main()
