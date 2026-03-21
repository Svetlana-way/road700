from __future__ import annotations

import tempfile
import unittest
import warnings
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import SAWarning
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import services as services_api
from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory
from app.services.service_catalog import ServiceCatalogEntry, ensure_service_catalog_synced


class ReviewAndServicesApiTestCase(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
