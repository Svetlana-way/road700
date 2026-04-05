from __future__ import annotations

import unittest

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class UsersApiTestCase(unittest.TestCase):
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

    def _admin_headers(self) -> dict[str, str]:
        response = self.client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "secret123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_create_user_rejects_login_duplicate_ignoring_case(self) -> None:
        response = self.client.post(
            "/api/users",
            headers=self._admin_headers(),
            json={
                "full_name": "Duplicate Login User",
                "login": " Admin ",
                "email": "duplicate-login@example.com",
                "password": "password123",
                "role": "employee",
                "is_active": True,
            },
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Пользователь с таким логином уже существует")

    def test_create_user_normalizes_login_to_lowercase(self) -> None:
        response = self.client.post(
            "/api/users",
            headers=self._admin_headers(),
            json={
                "full_name": "Case User",
                "login": " Case.Login ",
                "email": "case-user@example.com",
                "password": "password123",
                "role": "employee",
                "is_active": True,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["login"], "case.login")

    def test_update_user_rejects_login_duplicate_ignoring_case(self) -> None:
        response = self.client.patch(
            "/api/users/2",
            headers=self._admin_headers(),
            json={"login": " ADMIN "},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Пользователь с таким логином уже существует")

    def test_update_user_normalizes_login_to_lowercase(self) -> None:
        response = self.client.patch(
            "/api/users/2",
            headers=self._admin_headers(),
            json={"login": " Employee.Updated "},
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["login"], "employee.updated")


if __name__ == "__main__":
    unittest.main()
