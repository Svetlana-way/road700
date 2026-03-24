from __future__ import annotations

import unittest
import warnings
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SAWarning
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.enums import UserRole
from app.models.user import User


class AuthFlowsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
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

    def _login_headers(self, username: str, password: str = "secret123") -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_change_password_invalidates_existing_password_reset_token(self) -> None:
        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-change"),
            patch("app.api.auth.send_password_reset_email", return_value=(False, "SMTP not configured")),
        ):
            request_response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
            )
        self.assertEqual(request_response.status_code, 200, request_response.text)

        headers = self._login_headers("employee")
        change_response = self.client.post(
            "/api/auth/change-password",
            headers=headers,
            json={"current_password": "secret123", "new_password": "updatedpass123"},
        )
        self.assertEqual(change_response.status_code, 200, change_response.text)

        confirm_response = self.client.post(
            "/api/auth/password-reset/confirm",
            json={"token": "fixed-reset-token-change", "new_password": "anotherpass123"},
        )
        self.assertEqual(confirm_response.status_code, 400, confirm_response.text)

        relogin_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "updatedpass123"},
        )
        self.assertEqual(relogin_response.status_code, 200, relogin_response.text)

    def test_admin_reset_password_invalidates_existing_password_reset_token(self) -> None:
        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-admin"),
            patch("app.api.auth.send_password_reset_email", return_value=(False, "SMTP not configured")),
        ):
            request_response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
            )
        self.assertEqual(request_response.status_code, 200, request_response.text)

        admin_headers = self._login_headers("admin")
        reset_response = self.client.post(
            "/api/users/2/reset-password",
            headers=admin_headers,
            json={"new_password": "adminreset123"},
        )
        self.assertEqual(reset_response.status_code, 200, reset_response.text)

        confirm_response = self.client.post(
            "/api/auth/password-reset/confirm",
            json={"token": "fixed-reset-token-admin", "new_password": "anotherpass123"},
        )
        self.assertEqual(confirm_response.status_code, 400, confirm_response.text)

        relogin_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "adminreset123"},
        )
        self.assertEqual(relogin_response.status_code, 200, relogin_response.text)


if __name__ == "__main__":
    unittest.main()
