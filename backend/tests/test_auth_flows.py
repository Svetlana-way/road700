from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.rate_limit import rate_limiter
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class AuthFlowsTestCase(unittest.TestCase):
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
        rate_limiter.reset()

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

    def test_login_rate_limit_blocks_repeated_failed_attempts(self) -> None:
        for _ in range(5):
            response = self.client.post(
                "/api/auth/login",
                data={"username": "employee", "password": "wrong-pass"},
            )
            self.assertEqual(response.status_code, 401, response.text)

        limited_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "wrong-pass"},
        )
        self.assertEqual(limited_response.status_code, 429, limited_response.text)
        self.assertEqual(limited_response.json()["detail"], "Too many login attempts. Please try again later.")
        self.assertIn("Retry-After", limited_response.headers)

    def test_successful_login_clears_login_specific_rate_limit_bucket(self) -> None:
        for _ in range(4):
            response = self.client.post(
                "/api/auth/login",
                data={"username": "employee", "password": "wrong-pass"},
            )
            self.assertEqual(response.status_code, 401, response.text)

        success_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "secret123"},
        )
        self.assertEqual(success_response.status_code, 200, success_response.text)

        next_failure = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "wrong-pass"},
        )
        self.assertEqual(next_failure.status_code, 401, next_failure.text)

    def test_password_reset_request_rate_limit_blocks_repeated_requests(self) -> None:
        with patch("app.api.auth.send_password_reset_email", return_value=(False, "SMTP not configured")):
            for _ in range(3):
                response = self.client.post(
                    "/api/auth/password-reset/request",
                    json={"email": "employee@example.com"},
                )
                self.assertEqual(response.status_code, 200, response.text)

            limited_response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
            )

        self.assertEqual(limited_response.status_code, 429, limited_response.text)
        self.assertEqual(limited_response.json()["detail"], "Too many password reset requests. Please try again later.")
        self.assertIn("Retry-After", limited_response.headers)

    def test_password_reset_link_uses_forwarded_public_origin(self) -> None:
        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-origin"),
            patch("app.api.auth.send_password_reset_email", return_value=(True, None)) as send_email_mock,
        ):
            response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
                headers={
                    "x-forwarded-proto": "https",
                    "x-forwarded-host": "road700.example.com",
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        send_email_mock.assert_called_once_with(
            recipient_email="employee@example.com",
            reset_link="https://road700.example.com/?reset_token=fixed-reset-token-origin",
        )


if __name__ == "__main__":
    unittest.main()
