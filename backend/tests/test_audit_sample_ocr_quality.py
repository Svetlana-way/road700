from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.scripts.audit_sample_ocr_quality import AuditRow, audit_documents, build_doc_flags, format_project_path, render_report


class AuditSampleOcrQualityTestCase(unittest.TestCase):
    def test_build_doc_flags_treats_invoice_only_gruzovye_fields_as_not_required(self) -> None:
        row = AuditRow(
            service_label="Грузовые резервы",
            profile_scope="gruzovye_rezervy",
            relative_path="Заказ-наряды/Заказ наряды Грузовые резервы /Счет (Диадок) № ГПТ00000512 от 09.01.2026.pdf",
            source_type="pdf",
            extract_source="pdf_text",
            extract_failure_reason=None,
            extracted_fields={
                "repair_date": "2026-01-09",
                "plate_number": "2278ОТ09",
                "parts_total": 2038.0,
                "vat_total": 8842.92,
                "grand_total": 49038.0,
            },
            manual_review_reasons=[],
            works_count=0,
            parts_count=5,
            invoice_only=True,
        )

        flags = build_doc_flags(row)

        self.assertTrue(flags["order_number"])
        self.assertTrue(flags["mileage"])
        self.assertTrue(flags["work_total"])
        self.assertTrue(flags["works_lines"])
        self.assertTrue(flags["parts_lines"])
        self.assertTrue(flags["manual_review_free"])

    def test_build_doc_flags_keeps_regular_document_requirements(self) -> None:
        row = AuditRow(
            service_label="Грузовые резервы",
            profile_scope="gruzovye_rezervy",
            relative_path="sample.pdf",
            source_type="pdf",
            extract_source="pdf_text",
            extract_failure_reason=None,
            extracted_fields={"repair_date": "2026-01-09"},
            manual_review_reasons=["order_number_missing"],
            works_count=0,
            parts_count=0,
            invoice_only=False,
        )

        flags = build_doc_flags(row)

        self.assertFalse(flags["order_number"])
        self.assertFalse(flags["mileage"])
        self.assertFalse(flags["work_total"])
        self.assertFalse(flags["works_lines"])
        self.assertFalse(flags["parts_lines"])
        self.assertFalse(flags["manual_review_free"])

    def test_build_doc_flags_treats_suppressed_missing_mileage_as_structurally_ok(self) -> None:
        row = AuditRow(
            service_label="Логистика",
            profile_scope="logistics",
            relative_path="sample.pdf",
            source_type="pdf",
            extract_source="pdf_text",
            extract_failure_reason=None,
            extracted_fields={
                "order_number": "2472",
                "repair_date": "2026-01-14",
                "plate_number": "У026АХ716",
                "vin": "LGAG3DV29R8846629",
            },
            manual_review_reasons=[],
            works_count=3,
            parts_count=2,
            invoice_only=False,
            mileage_not_required=True,
        )

        flags = build_doc_flags(row)

        self.assertTrue(flags["mileage"])
        self.assertTrue(flags["vin"])
        self.assertFalse(flags["chassis_number"])

    def test_build_doc_flags_marks_chassis_when_vin_missing(self) -> None:
        row = AuditRow(
            service_label="СибТракСкан",
            profile_scope="sibtrakscan",
            relative_path="sample.pdf",
            source_type="pdf",
            extract_source="pdf_text",
            extract_failure_reason=None,
            extracted_fields={
                "order_number": "ЗСТ26002072",
                "repair_date": "2026-03-09",
                "plate_number": "С026ВВ716",
                "chassis_number": "P8834073",
                "mileage": 639889,
            },
            manual_review_reasons=[],
            works_count=4,
            parts_count=2,
            invoice_only=False,
        )

        flags = build_doc_flags(row)

        self.assertFalse(flags["vin"])
        self.assertTrue(flags["chassis_number"])
        self.assertTrue(flags["mileage"])

    def test_format_project_path_keeps_external_path_without_crashing(self) -> None:
        path = Path("/tmp/ocr-audit-test/sample.pdf")

        formatted = format_project_path(path)

        self.assertEqual(formatted, str(path))

    def test_render_report_uses_passed_source_dir_in_header(self) -> None:
        row = AuditRow(
            service_label="Test",
            profile_scope="default",
            relative_path="/tmp/ocr-audit-test/sample.pdf",
            source_type="pdf",
            extract_source="pdf_text",
            extract_failure_reason=None,
            extracted_fields={},
            manual_review_reasons=[],
            works_count=0,
            parts_count=0,
            invoice_only=False,
        )

        report = render_report([row], source_dir=Path("/tmp/ocr-audit-test"))

        self.assertIn("Источник: `/tmp/ocr-audit-test`", report)

    def test_audit_documents_parses_without_registry_enrichment(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            sample_path = Path(tmp_dir) / "sample.pdf"
            sample_path.write_bytes(b"%PDF-1.4")

            with (
                patch(
                    "app.services.document_processing.extract_document_text",
                    return_value=("Заказ-наряд № 1 от 01.01.2026", "pdf_text", None),
                ),
                patch(
                    "app.services.document_processing.parse_document_text",
                    return_value={
                        "extracted_fields": {"order_number": "1"},
                        "manual_review_reasons": [],
                        "extracted_items": {"works": [], "parts": []},
                    },
                ) as parse_mock,
                patch(
                    "app.services.document_processing.is_gruzovye_rezervy_invoice_only_document",
                    return_value=False,
                ),
            ):
                rows = audit_documents(Path(tmp_dir))

        self.assertEqual(len(rows), 1)
        self.assertIsNone(parse_mock.call_args.kwargs["db"])

    def test_audit_documents_uses_registry_session_when_requested(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            sample_path = Path(tmp_dir) / "sample.pdf"
            sample_path.write_bytes(b"%PDF-1.4")
            sentinel_db = object()

            with (
                patch(
                    "app.services.document_processing.extract_document_text",
                    return_value=("Заказ-наряд № 1 от 01.01.2026", "pdf_text", None),
                ),
                patch(
                    "app.services.document_processing.parse_document_text",
                    return_value={
                        "extracted_fields": {"order_number": "1", "vin": "VIN123"},
                        "manual_review_reasons": [],
                        "extracted_items": {"works": [], "parts": []},
                    },
                ) as parse_mock,
                patch(
                    "app.services.document_processing.is_gruzovye_rezervy_invoice_only_document",
                    return_value=False,
                ),
                patch(
                    "app.scripts.audit_sample_ocr_quality.build_registry_audit_session",
                ) as registry_session_mock,
            ):
                registry_session_mock.return_value.__enter__.return_value = sentinel_db
                registry_session_mock.return_value.__exit__.return_value = False
                rows = audit_documents(Path(tmp_dir), use_registry_enrichment=True)

        self.assertEqual(len(rows), 1)
        self.assertIs(parse_mock.call_args.kwargs["db"], sentinel_db)


if __name__ == "__main__":
    unittest.main()
