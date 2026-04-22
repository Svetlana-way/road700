from __future__ import annotations

import unittest

from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.enums import CatalogStatus
from app.models.labor_norm import LaborNorm
from app.models.labor_norm_catalog import LaborNormCatalog
from app.scripts.import_labor_norms import import_labor_norms_with_session
from app.services.labor_norms import (
    classify_known_non_catalog_operation,
    extract_labor_norm_code_from_text,
    find_best_labor_norm_match,
    normalize_known_work_name,
    tokenize_match_text,
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

    def test_normalize_known_work_name_repairs_clipped_axb_service_name_by_code(self) -> None:
        self.assertEqual(
            normalize_known_work_name(
                "нение диагностического прибора",
                work_code="17010-2",
            ),
            "Подсоединение/отсоединение диагностического прибора",
        )

    def test_normalize_known_work_name_repairs_tebs_prefix_noise(self) -> None:
        self.assertEqual(
            normalize_known_work_name("No Диагностика TEBS G2"),
            "Диагностика TEBS G2",
        )

    def test_normalize_known_work_name_trims_trailing_ocr_tail_from_palm_service(self) -> None:
        self.assertEqual(
            normalize_known_work_name("Палм замена g"),
            "Палм замена",
        )

    def test_normalize_known_work_name_repairs_dongfeng_diagnostic_ocr_noise(self) -> None:
        self.assertEqual(
            normalize_known_work_name("(нагностика с іспользованием ПС DongFeng"),
            "Диагностика с использованием ПС DongFeng",
        )

    def test_normalize_known_work_name_repairs_calibration_with_diagnostic_tool_tail(self) -> None:
        self.assertEqual(
            normalize_known_work_name("Калибровка КПП и сцепления нение диагностического прибора", work_code="17010-2"),
            "Калибровка КПП и сцепления с использованием диагностического прибора",
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

    def test_find_best_labor_norm_match_uses_lighting_harness_aliases(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            lighting_diagnostic_match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Поиск неисправности в работе освещения",
                scope="dongfeng_2025",
            )
            tail_lamp_wiring_match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Электропроводка заднего фонаря ремонт",
                scope="dongfeng_2025",
            )

        self.assertIsNotNone(lighting_diagnostic_match)
        self.assertEqual(lighting_diagnostic_match.norm.code, "37241601")
        self.assertEqual(lighting_diagnostic_match.matched_by, "name_variant")
        self.assertIsNotNone(tail_lamp_wiring_match)
        self.assertEqual(tail_lamp_wiring_match.norm.code, "37241601")
        self.assertEqual(tail_lamp_wiring_match.matched_by, "name_variant")

    def test_find_best_labor_norm_match_rejects_generic_single_token_contains_match(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Электропроводка",
                scope="dongfeng_2025",
            )

        self.assertIsNone(match)

    def test_find_best_labor_norm_match_uses_ac_belt_alias(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Ремень А/С снятие/установка",
                scope="dongfeng_2025",
            )

        self.assertIsNotNone(match)
        self.assertEqual(match.norm.code, "81040121")
        self.assertEqual(match.matched_by, "name_variant")

    def test_find_best_labor_norm_match_uses_air_filter_alias_with_exact_code(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code="11090111",
                work_name="Воздушный фильтр - замена",
                scope="dongfeng_2025",
            )

        self.assertIsNotNone(match)
        self.assertEqual(match.norm.code, "11090111")
        self.assertEqual(match.matched_by, "code")

    def test_find_best_labor_norm_match_rejects_generic_check_and_adjust_phrase(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Проверка и регулировка",
                scope="dongfeng_2025",
            )

        self.assertIsNone(match)

    def test_find_best_labor_norm_match_rejects_ambiguous_abs_sensor_diagnostic(self) -> None:
        with self.SessionLocal() as db:
            import_labor_norms_with_session(db)
            match = find_best_labor_norm_match(
                db,
                work_code=None,
                work_name="Диагностика/проверка датчика ABS",
                scope="dongfeng_2025",
            )

        self.assertIsNone(match)

    def test_tokenize_match_text_drops_stopwords_after_homoglyph_normalization(self) -> None:
        self.assertEqual(tokenize_match_text("Проверка и регулировка"), [])

    def test_find_best_labor_norm_match_ignores_norms_from_archived_catalog(self) -> None:
        with self.SessionLocal() as db:
            db.add(
                LaborNormCatalog(
                    scope="archived_catalog",
                    catalog_name="Archived Catalog",
                    brand_family="dongfeng",
                    priority=100,
                    auto_match_enabled=True,
                    status=CatalogStatus.ARCHIVED,
                )
            )
            db.add(
                LaborNorm(
                    scope="archived_catalog",
                    brand_family="dongfeng",
                    catalog_name="Archived Catalog",
                    code="A-001",
                    category="Общее",
                    name_ru="Архивная операция",
                    name_ru_alt=None,
                    name_cn=None,
                    name_en=None,
                    normalized_name="архивная операция",
                    search_text="A-001 | Архивная операция",
                    standard_hours=1.5,
                    source_sheet="Sheet1",
                    source_file="archived.xlsx",
                    status=CatalogStatus.CONFIRMED,
                )
            )
            db.commit()
            match = find_best_labor_norm_match(
                db,
                work_code="A-001",
                work_name="Архивная операция",
                scope="archived_catalog",
            )

        self.assertIsNone(match)

    def test_classify_known_non_catalog_operation_marks_trailer_abs_diagnostics_as_outside_catalog(self) -> None:
        matched, reason = classify_known_non_catalog_operation(
            work_code=None,
            work_name="Диагностика ABS прицепа",
        )

        self.assertTrue(matched)
        self.assertIsNotNone(reason)

    def test_classify_known_non_catalog_operation_does_not_hide_generic_electrical_work(self) -> None:
        matched, reason = classify_known_non_catalog_operation(
            work_code=None,
            work_name="Ремонт электропроводки",
        )

        self.assertFalse(matched)
        self.assertIsNone(reason)

    def test_classify_known_non_catalog_operation_marks_axb_electrical_service_code_as_outside_catalog(self) -> None:
        matched, reason = classify_known_non_catalog_operation(
            work_code="137102-3",
            work_name="Электрические провода и разъемы, проверка, очистка",
        )

        self.assertTrue(matched)
        self.assertIsNotNone(reason)


if __name__ == "__main__":
    unittest.main()
