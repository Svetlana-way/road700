from __future__ import annotations

import unittest

from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.labor_norms import (
    classify_known_non_catalog_operation,
    extract_labor_norm_code_from_text,
    find_best_labor_norm_match,
)
from tests.sqlite_test_utils import create_sqlite_test_engine, reset_database


class LaborNormMatchingTestCase(unittest.TestCase):
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

    def test_find_best_labor_norm_match_uses_embedded_code_from_work_name(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="50010801 Диагностика неисправностей и замена узла амортизатора подушки безопасности-передняя подвеска (кабина)",
                scope="dongfeng_2025",
            )

        self.assertIsNotNone(match)
        self.assertEqual(match.norm.code, "50010801")
        self.assertEqual(match.matched_by, "embedded_code")

    def test_extract_labor_norm_code_from_text_ignores_non_leading_noise(self) -> None:
        self.assertEqual(
            extract_labor_norm_code_from_text(
                "50010801 Диагностика неисправностей и замена узла амортизатора подушки безопасности"
            ),
            "50010801",
        )
        self.assertIsNone(
            extract_labor_norm_code_from_text(
                "Мойка технологическая седельного тягача 50010801"
            )
        )

    def test_find_best_labor_norm_match_rejects_conflicting_exact_code(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code="11170102",
                work_name="Мойка технологическая седельного тягача",
                scope="dongfeng_2025",
            )

        self.assertIsNone(match)

    def test_find_best_labor_norm_match_uses_exact_alias_variant(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            lamp_match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Замена ламп заднего фонаря",
                scope="dongfeng_2025",
            )
            valve_match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Проверка и регулировка клапанов",
                scope="dongfeng_2025",
            )

        self.assertIsNotNone(lamp_match)
        self.assertEqual(lamp_match.norm.code, "37142101")
        self.assertEqual(lamp_match.matched_by, "name_variant")
        self.assertIsNotNone(valve_match)
        self.assertEqual(valve_match.norm.code, "10070101")
        self.assertEqual(valve_match.matched_by, "name_variant")

    def test_classify_known_non_catalog_operation_marks_trailer_abs_diagnostics_as_outside_catalog(self) -> None:
        matched, reason = classify_known_non_catalog_operation(
            work_code=None,
            work_name="Диагностика ABS прицепа",
        )

        self.assertTrue(matched)
        self.assertIsNotNone(reason)


if __name__ == "__main__":
    unittest.main()
