from __future__ import annotations

import shutil
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.paths import get_storage_root, set_storage_root
from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, VehicleStatus, VehicleType
from app.models.repair import Repair
from app.models.service import Service
from app.models.enums import UserRole
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services import backups as backups_service
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class BackupsApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.storage_root.mkdir(parents=True, exist_ok=True)
        cls.original_storage_root = get_storage_root()
        cls.original_backup_engine = backups_service.engine
        set_storage_root(cls.storage_root)

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

        with self.SessionLocal() as db:
            admin = User(
                full_name="Admin User",
                login="admin",
                email="admin@example.com",
                password_hash=get_password_hash("secret123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.flush()

            vehicle = Vehicle(
                external_id="backup-truck",
                vehicle_type=VehicleType.TRUCK,
                plate_number="A001AA116",
                brand="Dong Feng",
                model="Backup Carrier",
                status=VehicleStatus.ACTIVE,
            )
            service = Service(
                name="Backup Service",
                city="Kazan",
                status=ServiceStatus.CONFIRMED,
                created_by_user_id=admin.id,
                confirmed_by_user_id=admin.id,
            )
            db.add_all([vehicle, service])
            db.flush()

            repair = Repair(
                order_number="BACKUP-001",
                repair_date=date(2025, 3, 1),
                vehicle_id=vehicle.id,
                service_id=service.id,
                created_by_user_id=admin.id,
                mileage=100000,
                work_total=1000,
                parts_total=500,
                vat_total=300,
                grand_total=1800,
                status=RepairStatus.IN_REVIEW,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="backup-order.pdf",
                storage_key="documents/backup-order.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.NEEDS_REVIEW,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add(document)
            db.flush()

            repair.source_document_id = document.id
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
        create_payload = create_response.json()
        backup_payload = create_payload["backup"]
        backup_id = backup_payload["backup_id"]
        self.assertEqual(backup_payload["storage_files_total"], 1)
        self.assertEqual(backup_payload["included_sections"], ["database", "storage_files"])
        self.assertEqual(backup_payload["excluded_sections"], ["backup_archives"])
        self.assertEqual(
            backup_payload["restore_effects"],
            ["replace_database", "replace_storage_files", "keep_backup_archives", "relogin_required"],
        )

        backup_dir_note = backups_service.get_backup_dir() / "keep-local-note.txt"
        backup_dir_note.parent.mkdir(parents=True, exist_ok=True)
        backup_dir_note.write_text("preserve backup directory", encoding="utf-8")

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

        with self.SessionLocal() as db:
            repair = db.scalar(select(Repair).where(Repair.order_number == "BACKUP-001"))
            document = db.scalar(select(Document).where(Document.original_filename == "backup-order.pdf"))
            self.assertIsNotNone(repair)
            self.assertIsNotNone(document)
            assert repair is not None
            assert document is not None
            repair.order_number = "BACKUP-CHANGED"
            repair.source_document_id = None
            document.repair_id = None
            db.commit()

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
        self.assertEqual(payload["backup"]["excluded_sections"], ["backup_archives"])
        self.assertEqual(
            payload["backup"]["restore_effects"],
            ["replace_database", "replace_storage_files", "keep_backup_archives", "relogin_required"],
        )
        stale_session_response = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(stale_session_response.status_code, 401, stale_session_response.text)
        self.assertEqual(stale_session_response.json()["detail"], "Could not validate credentials")

        with self.SessionLocal() as db:
            restored_user = db.scalar(select(User).where(User.login == "temporary"))
            restored_repair = db.scalar(select(Repair).where(Repair.order_number == "BACKUP-001"))
            restored_document = db.scalar(select(Document).where(Document.original_filename == "backup-order.pdf"))
            self.assertIsNone(restored_user)
            self.assertIsNotNone(restored_repair)
            self.assertIsNotNone(restored_document)
            assert restored_repair is not None
            assert restored_document is not None
            self.assertEqual(restored_repair.source_document_id, restored_document.id)
            self.assertEqual(restored_document.repair_id, restored_repair.id)

        self.assertEqual(file_path.read_text(encoding="utf-8"), "before restore")
        self.assertEqual(backup_dir_note.read_text(encoding="utf-8"), "preserve backup directory")

        fresh_headers = self._get_auth_headers()
        fresh_session_response = self.client.get("/api/auth/me", headers=fresh_headers)
        self.assertEqual(fresh_session_response.status_code, 200, fresh_session_response.text)

    def test_restore_backup_restores_previous_storage_if_database_restore_fails(self) -> None:
        file_path = self.storage_root / "documents" / "sample.txt"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text("before restore", encoding="utf-8")

        with self.SessionLocal() as db:
            backup_id = backups_service.create_backup_archive(db, source="manual")["backup_id"]

        file_path.write_text("mutated after backup", encoding="utf-8")

        original_restore_database_snapshot = backups_service.restore_database_snapshot

        def failing_restore_database_snapshot(*args, **kwargs):
            original_restore_database_snapshot(*args, **kwargs)
            raise RuntimeError("forced restore failure")

        with patch.object(
            backups_service,
            "restore_database_snapshot",
            side_effect=failing_restore_database_snapshot,
        ):
            with self.assertRaises(RuntimeError):
                backups_service.restore_backup_archive(
                    backup_id,
                    requested_by_login="admin",
                    requested_by_user_id=1,
                )
        self.assertEqual(file_path.read_text(encoding="utf-8"), "mutated after backup")

    def test_backup_paths_reject_traversal_backup_ids(self) -> None:
        with self.assertRaises(backups_service.InvalidBackupIdError):
            backups_service.archive_path_for("../../outside")

        with self.assertRaises(backups_service.InvalidBackupIdError):
            backups_service.load_backup_item_or_raise("../../outside")

    def test_restore_backup_skips_absolute_storage_members(self) -> None:
        backup_id = "20260405T120000Z_deadbeef"
        backup_dir = backups_service.get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        archive_path = backup_dir / f"{backup_id}.zip"
        manifest_path = backup_dir / f"{backup_id}{backups_service.BACKUP_MANIFEST_SUFFIX}"
        outside_target = Path(tempfile.gettempdir()) / "road700-backup-absolute-member.txt"
        if outside_target.exists():
            outside_target.unlink()

        manifest_path.write_text(
            (
                "{\n"
                f'  "backup_id": "{backup_id}",\n'
                f'  "filename": "{archive_path.name}",\n'
                '  "created_at": "2026-04-05T12:00:00+00:00"\n'
                "}\n"
            ),
            encoding="utf-8",
        )
        with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("database.json", '{"format":"road700_backup_v1","created_at":"2026-04-05T12:00:00+00:00","tables":[]}')
            archive.writestr("storage/documents/inside.txt", "safe")
            archive.writestr(f"storage/{outside_target.as_posix()}", "outside")

        extracted_dir = backups_service.extract_storage_snapshot_to_temp(backup_id)
        try:
            self.assertEqual((extracted_dir / "documents" / "inside.txt").read_text(encoding="utf-8"), "safe")
            self.assertFalse(outside_target.exists())
        finally:
            shutil.rmtree(extracted_dir, ignore_errors=True)
            archive_path.unlink(missing_ok=True)
            manifest_path.unlink(missing_ok=True)
            outside_target.unlink(missing_ok=True)

    def test_list_backups_marks_corrupt_manifest_without_failing_entire_response(self) -> None:
        headers = self._get_auth_headers()
        backup_id = "20260405T130000Z_deadbeef"
        backup_dir = backups_service.get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        archive_path = backup_dir / f"{backup_id}.zip"
        manifest_path = backup_dir / f"{backup_id}{backups_service.BACKUP_MANIFEST_SUFFIX}"
        archive_path.write_bytes(b"PK\x03\x04")
        manifest_path.write_text("{broken", encoding="utf-8")

        response = self.client.get("/api/backups", headers=headers)

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["backup_id"], backup_id)
        self.assertEqual(payload["items"][0]["status"], "corrupt")
        self.assertEqual(payload["items"][0]["filename"], archive_path.name)

    def test_restore_backup_returns_conflict_for_corrupt_manifest(self) -> None:
        headers = self._get_auth_headers()
        backup_id = "20260405T140000Z_deadbeef"
        backup_dir = backups_service.get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        archive_path = backup_dir / f"{backup_id}.zip"
        manifest_path = backup_dir / f"{backup_id}{backups_service.BACKUP_MANIFEST_SUFFIX}"
        archive_path.write_bytes(b"PK\x03\x04")
        manifest_path.write_text("{broken", encoding="utf-8")

        response = self.client.post(
            f"/api/backups/{backup_id}/restore",
            headers=headers,
            json={"confirm_backup_id": backup_id},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Backup metadata is corrupt")

    def test_restore_backup_returns_conflict_for_corrupt_archive(self) -> None:
        headers = self._get_auth_headers()
        backup_id = "20260405T150000Z_deadbeef"
        backup_dir = backups_service.get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        archive_path = backup_dir / f"{backup_id}.zip"
        manifest_path = backup_dir / f"{backup_id}{backups_service.BACKUP_MANIFEST_SUFFIX}"
        archive_path.write_bytes(b"not-a-zip")
        manifest_path.write_text(
            (
                "{\n"
                f'  "backup_id": "{backup_id}",\n'
                f'  "filename": "{archive_path.name}",\n'
                '  "created_at": "2026-04-05T15:00:00+00:00"\n'
                "}\n"
            ),
            encoding="utf-8",
        )

        response = self.client.post(
            f"/api/backups/{backup_id}/restore",
            headers=headers,
            json={"confirm_backup_id": backup_id},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Backup metadata is corrupt")

    def test_restore_backup_returns_conflict_for_non_object_database_snapshot(self) -> None:
        headers = self._get_auth_headers()
        backup_id = "20260405T160000Z_deadbeef"
        backup_dir = backups_service.get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        archive_path = backup_dir / f"{backup_id}.zip"
        manifest_path = backup_dir / f"{backup_id}{backups_service.BACKUP_MANIFEST_SUFFIX}"
        manifest_path.write_text(
            (
                "{\n"
                f'  "backup_id": "{backup_id}",\n'
                f'  "filename": "{archive_path.name}",\n'
                '  "created_at": "2026-04-05T16:00:00+00:00"\n'
                "}\n"
            ),
            encoding="utf-8",
        )
        with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(backups_service.DATABASE_SNAPSHOT_ENTRY, "[]")

        response = self.client.post(
            f"/api/backups/{backup_id}/restore",
            headers=headers,
            json={"confirm_backup_id": backup_id},
        )

        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(response.json()["detail"], "Backup metadata is corrupt")
