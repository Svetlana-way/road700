from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import text

from app.scripts.audit_labor_norm_coverage import (
    build_audit_session,
    classify_unmatched_row,
    resolve_catalog_path,
)


class AuditLaborNormCoverageTestCase(unittest.TestCase):
    def test_resolve_catalog_path_prefers_explicit_path(self) -> None:
        explicit_path = Path("/tmp/custom_catalog.csv")

        resolved = resolve_catalog_path("man_tgx_approx_srt_2026", str(explicit_path))

        self.assertEqual(resolved, explicit_path.resolve())

    def test_resolve_catalog_path_returns_known_man_catalog(self) -> None:
        resolved = resolve_catalog_path("man_tgx_approx_srt_2026", None)

        self.assertTrue(resolved.name.endswith("man_tgx_approx_srt_2026.csv"))
        self.assertTrue(resolved.exists())

    def test_build_audit_session_imports_catalog_into_memory(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            catalog_path = Path(tmp_dir) / "catalog.csv"
            catalog_path.write_text(
                "\n".join(
                    [
                        "code,category,source_sheet,name_ru,name_ru_alt,name_cn,name_en,standard_hours",
                        "TEST001,Общее,Общее,Проверка тормозов,,,,1.5",
                    ]
                ),
                encoding="utf-8",
            )

            with build_audit_session(labor_scope="test_scope", catalog_path=catalog_path) as db:
                norm_count = db.execute(text("select count(*) from labor_norms where scope = 'test_scope'")).scalar_one()

        self.assertEqual(norm_count, 1)

    def test_classify_unmatched_row_marks_signature_footer_as_ocr_noise(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Руководитель документов бухгалтер",
            work_code="5",
            standard_hours=None,
        )

        self.assertEqual(category, "ocr_noise")
        self.assertIn("подпись", reason)

    def test_classify_unmatched_row_marks_electrical_repair_as_outside_catalog(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Электропроводка заднего фонаря ремонт",
            work_code=None,
            standard_hours=0.5,
        )

        self.assertEqual(category, "service_outside_catalog")
        self.assertIn("вне каталога", reason)


if __name__ == "__main__":
    unittest.main()
