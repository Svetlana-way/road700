from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api import auth as auth_api
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

    def test_change_password_invalidates_existing_access_token(self) -> None:
        headers = self._login_headers("employee")

        change_response = self.client.post(
            "/api/auth/change-password",
            headers=headers,
            json={"current_password": "secret123", "new_password": "updatedpass123"},
        )
        self.assertEqual(change_response.status_code, 200, change_response.text)

        stale_session_response = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(stale_session_response.status_code, 401, stale_session_response.text)
        self.assertEqual(stale_session_response.json()["detail"], "Could not validate credentials")

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

    def test_admin_reset_password_invalidates_existing_access_token(self) -> None:
        employee_headers = self._login_headers("employee")
        admin_headers = self._login_headers("admin")

        reset_response = self.client.post(
            "/api/users/2/reset-password",
            headers=admin_headers,
            json={"new_password": "adminreset123"},
        )
        self.assertEqual(reset_response.status_code, 200, reset_response.text)

        stale_session_response = self.client.get("/api/auth/me", headers=employee_headers)
        self.assertEqual(stale_session_response.status_code, 401, stale_session_response.text)
        self.assertEqual(stale_session_response.json()["detail"], "Could not validate credentials")

        relogin_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "adminreset123"},
        )
        self.assertEqual(relogin_response.status_code, 200, relogin_response.text)

    def test_password_recovery_confirm_invalidates_existing_access_token(self) -> None:
        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-recovery"),
            patch("app.api.auth.send_password_reset_email", return_value=(False, "SMTP not configured")),
        ):
            request_response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
            )
        self.assertEqual(request_response.status_code, 200, request_response.text)

        headers = self._login_headers("employee")
        confirm_response = self.client.post(
            "/api/auth/password-reset/confirm",
            json={"token": "fixed-reset-token-recovery", "new_password": "recoveredpass123"},
        )
        self.assertEqual(confirm_response.status_code, 200, confirm_response.text)

        stale_session_response = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(stale_session_response.status_code, 401, stale_session_response.text)
        self.assertEqual(stale_session_response.json()["detail"], "Could not validate credentials")

        relogin_response = self.client.post(
            "/api/auth/login",
            data={"username": "employee", "password": "recoveredpass123"},
        )
        self.assertEqual(relogin_response.status_code, 200, relogin_response.text)

    def test_employee_cannot_read_admin_configuration_endpoints(self) -> None:
        headers = self._login_headers("employee")

        for path in (
            "/api/audit",
            "/api/backups",
            "/api/backups/test-backup/download",
            "/api/imports/conflicts",
            "/api/imports/conflicts/1",
            "/api/imports/historical-work-reference",
            "/api/imports/jobs",
            "/api/ocr-learning/signals",
            "/api/ocr-learning/signals/1/drafts",
            "/api/review/rules",
            "/api/ocr-rules",
            "/api/ocr-profile-matchers",
            "/api/labor-norms",
            "/api/labor-norms/catalogs",
            "/api/system/status",
            "/api/users?include_inactive=true",
        ):
            response = self.client.get(path, headers=headers)
            self.assertEqual(response.status_code, 403, response.text)
            self.assertEqual(response.json()["detail"], "Admin access required")

    def test_employee_cannot_mutate_admin_configuration_endpoints(self) -> None:
        headers = self._login_headers("employee")

        requests = (
            ("POST", "/api/backups", None),
            ("POST", "/api/backups/test-backup/restore", {"confirm_backup_id": "test-backup"}),
            ("PATCH", "/api/imports/conflicts/1", {"status": "resolved", "comment": "skip"}),
            (
                "POST",
                "/api/review/rules",
                {"rule_type": "manual_review_reason", "code": "employee-blocked", "title": "Employee blocked"},
            ),
            ("PATCH", "/api/review/rules/1", {"title": "Updated title"}),
            (
                "POST",
                "/api/ocr-rules",
                {"profile_scope": "default", "target_field": "order_number", "pattern": "(test)"},
            ),
            ("PATCH", "/api/ocr-rules/1", {"notes": "updated"}),
            (
                "POST",
                "/api/ocr-profile-matchers",
                {"profile_scope": "default", "title": "Matcher", "filename_pattern": "test"},
            ),
            ("PATCH", "/api/ocr-profile-matchers/1", {"title": "Updated matcher"}),
            ("PATCH", "/api/ocr-learning/signals/1", {"status": "reviewed"}),
            (
                "POST",
                "/api/labor-norms/catalogs",
                {"scope": "blocked_scope", "catalog_name": "Blocked Catalog"},
            ),
            ("PATCH", "/api/labor-norms/catalogs/1", {"notes": "updated"}),
            (
                "POST",
                "/api/labor-norms",
                {"scope": "blocked_scope", "code": "A-001", "name_ru": "Blocked item", "standard_hours": 1.5},
            ),
            ("PATCH", "/api/labor-norms/1", {"name_ru": "Updated item"}),
            (
                "POST",
                "/api/users",
                {
                    "full_name": "Blocked User",
                    "login": "blocked.user",
                    "email": "blocked.user@example.com",
                    "password": "password123",
                    "role": "employee",
                    "is_active": True,
                },
            ),
            ("PATCH", "/api/users/2", {"full_name": "Updated User"}),
            ("POST", "/api/users/2/reset-password", {"new_password": "updatedpass123"}),
        )

        for method, path, payload in requests:
            response = self.client.request(method, path, headers=headers, json=payload)
            self.assertEqual(response.status_code, 403, response.text)
            self.assertEqual(response.json()["detail"], "Admin access required")

    def test_employee_cannot_mutate_admin_operational_endpoints(self) -> None:
        headers = self._login_headers("employee")

        json_requests = (
            ("PATCH", "/api/documents/1", {"status": "needs_review"}),
            ("POST", "/api/documents/1/archive", None),
            ("POST", "/api/documents/1/restore", None),
            ("POST", "/api/documents/1/create-vehicle", {"external_id": "blocked-vehicle"}),
            ("POST", "/api/documents/1/set-primary", None),
            (
                "POST",
                "/api/documents/1/compare/review",
                {"with_document_id": 2, "action": "mark_reviewed", "comment": "blocked"},
            ),
            ("POST", "/api/documents/process-pending", None),
            ("POST", "/api/documents/reprocess-existing?limit=5", None),
            ("POST", "/api/jobs/1/retry", None),
            ("PATCH", "/api/services/1", {"comment": "blocked"}),
            ("POST", "/api/services/1/archive", None),
            ("POST", "/api/services/1/restore", None),
            ("PATCH", "/api/vehicles/1", {"status": "archived"}),
            ("POST", "/api/users/2/vehicle-assignments", {"vehicle_id": 1}),
            ("PATCH", "/api/users/2/vehicle-assignments/1", {"comment": "blocked"}),
            ("POST", "/api/vehicles/import", {}),
            ("PATCH", "/api/repairs/1", {"employee_comment": "blocked"}),
            ("POST", "/api/repairs/1/archive", None),
            ("POST", "/api/repairs/1/restore", None),
        )

        for method, path, payload in json_requests:
            response = self.client.request(method, path, headers=headers, json=payload)
            self.assertEqual(response.status_code, 403, response.text)
            self.assertEqual(response.json()["detail"], "Admin access required")

        delete_response = self.client.delete("/api/repairs/1", headers=headers)
        self.assertEqual(delete_response.status_code, 403, delete_response.text)
        self.assertEqual(delete_response.json()["detail"], "Admin access required")

        upload_response = self.client.post(
            "/api/imports/historical-repairs",
            headers=headers,
            files={
                "file": (
                    "history.xlsx",
                    b"PK\x03\x04fake-xlsx-content",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.assertEqual(upload_response.status_code, 403, upload_response.text)
        self.assertEqual(upload_response.json()["detail"], "Admin access required")

        labor_norm_import_response = self.client.post(
            "/api/labor-norms/import",
            headers=headers,
            files={
                "file": (
                    "labor-norms.xlsx",
                    b"PK\x03\x04fake-xlsx-content",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.assertEqual(labor_norm_import_response.status_code, 403, labor_norm_import_response.text)
        self.assertEqual(labor_norm_import_response.json()["detail"], "Admin access required")

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

    def test_login_accepts_normalized_username_variants(self) -> None:
        uppercase_response = self.client.post(
            "/api/auth/login",
            data={"username": "EMPLOYEE", "password": "secret123"},
        )
        self.assertEqual(uppercase_response.status_code, 200, uppercase_response.text)

        spaced_response = self.client.post(
            "/api/auth/login",
            data={"username": " employee ", "password": "secret123"},
        )
        self.assertEqual(spaced_response.status_code, 200, spaced_response.text)

    def test_successful_login_with_normalized_username_clears_shared_rate_limit_bucket(self) -> None:
        for _ in range(4):
            response = self.client.post(
                "/api/auth/login",
                data={"username": "EMPLOYEE", "password": "wrong-pass"},
            )
            self.assertEqual(response.status_code, 401, response.text)

        success_response = self.client.post(
            "/api/auth/login",
            data={"username": " employee ", "password": "secret123"},
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

    def test_password_reset_link_uses_configured_public_base_url(self) -> None:
        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-origin"),
            patch("app.api.auth.is_email_delivery_configured", return_value=True),
            patch.object(auth_api.settings, "public_base_url", "https://road700.example.com"),
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

    def test_password_reset_request_falls_back_to_manual_when_public_base_url_missing(self) -> None:
        with (
            patch("app.api.auth.generate_secure_token", return_value="fixed-reset-token-manual"),
            patch("app.api.auth.is_email_delivery_configured", return_value=False),
            patch("app.api.auth.send_password_reset_email", return_value=(True, None)) as send_email_mock,
        ):
            response = self.client.post(
                "/api/auth/password-reset/request",
                json={"email": "employee@example.com"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["delivery_method"], "manual")
        send_email_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
