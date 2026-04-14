from __future__ import annotations

import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.paths import get_storage_root, set_storage_root
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.document import Document
from app.models.enums import CheckSeverity, DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair, RepairCheck
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class Wave1DomainRegressionTestCase(unittest.TestCase):
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
                order_number="ZN-REG-001",
                repair_date=date(2025, 1, 15),
                vehicle_id=vehicle.id,
                service_id=service.id,
                created_by_user_id=employee.id,
                mileage=120000,
                reason="Regression coverage",
                employee_comment="Initial comment",
                work_total=10000,
                parts_total=3000,
                vat_total=2600,
                grand_total=15600,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=employee.id,
                original_filename="repair-order.pdf",
                storage_key="documents/test/regression-order.pdf",
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

    def _auth_headers(self, username: str, password: str = "secret123") -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_review_action_rejects_document_outside_review_queue(self) -> None:
        with self.SessionLocal() as db:
            document = db.get(Document, 1)
            repair = db.get(Repair, 1)
            self.assertIsNotNone(document)
            self.assertIsNotNone(repair)
            assert document is not None
            assert repair is not None
            document.status = DocumentStatus.CONFIRMED
            document.review_queue_priority = 0
            repair.status = RepairStatus.CONFIRMED
            db.commit()

        headers = self._auth_headers("employee")
        response = self.client.post(
            "/api/review/queue/1/action",
            headers=headers,
            json={"action": "send_to_review", "comment": "Regression check"},
        )

        self.assertIn(response.status_code, {400, 409}, response.text)

    def test_archived_repair_rejects_review_field_updates(self) -> None:
        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            repair.status = RepairStatus.ARCHIVED
            document.status = DocumentStatus.ARCHIVED
            document.review_queue_priority = 0
            db.commit()

        headers = self._auth_headers("employee")
        response = self.client.patch(
            "/api/repairs/1/review-fields",
            headers=headers,
            json={"employee_comment": "This must be rejected for archived repair"},
        )

        self.assertIn(response.status_code, {400, 409}, response.text)

    def test_employee_review_action_hides_document_for_archived_service(self) -> None:
        with self.SessionLocal() as db:
            service = db.get(Service, 1)
            self.assertIsNotNone(service)
            assert service is not None
            service.status = ServiceStatus.ARCHIVED
            db.commit()

        headers = self._auth_headers("employee")
        response = self.client.post(
            "/api/review/queue/1/action",
            headers=headers,
            json={"action": "send_to_review", "comment": "Should be hidden"},
        )

        self.assertEqual(response.status_code, 404, response.text)
        self.assertEqual(response.json()["detail"], "Document not found")

    def test_admin_patch_repair_preserves_existing_ocr_checks(self) -> None:
        with self.SessionLocal() as db:
            db.add(
                RepairCheck(
                    repair_id=1,
                    check_type="ocr_total_mismatch",
                    severity=CheckSeverity.SUSPICIOUS,
                    title="Сумма строк не совпадает с итоговой суммой",
                    details="Regression seed",
                    is_resolved=False,
                )
            )
            db.commit()

        headers = self._auth_headers("admin")
        response = self.client.patch(
            "/api/repairs/1",
            headers=headers,
            json={"employee_comment": "Updated by admin without touching checks"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(len(payload["checks"]), 1, payload["checks"])
        self.assertEqual(payload["checks"][0]["check_type"], "ocr_total_mismatch")

    def test_admin_patch_repair_rejects_null_required_fields(self) -> None:
        headers = self._auth_headers("admin")

        response = self.client.patch(
            "/api/repairs/1",
            headers=headers,
            json={"repair_date": None},
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Дата ремонта обязательна")

    def test_repair_archive_and_restore_use_explicit_endpoints(self) -> None:
        headers = self._auth_headers("admin")

        patch_response = self.client.patch(
            "/api/repairs/1",
            headers=headers,
            json={"status": "archived"},
        )
        self.assertEqual(patch_response.status_code, 409, patch_response.text)

        archive_response = self.client.post("/api/repairs/1/archive", headers=headers)
        self.assertEqual(archive_response.status_code, 200, archive_response.text)
        archived_payload = archive_response.json()
        self.assertEqual(archived_payload["status"], RepairStatus.ARCHIVED.value)
        self.assertTrue(all(item["status"] == DocumentStatus.ARCHIVED.value for item in archived_payload["documents"]))
        self.assertIsNone(archived_payload["source_document_id"])
        self.assertTrue(all(item["is_primary"] is False for item in archived_payload["documents"]))

        restore_response = self.client.post("/api/repairs/1/restore", headers=headers)
        self.assertEqual(restore_response.status_code, 200, restore_response.text)
        restored_payload = restore_response.json()
        self.assertEqual(restored_payload["status"], RepairStatus.IN_REVIEW.value)
        self.assertTrue(all(item["status"] == DocumentStatus.NEEDS_REVIEW.value for item in restored_payload["documents"]))
        self.assertEqual(restored_payload["source_document_id"], 1)
        self.assertTrue(any(item["id"] == 1 and item["is_primary"] is True for item in restored_payload["documents"]))

    def test_repair_admin_mutations_return_not_found_for_legacy_missing_vehicle_relation(self) -> None:
        headers = self._auth_headers("admin")

        with self.SessionLocal() as db:
            db.execute(text("PRAGMA foreign_keys = OFF"))
            db.execute(text("UPDATE repairs SET vehicle_id = 999999 WHERE id = 1"))
            db.commit()
            db.execute(text("PRAGMA foreign_keys = ON"))

        patch_response = self.client.patch(
            "/api/repairs/1",
            headers=headers,
            json={"employee_comment": "legacy drift should not 500"},
        )
        self.assertEqual(patch_response.status_code, 404, patch_response.text)
        self.assertEqual(patch_response.json()["detail"], "Repair not found")

        archive_response = self.client.post("/api/repairs/1/archive", headers=headers)
        self.assertEqual(archive_response.status_code, 404, archive_response.text)
        self.assertEqual(archive_response.json()["detail"], "Repair not found")

        restore_response = self.client.post("/api/repairs/1/restore", headers=headers)
        self.assertEqual(restore_response.status_code, 404, restore_response.text)
        self.assertEqual(restore_response.json()["detail"], "Repair not found")

        delete_response = self.client.delete("/api/repairs/1", headers=headers)
        self.assertEqual(delete_response.status_code, 404, delete_response.text)
        self.assertEqual(delete_response.json()["detail"], "Repair not found")

    def test_repair_restore_rejects_archived_service(self) -> None:
        headers = self._auth_headers("admin")

        archive_response = self.client.post("/api/repairs/1/archive", headers=headers)
        self.assertEqual(archive_response.status_code, 200, archive_response.text)

        with self.SessionLocal() as db:
            service = db.get(Service, 1)
            self.assertIsNotNone(service)
            assert service is not None
            service.status = ServiceStatus.ARCHIVED
            db.commit()

        restore_response = self.client.post("/api/repairs/1/restore", headers=headers)
        self.assertEqual(restore_response.status_code, 409, restore_response.text)
        self.assertEqual(restore_response.json()["detail"], "Cannot restore a repair for an archived service")

    def test_document_archive_and_restore_use_explicit_endpoints(self) -> None:
        headers = self._auth_headers("admin")

        patch_response = self.client.patch(
            "/api/documents/1",
            headers=headers,
            json={"status": "archived"},
        )
        self.assertEqual(patch_response.status_code, 409, patch_response.text)

        archive_response = self.client.post("/api/documents/1/archive", headers=headers)
        self.assertEqual(archive_response.status_code, 200, archive_response.text)
        archived_payload = archive_response.json()
        self.assertEqual(archived_payload["status"], DocumentStatus.ARCHIVED.value)

        restore_response = self.client.post("/api/documents/1/restore", headers=headers)
        self.assertEqual(restore_response.status_code, 200, restore_response.text)
        restored_payload = restore_response.json()
        self.assertEqual(restored_payload["status"], DocumentStatus.NEEDS_REVIEW.value)

        with self.SessionLocal() as db:
            repair = db.get(Repair, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            self.assertEqual(repair.source_document_id, document.id)
            self.assertTrue(document.is_primary)

    def test_document_restore_rejects_archived_vehicle(self) -> None:
        headers = self._auth_headers("admin")

        archive_response = self.client.post("/api/documents/1/archive", headers=headers)
        self.assertEqual(archive_response.status_code, 200, archive_response.text)

        with self.SessionLocal() as db:
            vehicle = db.get(Vehicle, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(vehicle)
            self.assertIsNotNone(document)
            assert vehicle is not None
            assert document is not None
            vehicle.status = VehicleStatus.ARCHIVED
            document.status = DocumentStatus.ARCHIVED
            document.review_queue_priority = 0
            db.commit()

        restore_response = self.client.post("/api/documents/1/restore", headers=headers)
        self.assertEqual(restore_response.status_code, 409, restore_response.text)
        self.assertEqual(restore_response.json()["detail"], "Cannot restore a document while its vehicle is archived")

        with self.SessionLocal() as db:
            document = db.get(Document, 1)
            self.assertIsNotNone(document)
            assert document is not None
            self.assertEqual(document.status, DocumentStatus.ARCHIVED)

    def test_document_restore_rejects_archived_service(self) -> None:
        headers = self._auth_headers("admin")

        archive_response = self.client.post("/api/documents/1/archive", headers=headers)
        self.assertEqual(archive_response.status_code, 200, archive_response.text)

        with self.SessionLocal() as db:
            service = db.get(Service, 1)
            document = db.get(Document, 1)
            self.assertIsNotNone(service)
            self.assertIsNotNone(document)
            assert service is not None
            assert document is not None
            service.status = ServiceStatus.ARCHIVED
            document.status = DocumentStatus.ARCHIVED
            document.review_queue_priority = 0
            db.commit()

        restore_response = self.client.post("/api/documents/1/restore", headers=headers)
        self.assertEqual(restore_response.status_code, 409, restore_response.text)
        self.assertEqual(restore_response.json()["detail"], "Cannot restore a document while its service is archived")

    def test_first_attachment_uploaded_to_repair_does_not_become_primary_or_source(self) -> None:
        with self.SessionLocal() as db:
            repair = Repair(
                order_number="ZN-ATT-001",
                repair_date=date(2025, 1, 20),
                vehicle_id=1,
                service_id=1,
                created_by_user_id=1,
                mileage=50000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.commit()
            repair_id = repair.id

        headers = self._auth_headers("admin")
        response = self.client.post(
            "/api/documents/upload-to-repair",
            headers=headers,
            data={"repair_id": str(repair_id), "kind": "attachment"},
            files={"file": ("attachment.pdf", b"%PDF-1.4\n%test\n", "application/pdf")},
        )
        self.assertEqual(response.status_code, 200, response.text)

        repair_response = self.client.get(f"/api/repairs/{repair_id}", headers=headers)
        self.assertEqual(repair_response.status_code, 200, repair_response.text)
        self.assertIsNone(repair_response.json()["source_document_id"])

        with self.SessionLocal() as db:
            repair = db.get(Repair, repair_id)
            documents = db.query(Document).filter(Document.repair_id == repair_id).all()
            self.assertIsNotNone(repair)
            assert repair is not None
            self.assertEqual(repair.source_document_id, None)
            self.assertEqual(len(documents), 1)
            self.assertFalse(documents[0].is_primary)


class Wave1AuthRegressionTestCase(unittest.TestCase):
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
            db.add_all(
                [
                    User(
                        full_name="Admin User",
                        login="admin",
                        email="admin@example.com",
                        password_hash=get_password_hash("secret123"),
                        role=UserRole.ADMIN,
                        is_active=True,
                    ),
                    User(
                        full_name="Employee User",
                        login="employee",
                        email="employee@example.com",
                        password_hash=get_password_hash("secret123"),
                        role=UserRole.EMPLOYEE,
                        is_active=True,
                    ),
                ]
            )
            db.commit()

    def _auth_headers(self, username: str, password: str = "secret123") -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_old_access_token_is_rejected_after_password_change(self) -> None:
        original_headers = self._auth_headers("employee")

        change_response = self.client.post(
            "/api/auth/change-password",
            headers=original_headers,
            json={"current_password": "secret123", "new_password": "updatedpass123"},
        )
        self.assertEqual(change_response.status_code, 200, change_response.text)

        stale_token_response = self.client.get("/api/auth/me", headers=original_headers)
        self.assertEqual(stale_token_response.status_code, 401, stale_token_response.text)

        fresh_login_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "updatedpass123"},
        )
        self.assertEqual(fresh_login_response.status_code, 200, fresh_login_response.text)

    def test_old_access_token_is_rejected_after_admin_password_reset(self) -> None:
        original_headers = self._auth_headers("employee")
        admin_headers = self._auth_headers("admin")

        reset_response = self.client.post(
            "/api/users/2/reset-password",
            headers=admin_headers,
            json={"new_password": "adminreset123"},
        )
        self.assertEqual(reset_response.status_code, 200, reset_response.text)

        stale_token_response = self.client.get("/api/auth/me", headers=original_headers)
        self.assertEqual(stale_token_response.status_code, 401, stale_token_response.text)

        fresh_login_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "adminreset123"},
        )
        self.assertEqual(fresh_login_response.status_code, 200, fresh_login_response.text)

    def test_old_access_token_is_rejected_after_password_recovery(self) -> None:
        original_headers = self._auth_headers("employee")

        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-wave1"),
            patch("app.api.auth.send_password_reset_email", return_value=(False, "SMTP not configured")),
        ):
            request_response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
            )
        self.assertEqual(request_response.status_code, 200, request_response.text)

        confirm_response = self.client.post(
            "/api/auth/password-reset/confirm",
            json={"token": "fixed-reset-token-wave1", "new_password": "recoveredpass123"},
        )
        self.assertEqual(confirm_response.status_code, 200, confirm_response.text)

        stale_token_response = self.client.get("/api/auth/me", headers=original_headers)
        self.assertEqual(stale_token_response.status_code, 401, stale_token_response.text)

        fresh_login_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "recoveredpass123"},
        )
        self.assertEqual(fresh_login_response.status_code, 200, fresh_login_response.text)


if __name__ == "__main__":
    unittest.main()
