from __future__ import annotations

import unittest
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.enums import UserRole, VehicleStatus, VehicleType
from app.main import app
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleAssignmentHistory
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

    def test_list_users_skips_legacy_broken_vehicle_assignments(self) -> None:
        with self.SessionLocal() as db:
            vehicle = Vehicle(
                external_id="truck-users-1",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A111AA116",
                brand="Kamaz",
                model="5490",
                status=VehicleStatus.ACTIVE,
            )
            db.add(vehicle)
            db.flush()

            db.add_all(
                [
                    VehicleAssignmentHistory(
                        vehicle_id=vehicle.id,
                        user_id=2,
                        starts_at=date(2025, 1, 1),
                        ends_at=None,
                        assigned_by_user_id=1,
                        comment="valid assignment",
                    ),
                    VehicleAssignmentHistory(
                        vehicle_id=vehicle.id,
                        user_id=2,
                        starts_at=date(2025, 2, 1),
                        ends_at=None,
                        assigned_by_user_id=1,
                        comment="broken assignment",
                    ),
                ]
            )
            db.flush()
            broken_assignment_id = max(item.id for item in db.query(VehicleAssignmentHistory).all())
            db.commit()

        connection = self.engine.raw_connection()
        try:
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys = OFF")
            cursor.execute(
                "UPDATE vehicle_assignment_history SET vehicle_id = 999999 WHERE id = ?",
                (broken_assignment_id,),
            )
            connection.commit()
            cursor.execute("PRAGMA foreign_keys = ON")
            connection.commit()
            cursor.close()
        finally:
            connection.close()

        response = self.client.get("/api/users", headers=self._admin_headers())

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        employee = next(item for item in payload["items"] if item["id"] == 2)
        self.assertEqual(len(employee["assignments"]), 1)
        self.assertEqual(employee["assignments"][0]["comment"], "valid assignment")

    def test_create_vehicle_assignment_rejects_placeholder_vehicle(self) -> None:
        with self.SessionLocal() as db:
            placeholder_vehicle = Vehicle(
                external_id="__batch_import_placeholder__",
                vehicle_type=VehicleType.TRUCK,
                plate_number=None,
                brand="System",
                model="Placeholder",
                status=VehicleStatus.ACTIVE,
            )
            db.add(placeholder_vehicle)
            db.commit()
            placeholder_vehicle_id = placeholder_vehicle.id

        response = self.client.post(
            "/api/users/2/vehicle-assignments",
            headers=self._admin_headers(),
            json={
                "vehicle_id": placeholder_vehicle_id,
                "starts_at": "2025-04-01",
                "comment": "should be rejected",
            },
        )

        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(
            response.json()["detail"],
            "Нельзя назначить сотрудника на системную placeholder-технику",
        )

        with self.SessionLocal() as db:
            self.assertEqual(db.query(VehicleAssignmentHistory).count(), 0)


if __name__ == "__main__":
    unittest.main()
