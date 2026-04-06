from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.audit import AuditLog
from app.models.enums import CatalogStatus, UserRole
from app.models.labor_norm import LaborNorm
from app.models.labor_norm_catalog import LaborNormCatalog
from app.models.user import User
from app.scripts.import_labor_norms import ImportStats
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class LaborNormsApiTestCase(unittest.TestCase):
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
            archived_catalog = LaborNormCatalog(
                scope="archived_catalog",
                catalog_name="Archived Catalog",
                brand_family="dongfeng",
                priority=100,
                auto_match_enabled=False,
                status=CatalogStatus.ARCHIVED,
            )
            active_catalog = LaborNormCatalog(
                scope="active_catalog",
                catalog_name="Active Catalog",
                brand_family="dongfeng",
                priority=50,
                auto_match_enabled=True,
                status=CatalogStatus.CONFIRMED,
            )
            db.add_all([archived_catalog, active_catalog])
            db.flush()
            db.add(
                LaborNorm(
                    scope=archived_catalog.scope,
                    brand_family=archived_catalog.brand_family,
                    catalog_name=archived_catalog.catalog_name,
                    code="A-001",
                    category="Общее",
                    name_ru="Архивная операция",
                    name_ru_alt=None,
                    name_cn=None,
                    name_en=None,
                    normalized_name="архивная операция",
                    search_text="A-001 | Архивная операция",
                    standard_hours=1.5,
                    source_sheet="Sheet1",
                    source_file="archived.xlsx",
                    status=CatalogStatus.CONFIRMED,
                )
            )
            db.commit()

    def _get_auth_headers(self, username: str = "admin") -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": username, "password": "secret123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_create_labor_norm_rejects_archived_catalog(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.post(
            "/api/labor-norms",
            headers=headers,
            json={
                "scope": "archived_catalog",
                "code": "A-002",
                "category": "Общее",
                "name_ru": "Новая архивная операция",
                "standard_hours": 2.0,
                "status": "confirmed",
            },
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Архивный каталог `archived_catalog` доступен только для чтения")

    def test_update_labor_norm_rejects_archived_catalog_record(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.patch(
            "/api/labor-norms/1",
            headers=headers,
            json={"name_ru": "Попытка изменить архивную запись"},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Архивный каталог `archived_catalog` доступен только для чтения")

    def test_import_labor_norms_rejects_archived_catalog_before_import(self) -> None:
        headers = self._get_auth_headers()

        with patch("app.api.labor_norms.import_labor_norms_with_session") as import_mock:
            response = self.client.post(
                "/api/labor-norms/import",
                headers=headers,
                files={
                    "file": (
                        "catalog.xlsx",
                        b"PK\x03\x04fake-xlsx-content",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
                data={"scope": "archived_catalog"},
            )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Архивный каталог `archived_catalog` доступен только для чтения")
        import_mock.assert_not_called()

    def test_import_labor_norms_rejects_unsupported_extension_before_service_call(self) -> None:
        headers = self._get_auth_headers()

        with patch("app.api.labor_norms.import_labor_norms_with_session") as import_mock:
            response = self.client.post(
                "/api/labor-norms/import",
                headers=headers,
                files={"file": ("catalog.pdf", b"%PDF-fake", "application/pdf")},
                data={"scope": "active_catalog"},
            )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Поддерживается импорт каталога нормо-часов в форматах .xlsx и .csv")
        import_mock.assert_not_called()

    def test_import_labor_norms_rejects_invalid_xlsx_signature_before_service_call(self) -> None:
        headers = self._get_auth_headers()

        with patch("app.api.labor_norms.import_labor_norms_with_session") as import_mock:
            response = self.client.post(
                "/api/labor-norms/import",
                headers=headers,
                files={
                    "file": (
                        "catalog.xlsx",
                        b"not-a-zip-file",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
                data={"scope": "active_catalog"},
            )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Файл каталога нормо-часов не похож на корректный .xlsx документ")
        import_mock.assert_not_called()

    def test_list_labor_norms_excludes_archived_items_and_archived_catalogs_by_default(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            db.add_all(
                [
                    LaborNorm(
                        scope="active_catalog",
                        brand_family="dongfeng",
                        catalog_name="Active Catalog",
                        code="A-100",
                        category="Активное",
                        name_ru="Рабочая операция",
                        name_ru_alt=None,
                        name_cn=None,
                        name_en=None,
                        normalized_name="рабочая операция",
                        search_text="A-100 | Рабочая операция",
                        standard_hours=2.5,
                        source_sheet="Sheet1",
                        source_file="active.xlsx",
                        status=CatalogStatus.CONFIRMED,
                    ),
                    LaborNorm(
                        scope="active_catalog",
                        brand_family="dongfeng",
                        catalog_name="Active Catalog",
                        code="A-101",
                        category="Архив",
                        name_ru="Архивная запись активного каталога",
                        name_ru_alt=None,
                        name_cn=None,
                        name_en=None,
                        normalized_name="архивная запись активного каталога",
                        search_text="A-101 | Архивная запись активного каталога",
                        standard_hours=1.0,
                        source_sheet="Sheet1",
                        source_file="active-archived.xlsx",
                        status=CatalogStatus.ARCHIVED,
                    ),
                ]
            )
            db.commit()

        response = self.client.get("/api/labor-norms?limit=50", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual([item["code"] for item in payload["items"]], ["A-100"])
        self.assertEqual(payload["scopes"], ["active_catalog"])
        self.assertEqual(payload["categories"], ["Активное"])
        self.assertEqual(payload["source_files"], ["active.xlsx"])

    def test_create_catalog_writes_audit_log(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.post(
            "/api/labor-norms/catalogs",
            headers=headers,
            json={
                "scope": "new_catalog",
                "catalog_name": "New Catalog",
                "brand_family": "man",
                "priority": 200,
                "auto_match_enabled": True,
                "status": "confirmed",
                "notes": "Created from test",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_catalog",
                    AuditLog.entity_id == str(payload["id"]),
                    AuditLog.action_type == "labor_norm_catalog_created",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.user_id, 1)
            self.assertEqual(audit_entry.new_value["scope"], "new_catalog")
            self.assertEqual(audit_entry.new_value["catalog_name"], "New Catalog")
            self.assertEqual(audit_entry.new_value["status"], "confirmed")

    def test_catalog_endpoints_tolerate_non_list_keyword_payloads(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            catalog = db.get(LaborNormCatalog, 2)
            self.assertIsNotNone(catalog)
            assert catalog is not None
            catalog.brand_keywords = "legacy-brand-keywords"
            catalog.model_keywords = {"legacy": "model-keywords"}
            catalog.vin_prefixes = "legacy-vin-prefixes"
            db.commit()

        list_response = self.client.get("/api/labor-norms/catalogs", headers=headers)

        self.assertEqual(list_response.status_code, 200, list_response.text)
        list_payload = list_response.json()
        catalog_payload = next(item for item in list_payload["items"] if item["id"] == 2)
        self.assertEqual(catalog_payload["brand_keywords"], [])
        self.assertEqual(catalog_payload["model_keywords"], [])
        self.assertEqual(catalog_payload["vin_prefixes"], [])

        patch_response = self.client.patch(
            "/api/labor-norms/catalogs/2",
            headers=headers,
            json={"notes": "updated despite legacy metadata"},
        )

        self.assertEqual(patch_response.status_code, 200, patch_response.text)
        patched_payload = patch_response.json()
        self.assertEqual(patched_payload["brand_keywords"], [])
        self.assertEqual(patched_payload["model_keywords"], [])
        self.assertEqual(patched_payload["vin_prefixes"], [])

    def test_update_catalog_writes_audit_log_with_old_and_new_values(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.patch(
            "/api/labor-norms/catalogs/2",
            headers=headers,
            json={
                "catalog_name": "Active Catalog Updated",
                "priority": 75,
                "auto_match_enabled": False,
                "notes": "Updated from test",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_catalog",
                    AuditLog.entity_id == "2",
                    AuditLog.action_type == "labor_norm_catalog_updated",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.old_value["catalog_name"], "Active Catalog")
            self.assertEqual(audit_entry.old_value["priority"], 50)
            self.assertEqual(audit_entry.old_value["auto_match_enabled"], True)
            self.assertEqual(audit_entry.new_value["catalog_name"], "Active Catalog Updated")
            self.assertEqual(audit_entry.new_value["priority"], 75)
            self.assertEqual(audit_entry.new_value["auto_match_enabled"], False)
            self.assertEqual(audit_entry.new_value["notes"], "Updated from test")

    def test_archive_catalog_writes_archived_audit_log(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.patch(
            "/api/labor-norms/catalogs/2",
            headers=headers,
            json={"status": "archived"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "archived")

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_catalog",
                    AuditLog.entity_id == "2",
                    AuditLog.action_type == "labor_norm_catalog_archived",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.old_value["status"], "confirmed")
            self.assertEqual(audit_entry.new_value["status"], "archived")

    def test_create_labor_norm_writes_audit_log(self) -> None:
        headers = self._get_auth_headers()

        response = self.client.post(
            "/api/labor-norms",
            headers=headers,
            json={
                "scope": "active_catalog",
                "code": "A-003",
                "category": "Общее",
                "name_ru": "Новая рабочая операция",
                "standard_hours": 3.0,
                "status": "confirmed",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_item",
                    AuditLog.entity_id == str(payload["id"]),
                    AuditLog.action_type == "labor_norm_item_created",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.user_id, 1)
            self.assertEqual(audit_entry.new_value["scope"], "active_catalog")
            self.assertEqual(audit_entry.new_value["code"], "A-003")
            self.assertEqual(audit_entry.new_value["name_ru"], "Новая рабочая операция")
            self.assertEqual(audit_entry.new_value["status"], "confirmed")

    def test_update_labor_norm_writes_audit_log_with_old_and_new_values(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            item = LaborNorm(
                scope="active_catalog",
                brand_family="dongfeng",
                catalog_name="Active Catalog",
                code="A-004",
                category="Общее",
                name_ru="Исходная операция",
                name_ru_alt=None,
                name_cn=None,
                name_en=None,
                normalized_name="исходная операция",
                search_text="A-004 | Исходная операция",
                standard_hours=1.5,
                source_sheet="Sheet1",
                source_file="active.xlsx",
                status=CatalogStatus.CONFIRMED,
            )
            db.add(item)
            db.commit()
            item_id = item.id

        response = self.client.patch(
            f"/api/labor-norms/{item_id}",
            headers=headers,
            json={
                "name_ru": "Обновлённая операция",
                "standard_hours": 2.25,
                "source_file": "updated.xlsx",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_item",
                    AuditLog.entity_id == str(item_id),
                    AuditLog.action_type == "labor_norm_item_updated",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.old_value["name_ru"], "Исходная операция")
            self.assertEqual(audit_entry.old_value["standard_hours"], 1.5)
            self.assertEqual(audit_entry.new_value["name_ru"], "Обновлённая операция")
            self.assertEqual(audit_entry.new_value["standard_hours"], 2.25)
            self.assertEqual(audit_entry.new_value["source_file"], "updated.xlsx")

    def test_archive_labor_norm_item_writes_audit_log(self) -> None:
        headers = self._get_auth_headers()

        with self.SessionLocal() as db:
            item = LaborNorm(
                scope="active_catalog",
                brand_family="dongfeng",
                catalog_name="Active Catalog",
                code="A-002",
                category="Общее",
                name_ru="Активная операция",
                name_ru_alt=None,
                name_cn=None,
                name_en=None,
                normalized_name="активная операция",
                search_text="A-002 | Активная операция",
                standard_hours=2.0,
                source_sheet="Sheet1",
                source_file="active.xlsx",
                status=CatalogStatus.CONFIRMED,
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            item_id = item.id

        response = self.client.patch(
            f"/api/labor-norms/{item_id}",
            headers=headers,
            json={"status": "archived"},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["status"], "archived")

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_item",
                    AuditLog.entity_id == str(item_id),
                    AuditLog.action_type == "labor_norm_item_archived",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.old_value["status"], "confirmed")
            self.assertEqual(audit_entry.new_value["status"], "archived")

    def test_import_labor_norms_writes_success_audit_log(self) -> None:
        headers = self._get_auth_headers()

        with patch(
            "app.api.labor_norms.import_labor_norms_with_session",
            return_value=ImportStats(created=2, updated=1, skipped=3),
        ):
            response = self.client.post(
                "/api/labor-norms/import",
                headers=headers,
                files={
                    "file": (
                        "catalog.xlsx",
                        b"PK\x03\x04fake-xlsx-content",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
                data={"scope": "active_catalog"},
            )

        self.assertEqual(response.status_code, 200, response.text)

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_import",
                    AuditLog.entity_id == "active_catalog",
                    AuditLog.action_type == "labor_norm_import_succeeded",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.user_id, 1)
            self.assertEqual(audit_entry.new_value["scope"], "active_catalog")
            self.assertEqual(audit_entry.new_value["created"], 2)
            self.assertEqual(audit_entry.new_value["updated"], 1)
            self.assertEqual(audit_entry.new_value["skipped"], 3)

    def test_import_labor_norms_writes_failure_audit_log(self) -> None:
        headers = self._get_auth_headers()

        with patch(
            "app.api.labor_norms.import_labor_norms_with_session",
            side_effect=RuntimeError("import failed in test"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    "/api/labor-norms/import",
                    headers=headers,
                    files={
                        "file": (
                            "catalog.xlsx",
                            b"PK\x03\x04fake-xlsx-content",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        )
                    },
                    data={"scope": "active_catalog"},
                )

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_import",
                    AuditLog.entity_id == "active_catalog",
                    AuditLog.action_type == "labor_norm_import_failed",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertEqual(audit_entry.user_id, 1)
            self.assertEqual(audit_entry.new_value["scope"], "active_catalog")
            self.assertIn("import failed in test", audit_entry.new_value["error"])

    def test_import_labor_norms_removes_stored_file_when_import_fails(self) -> None:
        headers = self._get_auth_headers()

        with tempfile.TemporaryDirectory() as temp_dir:
            storage_root = Path(temp_dir)
            with (
                patch("app.api.labor_norms.get_storage_root", return_value=storage_root),
                patch(
                    "app.api.labor_norms.import_labor_norms_with_session",
                    side_effect=RuntimeError("import failed in test"),
                ),
            ):
                with self.assertRaises(RuntimeError):
                    self.client.post(
                        "/api/labor-norms/import",
                        headers=headers,
                        files={
                            "file": (
                                "catalog.xlsx",
                                b"PK\x03\x04fake-xlsx-content",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            )
                        },
                        data={"scope": "active_catalog"},
                    )

            stored_files = [path for path in storage_root.rglob("*") if path.is_file()]
            self.assertEqual(stored_files, [])

    def test_import_labor_norms_returns_bad_request_for_parse_error(self) -> None:
        headers = self._get_auth_headers()

        with patch(
            "app.api.labor_norms.import_labor_norms_with_session",
            side_effect=ValueError("Unable to read labor norms workbook: catalog.xlsx"),
        ):
            response = self.client.post(
                "/api/labor-norms/import",
                headers=headers,
                files={
                    "file": (
                        "catalog.xlsx",
                        b"PK\x03\x04fake-xlsx-content",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
                data={"scope": "active_catalog"},
            )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Unable to read labor norms workbook: catalog.xlsx")

        with self.SessionLocal() as db:
            audit_entry = db.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "labor_norm_import",
                    AuditLog.entity_id == "active_catalog",
                    AuditLog.action_type == "labor_norm_import_failed",
                )
                .order_by(AuditLog.id.desc())
            )
            self.assertIsNotNone(audit_entry)
            assert audit_entry is not None
            self.assertIn("Unable to read labor norms workbook", audit_entry.new_value["error"])
