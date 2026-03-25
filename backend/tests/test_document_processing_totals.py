from __future__ import annotations

import tempfile
import unittest
import warnings
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.exc import SAWarning
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base
from app.models.document import Document
from app.models.enums import DocumentKind, DocumentStatus, RepairStatus, ServiceStatus, UserRole, VehicleStatus, VehicleType
from app.models.repair import Repair, RepairCheck, RepairWork
from app.models.service import Service
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services import document_processing
from app.services.document_processing import OcrProfileSelection, process_document
from app.services.labor_norms import LaborNormApplicability


class DocumentProcessingTotalsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.storage_root = Path(cls.temp_dir.name) / "storage"
        cls.storage_root.mkdir(parents=True, exist_ok=True)
        cls.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, future=True)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()
        cls.temp_dir.cleanup()

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
            admin = User(
                full_name="Admin User",
                login="admin",
                email="admin@example.com",
                password_hash=get_password_hash("secret123"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            vehicle = Vehicle(
                external_id="truck-1",
                vehicle_type=VehicleType.TRUCK,
                plate_number="ВУ296516",
                vin="NLS3DFFSTP1064773",
                brand="Test",
                model="Truck",
                status=VehicleStatus.ACTIVE,
            )
            service = Service(
                name="ООО «Грузовые резервы»",
                city="Kazan",
                status=ServiceStatus.CONFIRMED,
                created_by_user_id=1,
            )
            db.add(admin)
            db.flush()
            service.created_by_user_id = admin.id
            service.confirmed_by_user_id = admin.id
            db.add_all([vehicle, service])
            db.flush()

            repair = Repair(
                order_number=None,
                repair_date=date(2026, 1, 19),
                vehicle_id=vehicle.id,
                service_id=None,
                created_by_user_id=admin.id,
                mileage=0,
                status=RepairStatus.DRAFT,
                is_preliminary=True,
                is_partially_recognized=False,
            )
            db.add(repair)
            db.flush()

            document = Document(
                repair_id=repair.id,
                uploaded_by_user_id=admin.id,
                original_filename="sample.pdf",
                storage_key="documents/test/sample.pdf",
                mime_type="application/pdf",
                source_type="pdf",
                kind=DocumentKind.ORDER,
                status=DocumentStatus.UPLOADED,
                is_primary=True,
                review_queue_priority=100,
            )
            db.add(document)
            db.commit()
            self.document_id = document.id

        target_file = self.storage_root / "documents/test/sample.pdf"
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_file.write_bytes(b"%PDF-1.4\n%test\n")

    def _run_processing(self, *, grand_total: float, vat_total: float) -> list[RepairCheck]:
        parsed_payload = {
            "extracted_fields": {
                "order_number": "ГП000210722",
                "repair_date": "2026-01-19",
                "plate_number": "ВУ296516",
                "vin": "NLS3DFFSTP1064773",
                "service_name": "ООО «Грузовые резервы»",
                "work_total": 69165.0,
                "parts_total": 120656.0,
                "vat_total": vat_total,
                "grand_total": grand_total,
            },
            "extracted_items": {
                "works": [
                    {
                        "work_code": None,
                        "work_name": "Работа 1",
                        "quantity": 1.0,
                        "price": 69165.0,
                        "line_total": 69165.0,
                    }
                ],
                "parts": [
                    {
                        "article": None,
                        "part_name": "Запчасть 1",
                        "quantity": 1.0,
                        "unit_name": "шт",
                        "price": 120656.0,
                        "line_total": 120656.0,
                    }
                ],
            },
            "confidence_map": {
                "order_number": 0.9,
                "repair_date": 0.9,
                "plate_number": 0.9,
                "vin": 0.9,
                "service_name": 0.9,
                "work_total": 0.9,
                "parts_total": 0.9,
                "vat_total": 0.9,
                "grand_total": 0.9,
            },
            "manual_review_reasons": [],
            "normalization_notes": [],
        }

        with self.SessionLocal() as db:
            labor_norm_applicability = SimpleNamespace(
                eligible=False,
                scope="none",
                reason_code="not_applicable",
                reason="Not applicable in test",
                brand_family=None,
                catalog_name=None,
            )
            labor_norm_summary = SimpleNamespace(matched_count=0, unmatched_count=0)
            with (
                patch.object(document_processing, "LOCAL_STORAGE_ROOT", self.storage_root),
                patch.object(document_processing, "extract_document_text", return_value=("test text", "mock", None)),
                patch.object(
                    document_processing,
                    "select_ocr_profile_scope",
                    return_value=OcrProfileSelection("gruzovye_rezervy", "test", "test"),
                ),
                patch.object(document_processing, "parse_document_text", return_value=parsed_payload),
                patch.object(document_processing, "build_dynamic_work_reference_checks", return_value=[]),
                patch.object(document_processing, "build_standard_hours_checks", return_value=[]),
                patch.object(document_processing, "build_repeat_repair_checks", return_value=[]),
                patch.object(document_processing, "build_duplicate_line_checks", return_value=[]),
                patch.object(document_processing, "build_expected_total_checks", return_value=(None, [])),
                patch.object(
                    document_processing,
                    "assess_labor_norm_applicability",
                    return_value=labor_norm_applicability,
                ),
                patch.object(
                    document_processing,
                    "enrich_work_payloads_with_labor_norms",
                    return_value=([], labor_norm_summary),
                ),
            ):
                process_document(db, self.document_id)
                checks = db.scalars(
                    select(RepairCheck).where(RepairCheck.repair_id == 1).order_by(RepairCheck.id.asc())
                ).all()
                repair = db.get(Repair, 1)
                self.assertIsNotNone(repair)
                return checks, repair

    def test_process_document_accepts_grand_total_without_readding_vat(self) -> None:
        checks, repair = self._run_processing(grand_total=189821.0, vat_total=34230.02)

        self.assertFalse(any(item.check_type == "ocr_total_mismatch" for item in checks))
        self.assertEqual(repair.status, RepairStatus.IN_REVIEW)

    def test_process_document_keeps_total_mismatch_when_neither_formula_matches(self) -> None:
        checks, repair = self._run_processing(grand_total=180000.0, vat_total=34230.02)

        mismatch = next((item for item in checks if item.check_type == "ocr_total_mismatch"), None)
        self.assertIsNotNone(mismatch)
        assert mismatch is not None
        self.assertEqual(mismatch.calculation_payload["calculated_total"], 189821.0)
        self.assertEqual(mismatch.calculation_payload["calculated_total_with_vat"], 224051.02)
        self.assertEqual(repair.status, RepairStatus.SUSPICIOUS)

    def test_process_document_resets_stale_totals_when_reparse_does_not_extract_them(self) -> None:
        self._run_processing(grand_total=189821.0, vat_total=34230.02)

        parsed_payload = {
            "extracted_fields": {
                "order_number": "ГП000210722",
                "repair_date": "2026-01-19",
                "plate_number": "ВУ296516",
                "vin": "NLS3DFFSTP1064773",
                "service_name": "ООО «Грузовые резервы»",
            },
            "extracted_items": {
                "works": [],
                "parts": [],
            },
            "confidence_map": {
                "order_number": 0.9,
                "repair_date": 0.9,
                "plate_number": 0.9,
                "vin": 0.9,
                "service_name": 0.9,
            },
            "manual_review_reasons": [],
            "normalization_notes": [],
        }

        with self.SessionLocal() as db:
            labor_norm_applicability = SimpleNamespace(
                eligible=False,
                scope="none",
                reason_code="not_applicable",
                reason="Not applicable in test",
                brand_family=None,
                catalog_name=None,
            )
            labor_norm_summary = SimpleNamespace(matched_count=0, unmatched_count=0)
            with (
                patch.object(document_processing, "LOCAL_STORAGE_ROOT", self.storage_root),
                patch.object(document_processing, "extract_document_text", return_value=("test text", "mock", None)),
                patch.object(
                    document_processing,
                    "select_ocr_profile_scope",
                    return_value=OcrProfileSelection("leader_trak", "test", "test"),
                ),
                patch.object(document_processing, "parse_document_text", return_value=parsed_payload),
                patch.object(document_processing, "build_dynamic_work_reference_checks", return_value=[]),
                patch.object(document_processing, "build_standard_hours_checks", return_value=[]),
                patch.object(document_processing, "build_repeat_repair_checks", return_value=[]),
                patch.object(document_processing, "build_duplicate_line_checks", return_value=[]),
                patch.object(document_processing, "build_expected_total_checks", return_value=(None, [])),
                patch.object(
                    document_processing,
                    "assess_labor_norm_applicability",
                    return_value=labor_norm_applicability,
                ),
                patch.object(
                    document_processing,
                    "enrich_work_payloads_with_labor_norms",
                    return_value=([], labor_norm_summary),
                ),
            ):
                process_document(db, self.document_id)
                repair = db.get(Repair, 1)
                self.assertIsNotNone(repair)
                assert repair is not None
                self.assertEqual(float(repair.work_total), 0.0)
                self.assertEqual(float(repair.parts_total), 0.0)
                self.assertEqual(float(repair.vat_total), 0.0)
                self.assertEqual(float(repair.grand_total), 0.0)

    def test_enrich_work_payloads_marks_local_service_operations_as_outside_catalog(self) -> None:
        works_payload = [
            {
                "work_code": "0101",
                "work_name": "Мойка технологическая седельного тягача",
                "quantity": 0.45,
                "standard_hours": 0.45,
                "price": 3600.0,
                "line_total": 1539.0,
            }
        ]
        applicability = LaborNormApplicability(
            eligible=True,
            scope="dongfeng_2025",
            reason_code="supported",
            reason="Автоматически выбран каталог Dong Feng 2025",
            brand_family="dongfeng",
            catalog_name="Dong Feng 2025",
        )

        with self.SessionLocal() as db:
            notes, summary = document_processing.enrich_work_payloads_with_labor_norms(
                db,
                works_payload,
                applicability,
            )

        reference_payload = works_payload[0]["reference_payload"]
        self.assertEqual(reference_payload["labor_norm_item_reason_code"], "outside_catalog_service")
        self.assertEqual(reference_payload["labor_norm_reference_status"], "outside_catalog_service")
        self.assertFalse(reference_payload["labor_norm_item_applicable"])
        self.assertEqual(summary.matched_count, 0)
        self.assertEqual(summary.unmatched_count, 0)
        self.assertIn("labor_norm_skip:outside_catalog_service", notes)
        self.assertNotIn("labor_norm_match_missing", notes)

    def test_enrich_work_payloads_marks_axb_diagnostic_service_as_outside_catalog(self) -> None:
        works_payload = [
            {
                "work_code": "17010-2",
                "work_name": "Подсоединение/отсоединение диагностического прибора",
                "quantity": 0.5,
                "standard_hours": 0.5,
                "price": 3420.0,
                "line_total": 1710.0,
            }
        ]
        applicability = LaborNormApplicability(
            eligible=True,
            scope="dongfeng_2025",
            reason_code="supported",
            reason="Автоматически выбран каталог Dong Feng 2025",
            brand_family="dongfeng",
            catalog_name="Dong Feng 2025",
        )

        with self.SessionLocal() as db:
            notes, summary = document_processing.enrich_work_payloads_with_labor_norms(
                db,
                works_payload,
                applicability,
            )

        reference_payload = works_payload[0]["reference_payload"]
        self.assertEqual(reference_payload["labor_norm_item_reason_code"], "outside_catalog_service")
        self.assertEqual(reference_payload["labor_norm_reference_status"], "outside_catalog_service")
        self.assertFalse(reference_payload["labor_norm_item_applicable"])
        self.assertEqual(summary.matched_count, 0)
        self.assertEqual(summary.unmatched_count, 0)
        self.assertIn("labor_norm_skip:outside_catalog_service", notes)

    def test_build_dynamic_work_reference_checks_skips_outside_catalog_service_operations(self) -> None:
        with self.SessionLocal() as db:
            current_repair = db.get(Repair, 1)
            vehicle = db.get(Vehicle, 1)
            admin = db.get(User, 1)
            self.assertIsNotNone(current_repair)
            self.assertIsNotNone(vehicle)
            self.assertIsNotNone(admin)
            assert current_repair is not None
            assert vehicle is not None
            assert admin is not None

            historical_repair = Repair(
                order_number="HIST-1",
                repair_date=date(2026, 1, 10),
                vehicle_id=vehicle.id,
                service_id=None,
                created_by_user_id=admin.id,
                mileage=120000,
                status=RepairStatus.CONFIRMED,
                is_preliminary=False,
                is_partially_recognized=False,
            )
            db.add(historical_repair)
            db.flush()
            db.add(
                RepairWork(
                    repair_id=historical_repair.id,
                    work_code="99999-9",
                    work_name="Историческая работа",
                    quantity=1.0,
                    price=1000.0,
                    line_total=1000.0,
                )
            )
            db.commit()

            works_payload = [
                {
                    "work_code": "0101",
                    "work_name": "Мойка технологическая седельного тягача",
                    "quantity": 0.45,
                    "standard_hours": 0.45,
                    "price": 3600.0,
                    "line_total": 1539.0,
                    "reference_payload": {
                        "labor_norm_item_reason_code": "outside_catalog_service",
                        "labor_norm_item_reason": "Операция использует локальный сервисный код и не относится к каталогу нормо-часов производителя",
                    },
                }
            ]

            checks = document_processing.build_dynamic_work_reference_checks(db, current_repair, works_payload)

        self.assertEqual(checks, [])
        dynamic_reference = works_payload[0]["reference_payload"]["dynamic_work_reference"]
        self.assertEqual(dynamic_reference["comparison_source"], "not_applicable")
        self.assertEqual(dynamic_reference["reason_code"], "outside_catalog_service")


if __name__ == "__main__":
    unittest.main()
