from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.enums import CatalogStatus, UserRole
from app.models.labor_norm import LaborNorm
from app.models.labor_norm_catalog import LaborNormCatalog
from app.models.user import User
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

    def _get_auth_headers(self) -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "secret123"},
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

