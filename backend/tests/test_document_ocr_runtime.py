from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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

    def test_run_tesseract_ocr_invokes_tesseract_cli(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file, patch.object(
            document_processing,
            "is_tesseract_ocr_available",
            return_value=True,
        ), patch("app.services.document_processing.subprocess.run") as subprocess_run:
            subprocess_run.return_value.returncode = 0
            subprocess_run.return_value.stdout = "OCR output"
            subprocess_run.return_value.stderr = ""

            payload = document_processing.run_tesseract_ocr([Path(image_file.name)])

        self.assertEqual(payload[image_file.name], "OCR output")
        command = subprocess_run.call_args.args[0]
        self.assertEqual(command[0], document_processing.TESSERACT_BINARY)
        self.assertEqual(command[2], "stdout")
        self.assertIn(document_processing.TESSERACT_LANGUAGE, command)

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
