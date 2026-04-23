from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from openpyxl import Workbook

from app.services import document_processing


class DocumentOcrRuntimeTestCase(unittest.TestCase):
    def test_get_ocr_runtime_issues_reports_missing_backend_and_renderer(self) -> None:
        with patch.object(
            document_processing,
            "get_ocr_runtime_status",
            return_value={
                "ocr_backend": None,
                "pdf_renderer": None,
                "image_ocr_available": False,
                "pdf_scan_ocr_available": False,
                "vision_available": False,
                "tesseract_available": False,
                "pdftoppm_available": False,
                "sips_available": False,
            },
        ):
            issues = document_processing.get_ocr_runtime_issues()

        self.assertIn("OCR backend for images is not available", issues)
        self.assertIn("PDF renderer for OCR is not available", issues)

    def test_extract_document_text_uses_tesseract_for_images(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, patch.object(
            document_processing,
            "get_available_ocr_backend",
            return_value="tesseract",
        ), patch.object(
            document_processing,
            "extract_image_text",
            return_value=("Распознанный текст", "tesseract"),
        ):
            text, extracted_from, failure_reason = document_processing.extract_document_text(
                Path(image_file.name),
                "image",
            )

        self.assertEqual(text, "Распознанный текст")
        self.assertEqual(extracted_from, "image_tesseract_ocr")
        self.assertIsNone(failure_reason)

    def test_extract_document_text_marks_image_ocr_as_unavailable(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".png") as image_file, patch.object(
            document_processing,
            "get_available_ocr_backend",
            return_value=None,
        ):
            text, extracted_from, failure_reason = document_processing.extract_document_text(
                Path(image_file.name),
                "image",
            )

        self.assertEqual(text, "")
        self.assertEqual(extracted_from, "manual_review")
        self.assertEqual(failure_reason, "image_ocr_unavailable")

    def test_extract_document_text_uses_scanned_pdf_tesseract_when_text_layer_is_empty(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf_file, patch.object(
            document_processing,
            "extract_pdf_text",
            return_value="",
        ), patch.object(
            document_processing,
            "get_available_ocr_backend",
            return_value="tesseract",
        ), patch.object(
            document_processing,
            "extract_scanned_pdf_text",
            return_value=("PDF OCR text", "tesseract"),
        ):
            text, extracted_from, failure_reason = document_processing.extract_document_text(
                Path(pdf_file.name),
                "pdf",
            )

        self.assertEqual(text, "PDF OCR text")
        self.assertEqual(extracted_from, "pdf_tesseract_ocr")
        self.assertIsNone(failure_reason)

    def test_extract_document_text_reports_pdf_renderer_unavailable_without_text_layer(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf_file, patch.object(
            document_processing,
            "extract_pdf_text",
            return_value="",
        ), patch.object(
            document_processing,
            "get_available_ocr_backend",
            return_value="tesseract",
        ), patch.object(
            document_processing,
            "extract_scanned_pdf_text",
            side_effect=RuntimeError("renderer missing"),
        ):
            text, extracted_from, failure_reason = document_processing.extract_document_text(
                Path(pdf_file.name),
                "pdf",
            )

        self.assertEqual(text, "")
        self.assertEqual(extracted_from, "pdf_text")
        self.assertEqual(failure_reason, "pdf_renderer_unavailable")

    def test_extract_document_text_reads_xlsx_workbook_rows(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".xlsx") as spreadsheet_file:
            workbook = Workbook()
            sheet = workbook.active
            sheet["A1"] = 'Общество с ограниченной ответственностью "КЛЕВЕР ТРАК"'
            sheet["A2"] = "Заказ-наряд № КТ262600020 от 13.01.2026"
            sheet["A3"] = "Итого по заказ-наряду :"
            sheet["B3"] = 116990.92
            workbook.save(spreadsheet_file.name)

            text, extracted_from, failure_reason = document_processing.extract_document_text(
                Path(spreadsheet_file.name),
                "xlsx",
            )

        self.assertIn("КЛЕВЕР ТРАК", text)
        self.assertIn("КТ262600020", text)
        self.assertIn("116990.92", text)
        self.assertEqual(extracted_from, "xlsx_text")
        self.assertIsNone(failure_reason)

    def test_extract_document_text_raises_clear_value_error_for_unreadable_pdf(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf_file:
            pdf_file.write(b"not-a-real-pdf")
            pdf_file.flush()

            with self.assertRaisesRegex(ValueError, "Не удалось прочитать PDF документ"):
                document_processing.extract_document_text(Path(pdf_file.name), "pdf")

    def test_extract_document_text_raises_clear_value_error_for_unreadable_xlsx(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".xlsx") as spreadsheet_file:
            spreadsheet_file.write(b"not-a-real-workbook")
            spreadsheet_file.flush()

            with self.assertRaisesRegex(ValueError, "Не удалось прочитать Excel документ"):
                document_processing.extract_document_text(Path(spreadsheet_file.name), "xlsx")

    def test_run_tesseract_ocr_invokes_tesseract_cli(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, patch.object(
            document_processing,
            "is_tesseract_ocr_available",
            return_value=True,
        ), patch("app.services.document_processing.subprocess.run") as subprocess_run:
            subprocess_run.side_effect = [
                unittest.mock.Mock(returncode=0, stdout="шум", stderr=""),
                unittest.mock.Mock(returncode=0, stdout="Заказ-наряд VIN 123 Артикул 9 576,00", stderr=""),
            ]

            payload = document_processing.run_tesseract_ocr([Path(image_file.name)])

        self.assertEqual(payload[image_file.name], "Заказ-наряд VIN 123 Артикул 9 576,00")
        first_command = subprocess_run.call_args_list[0].args[0]
        second_command = subprocess_run.call_args_list[1].args[0]
        self.assertEqual(first_command[0], document_processing.TESSERACT_BINARY)
        self.assertEqual(first_command[2], "stdout")
        self.assertIn(document_processing.TESSERACT_LANGUAGE, first_command)
        self.assertEqual(first_command[-1], "6")
        self.assertEqual(second_command[-1], "4")

    def test_run_vision_ocr_raises_clear_runtime_error_for_invalid_json(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, patch.object(
            document_processing,
            "is_vision_ocr_available",
            return_value=True,
        ), patch("app.services.document_processing.subprocess.run") as subprocess_run:
            subprocess_run.return_value = unittest.mock.Mock(returncode=0, stdout="not-json", stderr="")

            with self.assertRaisesRegex(RuntimeError, "Vision OCR returned an invalid response payload"):
                document_processing.run_vision_ocr([Path(image_file.name)])

    def test_run_vision_ocr_raises_clear_runtime_error_for_invalid_result_shape(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, patch.object(
            document_processing,
            "is_vision_ocr_available",
            return_value=True,
        ), patch("app.services.document_processing.subprocess.run") as subprocess_run:
            subprocess_run.return_value = unittest.mock.Mock(
                returncode=0,
                stdout='{"results":[{"path":"/tmp/page.jpg"}]}',
                stderr="",
            )

            with self.assertRaisesRegex(RuntimeError, "Vision OCR returned an invalid response payload"):
                document_processing.run_vision_ocr([Path(image_file.name)])

    def test_run_vision_ocr_uses_runtime_default_when_override_module_is_not_loaded(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, patch(
            "app.compat.document_processing.sys.modules",
            {},
        ), patch(
            "app.infrastructure.documents.text_extraction_service.is_vision_ocr_available_default",
            return_value=True,
        ), patch("app.infrastructure.documents.text_extraction_service.subprocess.run") as subprocess_run:
            subprocess_run.return_value = unittest.mock.Mock(
                returncode=0,
                stdout=f'{{"results":[{{"path":"{image_file.name}","text":"Распознанный текст"}}]}}',
                stderr="",
            )

            payload = document_processing.run_vision_ocr([Path(image_file.name)])

        self.assertEqual(payload[image_file.name], "Распознанный текст")

    def test_extract_axb_compact_work_items_accepts_no_marker_variant(self) -> None:
        text = """
Выполненные работы no заказ-наряду № 0000021658 от 02.07.2025
1 1700700 ТО прицепа 1| 3600,00 2,800 Ремонт 504,00 9 576,00 1 596,00
Итого работ:
13,2 на сумму: 2 264,40 43 023,60 7 170,60
"""

        works = document_processing.extract_axb_compact_work_items(text)

        self.assertEqual(len(works), 1)
        self.assertEqual(works[0]["work_code"], "1700700")
        self.assertEqual(works[0]["work_name"], "ТО прицепа")
        self.assertAlmostEqual(works[0]["line_total"], 9576.0, places=2)

    def test_ensure_ocr_runtime_raises_on_missing_dependencies(self) -> None:
        with patch.object(
            document_processing,
            "get_ocr_runtime_issues",
            return_value=["OCR backend for images is not available"],
        ):
            with self.assertRaises(RuntimeError):
                document_processing.ensure_ocr_runtime()


if __name__ == "__main__":
    unittest.main()
