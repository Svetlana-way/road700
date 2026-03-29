from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.paths import get_storage_root, set_storage_root
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.services import backups as backups_service
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class BackupsApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.storage_root.mkdir(parents=True, exist_ok=True)
        cls.original_storage_root = get_storage_root()
        cls.original_backups_storage_root = backups_service.STORAGE_ROOT
        cls.original_backup_dir = backups_service.BACKUP_DIR
        cls.original_backup_engine = backups_service.engine
        set_storage_root(cls.storage_root)
        backups_service.STORAGE_ROOT = cls.storage_root
        backups_service.BACKUP_DIR = cls.storage_root / "backups"

        cls.engine = create_sqlite_test_engine(enforce_foreign_keys=True)
        backups_service.engine = cls.engine
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
        backups_service.STORAGE_ROOT = cls.original_backups_storage_root
        backups_service.BACKUP_DIR = cls.original_backup_dir
        backups_service.engine = cls.original_backup_engine
        set_storage_root(cls.original_storage_root)
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        reset_database(self.engine, Base.metadata)

        if self.storage_root.exists():
            for child in self.storage_root.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
        self.storage_root.mkdir(parents=True, exist_ok=True)
        backups_service.BACKUP_DIR = self.storage_root / "backups"

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

    def test_restore_backup_requires_reauthentication_and_restores_database_state(self) -> None:
        headers = self._get_auth_headers()
        file_path = self.storage_root / "documents" / "sample.txt"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("before restore", encoding="utf-8")

        create_response = self.client.post("/api/backups", headers=headers)
        self.assertEqual(create_response.status_code, 200, create_response.text)
        backup_id = create_response.json()["backup"]["backup_id"]

        with self.SessionLocal() as db:
            db.add(
                User(
                    full_name="Temporary User",
                    login="temporary",
                    email="temporary@example.com",
                    password_hash=get_password_hash("temporary123"),
                    role=UserRole.EMPLOYEE,
                    is_active=True,
                )
            )
            db.commit()

        file_path.write_text("mutated after backup", encoding="utf-8")

        restore_response = self.client.post(
            f"/api/backups/{backup_id}/restore",
            headers=headers,
            json={"confirm_backup_id": backup_id},
        )
        self.assertEqual(restore_response.status_code, 200, restore_response.text)
        payload = restore_response.json()
        self.assertTrue(payload["requires_reauthentication"])
        self.assertEqual(payload["post_restore_action"], "relogin")
        self.assertIn("Выполните вход заново", payload["message"])

        with self.SessionLocal() as db:
            restored_user = db.scalar(select(User).where(User.login == "temporary"))
            self.assertIsNone(restored_user)

        self.assertEqual(file_path.read_text(encoding="utf-8"), "before restore")
