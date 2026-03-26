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
from app.services.service_catalog import (
    ServiceCatalogEntry,
    ensure_service_catalog_synced,
    find_service_catalog_entry,
    resolve_service_by_name,
)


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


if __name__ == "__main__":
    unittest.main()
