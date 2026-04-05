from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.enums import UserRole
from app.models.user import User
from app.scripts import init_admin
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class InitAdminScriptTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

    def test_init_admin_normalizes_existing_admin_login_to_lowercase(self) -> None:
        with self.SessionLocal() as db:
            db.add(
                User(
                    full_name="Existing Admin",
                    login="Admin",
                    email="admin@example.com",
                    password_hash="hash",
                    role=UserRole.ADMIN,
                    is_active=True,
                )
            )
            db.commit()

        with (
            patch.object(init_admin, "SessionLocal", self.SessionLocal),
            patch.object(init_admin.settings, "initial_admin_login", " Admin "),
            patch.object(init_admin.settings, "initial_admin_email", " ADMIN@example.com "),
            patch.object(init_admin.settings, "initial_admin_full_name", " System Administrator "),
            patch.object(init_admin.settings, "initial_admin_password", "change-me"),
        ):
            init_admin.init_admin()

        with self.SessionLocal() as db:
            admin = db.scalar(select(User).where(User.email == "admin@example.com"))
            self.assertIsNotNone(admin)
            assert admin is not None
            self.assertEqual(admin.full_name, "System Administrator")
            self.assertEqual(admin.login, "admin")

    def test_init_admin_rejects_empty_login_after_normalization(self) -> None:
        with (
            patch.object(init_admin, "SessionLocal", self.SessionLocal),
            patch.object(init_admin.settings, "initial_admin_login", "   "),
        ):
            with self.assertRaisesRegex(RuntimeError, "Initial admin login must not be empty"):
                init_admin.init_admin()

    def test_init_admin_rejects_empty_email_after_normalization(self) -> None:
        with (
            patch.object(init_admin, "SessionLocal", self.SessionLocal),
            patch.object(init_admin.settings, "initial_admin_login", "admin"),
            patch.object(init_admin.settings, "initial_admin_email", "   "),
        ):
            with self.assertRaisesRegex(RuntimeError, "Initial admin email must not be empty"):
                init_admin.init_admin()

    def test_init_admin_rejects_too_short_password(self) -> None:
        with (
            patch.object(init_admin, "SessionLocal", self.SessionLocal),
            patch.object(init_admin.settings, "initial_admin_login", "admin"),
            patch.object(init_admin.settings, "initial_admin_email", "admin@example.com"),
            patch.object(init_admin.settings, "initial_admin_password", "short"),
        ):
            with self.assertRaisesRegex(RuntimeError, "Initial admin password must be at least 8 characters long"):
                init_admin.init_admin()

    def test_init_admin_rejects_empty_full_name_after_normalization(self) -> None:
        with (
            patch.object(init_admin, "SessionLocal", self.SessionLocal),
            patch.object(init_admin.settings, "initial_admin_full_name", "   "),
        ):
            with self.assertRaisesRegex(RuntimeError, "Initial admin full name must not be empty"):
                init_admin.init_admin()


if __name__ == "__main__":
    unittest.main()
