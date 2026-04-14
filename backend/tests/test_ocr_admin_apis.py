from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api import ocr_rules as ocr_rules_api
from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.ocr_learning_signal import OcrLearningSignal
from app.models.ocr_profile_matcher import OcrProfileMatcher
from app.models.ocr_rule import OcrRule
from app.models.repair import Repair
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class OcrAdminApisTestCase(unittest.TestCase):
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
            admin = User(
                full_name="Admin User",
                login="admin",
                email="admin@example.com",
                password_hash=get_password_hash("secret123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.flush()

            vehicle = Vehicle(
                external_id="ocr-admin-truck",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A001AA116",
                brand="Dong Feng",
                model="KL",
                status=VehicleStatus.ACTIVE,
            )
            service = Service(
                name="OCR Admin Service",
                city="Kazan",
                status=ServiceStatus.CONFIRMED,
                created_by_user_id=admin.id,
                confirmed_by_user_id=admin.id,
            )
            db.add_all([vehicle, service])
            db.flush()

            repair = Repair(
                order_number="OCR-001",
                repair_date=date(2025, 1, 15),
                vehicle_id=vehicle.id,
                service_id=service.id,
                created_by_user_id=admin.id,
                mileage=120000,
                grand_total=15000,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="ocr-admin.pdf",
                storage_key="ocr-admin.pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
            )
            db.add(document)
            db.flush()

            db.add_all(
                [
                    OcrLearningSignal(
                        repair_id=repair.id,
                        document_id=document.id,
                        created_by_user_id=admin.id,
                        signal_type="missing",
                        target_field="order_number",
                        ocr_profile_scope="axb",
                        corrected_value="ZN-AXB-001",
                        service_name="AXB Service",
                        document_filename="axb-order.pdf",
                        status="new",
                    ),
                    OcrLearningSignal(
                        repair_id=repair.id,
                        document_id=document.id,
                        created_by_user_id=admin.id,
                        signal_type="mismatch",
                        target_field="mileage",
                        ocr_profile_scope="ets",
                        extracted_value="111",
                        corrected_value="222",
                        service_name="ETS Service",
                        document_filename="ets-mileage.pdf",
                        status="reviewed",
                    ),
                    OcrLearningSignal(
                        repair_id=repair.id,
                        document_id=document.id,
                        created_by_user_id=admin.id,
                        signal_type="missing",
                        target_field="vin",
                        ocr_profile_scope="default",
                        corrected_value="VIN-REJECTED-001",
                        service_name="Rejected Service",
                        document_filename="rejected-vin.pdf",
                        status="rejected",
                    ),
                ]
            )
            db.add_all(
                [
                    OcrRule(
                        profile_scope="axb",
                        target_field="order_number",
                        pattern="AXB-(\\d+)",
                        value_parser="raw",
                        confidence=0.7,
                        priority=10,
                        is_active=True,
                    ),
                    OcrRule(
                        profile_scope="ets",
                        target_field="mileage",
                        pattern="ETS-(\\d+)",
                        value_parser="digits_int",
                        confidence=0.8,
                        priority=20,
                        is_active=True,
                    ),
                ]
            )
            db.add_all(
                [
                    OcrProfileMatcher(
                        profile_scope="axb",
                        title="AXB matcher",
                        source_type="pdf",
                        filename_pattern="axb",
                        priority=10,
                        is_active=True,
                    ),
                    OcrProfileMatcher(
                        profile_scope="ets",
                        title="ETS matcher",
                        source_type="pdf",
                        filename_pattern="ets",
                        priority=20,
                        is_active=True,
                    ),
                ]
            )
            db.commit()

    def _get_auth_headers(self, username: str = "admin") -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": username, "password": "secret123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_ocr_learning_facets_follow_profile_scope_filter(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.get("/api/ocr-learning/signals?profile_scope=axb", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["target_field"] for item in payload["items"]], ["order_number"])
        self.assertEqual(payload["statuses"], ["new"])
        self.assertEqual(payload["target_fields"], ["order_number"])
        self.assertEqual(payload["profile_scopes"], ["axb"])

    def test_ocr_learning_default_statuses_exclude_rejected_signals(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.get("/api/ocr-learning/signals", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["total"], 2)
        self.assertEqual({item["status"] for item in payload["items"]}, {"new", "reviewed"})
        self.assertEqual(payload["statuses"], ["new", "reviewed"])

    def test_ocr_rules_facets_follow_profile_scope_filter(self) -> None:
        headers = self._get_auth_headers()

        with patch.object(ocr_rules_api, "ensure_default_ocr_rules", autospec=True) as sync_mock:
            sync_mock.return_value = ()
            response = self.client.get("/api/ocr-rules?profile_scope=axb", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual([item["profile_scope"] for item in payload["items"]], ["axb"])
        self.assertEqual(payload["target_fields"], ["order_number"])
        self.assertEqual(payload["profile_scopes"], ["axb"])

    def test_ocr_profile_matchers_facets_follow_profile_scope_filter(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.get("/api/ocr-profile-matchers?profile_scope=axb", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual([item["profile_scope"] for item in payload["items"]], ["axb"])
        self.assertEqual(payload["profile_scopes"], ["axb"])


if __name__ == "__main__":
    unittest.main()
