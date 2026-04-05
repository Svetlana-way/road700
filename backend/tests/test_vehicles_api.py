from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class VehiclesApiTestCase(unittest.TestCase):
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

    def test_import_vehicle_registry_maps_parse_errors_to_bad_request(self) -> None:
        headers = self._get_auth_headers()

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_root = Path(temp_dir)
            trucks_path = temp_root / "trucks.xls"
            trailers_path = temp_root / "trailers.xls"
            trucks_path.write_bytes(b"stub")
            trailers_path.write_bytes(b"stub")

            with patch(
                "app.api.vehicles.import_vehicles_with_session",
                side_effect=ValueError("Unable to read vehicle registry workbook: trucks.xls"),
            ):
                response = self.client.post(
                    "/api/vehicles/import",
                    headers=headers,
                    json={
                        "trucks_path": str(trucks_path),
                        "trailers_path": str(trailers_path),
                    },
                )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(response.json()["detail"], "Unable to read vehicle registry workbook: trucks.xls")
