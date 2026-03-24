from __future__ import annotations

import unittest

from app.scripts.audit_sample_ocr_quality import AuditRow, build_doc_flags


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


if __name__ == "__main__":
    unittest.main()
