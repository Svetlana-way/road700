from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import text

from app.scripts.audit_labor_norm_coverage import (
    build_audit_session,
    build_catalog_gap_resolution_section,
    build_catalog_gap_rewrite_section,
    build_customer_test_guidance_section,
    build_customer_testing_recommendation_section,
    build_summary_section,
    build_manual_review_rewrite_suggestion,
    build_token_candidates,
    build_unmatched_resolution_hint,
    CandidateRow,
    classify_unmatched_row,
    resolve_catalog_path,
)
from app.services.labor_norms import build_normalized_name
from app.models.enums import CatalogStatus
from app.models.labor_norm import LaborNorm
from app.scripts.audit_labor_norm_coverage import WorkAuditRow


class SimpleWorkAuditRowFactory:
    @staticmethod
    def catalog_gap(*, relative_path: str, work_name: str, hint: str) -> WorkAuditRow:
        return WorkAuditRow(
            relative_path=relative_path,
            work_code=None,
            work_name=work_name,
            standard_hours=None,
            price=None,
            line_total=None,
            matched=False,
            match=None,
            token_candidates=[],
            hour_candidates=[],
            unmatched_category="catalog_gap",
            unmatched_reason="gap",
            unmatched_resolution_hint=hint,
        )

    @staticmethod
    def matched(*, relative_path: str, work_name: str, code: str, norm_name: str) -> WorkAuditRow:
        return WorkAuditRow(
            relative_path=relative_path,
            work_code=code,
            work_name=work_name,
            standard_hours=0.5,
            price=None,
            line_total=None,
            matched=True,
            match=CandidateRow(
                code=code,
                name=norm_name,
                standard_hours=0.5,
                score=1.0,
                matched_by="name_variant",
            ),
            token_candidates=[],
            hour_candidates=[],
            unmatched_category=None,
            unmatched_reason=None,
            unmatched_resolution_hint=None,
        )

    @staticmethod
    def outside_catalog(*, relative_path: str, work_name: str) -> WorkAuditRow:
        return WorkAuditRow(
            relative_path=relative_path,
            work_code=None,
            work_name=work_name,
            standard_hours=None,
            price=None,
            line_total=None,
            matched=False,
            match=None,
            token_candidates=[],
            hour_candidates=[],
            unmatched_category="service_outside_catalog",
            unmatched_reason="outside",
            unmatched_resolution_hint="Оставлять вне каталога нормо-часов и показывать как локальную сервисную операцию.",
        )

    @staticmethod
    def ocr_noise(*, relative_path: str, work_name: str) -> WorkAuditRow:
        return WorkAuditRow(
            relative_path=relative_path,
            work_code=None,
            work_name=work_name,
            standard_hours=None,
            price=None,
            line_total=None,
            matched=False,
            match=None,
            token_candidates=[],
            hour_candidates=[],
            unmatched_category="ocr_noise",
            unmatched_reason="noise",
            unmatched_resolution_hint="Проверить исходный скан или OCR-слой: строка не подходит для автоматической сверки.",
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

    def test_classify_unmatched_row_marks_generic_electrical_repair_as_catalog_gap(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Ремонт электропроводки",
            work_code=None,
            standard_hours=1.0,
        )

        self.assertEqual(category, "catalog_gap")
        self.assertIn("слишком общо", reason)

    def test_classify_unmatched_row_marks_tebs_g2_diagnostics_as_outside_catalog(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="No Диагностика TEBS G2",
            work_code=None,
            standard_hours=None,
        )

        self.assertEqual(category, "service_outside_catalog")
        self.assertIn("tebs g2", reason.lower())

    def test_classify_unmatched_row_marks_generic_pneumatic_diagnostic_as_outside_catalog(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Поиск неисправности в пневмосистеме",
            work_code=None,
            standard_hours=0.5,
        )

        self.assertEqual(category, "service_outside_catalog")
        self.assertIn("пневмосистем", reason)

    def test_classify_unmatched_row_marks_axb_electrical_service_code_as_outside_catalog(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Электрические провода и разъемы, проверка, очистка",
            work_code="137102-3",
            standard_hours=1.5,
        )

        self.assertEqual(category, "service_outside_catalog")
        self.assertIn("локальный сервисный код", reason.lower())

    def test_classify_unmatched_row_explains_abs_sensor_gap_as_missing_position(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Датчик ABS, замена",
            work_code=None,
            standard_hours=None,
        )

        self.assertEqual(category, "catalog_gap")
        self.assertIn("ось", reason)

    def test_classify_unmatched_row_explains_brake_hose_gap_as_missing_circuit(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Тормозной шланг, замена",
            work_code=None,
            standard_hours=0.6,
        )

        self.assertEqual(category, "catalog_gap")
        self.assertIn("контур", reason)

    def test_classify_unmatched_row_explains_spare_wheel_gap(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Запасное колесо, снятие",
            work_code=None,
            standard_hours=0.3,
        )

        self.assertEqual(category, "catalog_gap")
        self.assertIn("запасного колеса", reason)

    def test_build_unmatched_resolution_hint_explains_abs_sensor_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Датчик ABS, замена",
            unmatched_category="catalog_gap",
        )

        self.assertIsNotNone(hint)
        self.assertIn("ось", hint)

    def test_build_unmatched_resolution_hint_explains_generic_wiring_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Ремонт электропроводки",
            unmatched_category="catalog_gap",
        )

        self.assertIsNotNone(hint)
        self.assertIn("конкретный жгут", hint)

    def test_build_unmatched_resolution_hint_uses_document_context_for_wiring_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Ремонт электропроводки",
            unmatched_category="catalog_gap",
            document_text="Рекомендации: Ремонт электропроводки ремонт провода заднего фонаря с заменой и перепиновкой клейм разъема.",
        )

        self.assertIsNotNone(hint)
        self.assertIn("заднего фонаря", hint)
        self.assertIn("перенести в строку работы", hint)

    def test_build_unmatched_resolution_hint_uses_trailer_side_context_for_wiring_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Электропроводка",
            unmatched_category="catalog_gap",
            document_text=(
                "Произведен ремонт эл проводов правой стороны п/п в двух местах. "
                "Выполнена замена разъёма фонаря L сторона."
            ),
        )

        self.assertIsNotNone(hint)
        self.assertIn("правой стороны п/п", hint)
        self.assertIn("фонаря/разъема", hint)

    def test_build_manual_review_rewrite_suggestion_uses_rear_lamp_context(self) -> None:
        suggestion = build_manual_review_rewrite_suggestion(
            work_name="Ремонт электропроводки",
            unmatched_category="catalog_gap",
            document_text="Рекомендации: Ремонт электропроводки ремонт провода заднего фонаря с заменой и перепиновкой клейм разъема.",
        )

        self.assertIsNotNone(suggestion)
        self.assertIn("Электропроводка заднего фонаря", suggestion)
        self.assertIn("не несколько отдельных операций", suggestion)

    def test_build_manual_review_rewrite_suggestion_uses_abs_context(self) -> None:
        suggestion = build_manual_review_rewrite_suggestion(
            work_name="Датчик ABS, замена",
            unmatched_category="catalog_gap",
            document_text="Рекомендации: Ремонт электропроводки ремонт провода удлинителя датчика АБС 2 шт.",
        )

        self.assertIsNotNone(suggestion)
        self.assertIn("удлинитель датчика АБС", suggestion)
        self.assertIn("не подтверждено", suggestion)

    def test_build_unmatched_resolution_hint_uses_abs_context_for_generic_wiring_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Ремонт электропроводки",
            unmatched_category="catalog_gap",
            document_text="Рекомендации: Ремонт электропроводки ремонт провода удлинителя датчика АБС 2 шт.",
        )

        self.assertIsNotNone(hint)
        self.assertIn("удлинителя датчика АБС", hint)
        self.assertIn("ось или сторону", hint)

    def test_build_manual_review_rewrite_suggestion_uses_abs_context_for_generic_wiring_gap(self) -> None:
        suggestion = build_manual_review_rewrite_suggestion(
            work_name="Ремонт электропроводки",
            unmatched_category="catalog_gap",
            document_text="Рекомендации: Ремонт электропроводки ремонт провода удлинителя датчика АБС 2 шт.",
        )

        self.assertIsNotNone(suggestion)
        self.assertIn("Проводка/удлинитель датчика АБС", suggestion)
        self.assertIn("проводке ABS", suggestion)

    def test_build_manual_review_rewrite_suggestion_returns_none_for_outside_catalog(self) -> None:
        suggestion = build_manual_review_rewrite_suggestion(
            work_name="TO-1 (250 000)",
            unmatched_category="service_outside_catalog",
        )

        self.assertIsNone(suggestion)

    def test_build_unmatched_resolution_hint_uses_document_context_for_brake_hose_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Тормозной шланг, замена",
            unmatched_category="catalog_gap",
            document_text="Заменен левый тормозной шланг, утечка воздуха.",
        )

        self.assertIsNotNone(hint)
        self.assertIn("левый тормозной шланг", hint)
        self.assertIn("ручную проверку", hint)

    def test_build_unmatched_resolution_hint_uses_document_context_for_abs_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Датчик ABS, замена",
            unmatched_category="catalog_gap",
            document_text="Рекомендации: Ремонт электропроводки ремонт провода удлинителя датчика АБС 2 шт.",
        )

        self.assertIsNotNone(hint)
        self.assertIn("удлинителя датчика АБС", hint)
        self.assertIn("менялся сам датчик", hint)

    def test_build_unmatched_resolution_hint_uses_document_context_for_spare_wheel_gap(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Запасное колесо, снятие",
            unmatched_category="catalog_gap",
            document_text="Выполнить слесарно-сварочные работы по креплению запасного колеса.",
        )

        self.assertIsNotNone(hint)
        self.assertIn("креплению запасного колеса", hint)
        self.assertIn("автоподбор нормы производителя не выполняется", hint)

    def test_build_unmatched_resolution_hint_explains_missing_amortizer_position_context(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="Установка болта крепления амортизатора",
            unmatched_category="catalog_gap",
            document_text="Установка болта крепления амортизатора",
        )

        self.assertIsNotNone(hint)
        self.assertIn("верхнего/нижнего крепления", hint)
        self.assertIn("ручной проверкой", hint)

    def test_build_unmatched_resolution_hint_marks_outside_catalog_as_non_matchable(self) -> None:
        hint = build_unmatched_resolution_hint(
            work_name="TO-1 (250 000)",
            unmatched_category="service_outside_catalog",
        )

        self.assertIsNotNone(hint)
        self.assertIn("вне каталога", hint)

    def test_build_catalog_gap_resolution_section_lists_unique_actions(self) -> None:
        rows = [
            SimpleWorkAuditRowFactory.catalog_gap(
                relative_path="doc-a.pdf",
                work_name="Датчик ABS, замена",
                hint="Чтобы подобрать норму, в заказ-наряде нужно указать ось или сторону датчика ABS.",
            ),
            SimpleWorkAuditRowFactory.catalog_gap(
                relative_path="doc-b.pdf",
                work_name="Датчик ABS, замена",
                hint="Чтобы подобрать норму, в заказ-наряде нужно указать ось или сторону датчика ABS.",
            ),
            SimpleWorkAuditRowFactory.catalog_gap(
                relative_path="doc-c.pdf",
                work_name="Ремонт электропроводки",
                hint="Для подбора нормы нужно указать конкретный жгут, разъем и зону автомобиля.",
            ),
        ]

        section = build_catalog_gap_resolution_section(rows)
        rendered = "\n".join(section)

        self.assertIn("## Catalog Gap Resolution Guide", rendered)
        self.assertIn("`Датчик ABS, замена`: Чтобы подобрать норму", rendered)
        self.assertIn("Docs: doc-a.pdf, doc-b.pdf", rendered)
        self.assertIn("`Ремонт электропроводки`: Для подбора нормы", rendered)

    def test_build_catalog_gap_resolution_section_merges_same_gap_with_different_hours(self) -> None:
        rows = [
            WorkAuditRow(
                relative_path="doc-a.pdf",
                work_code=None,
                work_name="Ремонт электропроводки",
                standard_hours=1.0,
                price=None,
                line_total=None,
                matched=False,
                match=None,
                token_candidates=[],
                hour_candidates=[],
                unmatched_category="catalog_gap",
                unmatched_reason="gap",
                unmatched_resolution_hint="Для подбора нормы нужно указать конкретный жгут, разъем и зону автомобиля.",
            ),
            WorkAuditRow(
                relative_path="doc-b.pdf",
                work_code=None,
                work_name="Ремонт электропроводки",
                standard_hours=None,
                price=None,
                line_total=None,
                matched=False,
                match=None,
                token_candidates=[],
                hour_candidates=[],
                unmatched_category="catalog_gap",
                unmatched_reason="gap",
                unmatched_resolution_hint="Для подбора нормы нужно указать конкретный жгут, разъем и зону автомобиля.",
            ),
        ]

        section = build_catalog_gap_resolution_section(rows)
        rendered = "\n".join(section)

        self.assertEqual(rendered.count("`Ремонт электропроводки`"), 1)
        self.assertIn("Docs: doc-a.pdf, doc-b.pdf", rendered)

    def test_build_catalog_gap_rewrite_section_lists_unique_drafts(self) -> None:
        rows = [
            WorkAuditRow(
                relative_path="doc-a.pdf",
                work_code=None,
                work_name="Ремонт электропроводки",
                standard_hours=1.0,
                price=None,
                line_total=None,
                matched=False,
                match=None,
                token_candidates=[],
                hour_candidates=[],
                unmatched_category="catalog_gap",
                unmatched_reason="gap",
                unmatched_resolution_hint="Для подбора нормы нужно указать конкретный жгут, разъем и зону автомобиля.",
                manual_review_rewrite_suggestion="Черновик для ручной проверки: `Электропроводка заднего фонаря, ремонт/замена разъема`.",
            ),
            WorkAuditRow(
                relative_path="doc-b.pdf",
                work_code=None,
                work_name="Ремонт электропроводки",
                standard_hours=None,
                price=None,
                line_total=None,
                matched=False,
                match=None,
                token_candidates=[],
                hour_candidates=[],
                unmatched_category="catalog_gap",
                unmatched_reason="gap",
                unmatched_resolution_hint="Для подбора нормы нужно указать конкретный жгут, разъем и зону автомобиля.",
                manual_review_rewrite_suggestion="Черновик для ручной проверки: `Электропроводка заднего фонаря, ремонт/замена разъема`.",
            ),
        ]

        section = build_catalog_gap_rewrite_section(rows)
        rendered = "\n".join(section)

        self.assertIn("## Catalog Gap Rewrite Drafts", rendered)
        self.assertEqual(rendered.count("`Ремонт электропроводки`"), 1)
        self.assertIn("Электропроводка заднего фонаря", rendered)
        self.assertIn("Docs: doc-a.pdf, doc-b.pdf", rendered)

    def test_build_catalog_gap_rewrite_section_handles_empty_drafts(self) -> None:
        section = build_catalog_gap_rewrite_section([])

        self.assertIn("- No rewrite drafts.", section)

    def test_build_catalog_gap_resolution_section_handles_clean_report(self) -> None:
        section = build_catalog_gap_resolution_section([])

        self.assertIn("- No catalog gaps remain.", section)

    def test_build_summary_section_separates_outside_only_documents_from_unresolved_reference_documents(self) -> None:
        rows = [
            SimpleWorkAuditRowFactory.outside_catalog(
                relative_path="outside-only.pdf",
                work_name="Нормокомплект",
            ),
            SimpleWorkAuditRowFactory.catalog_gap(
                relative_path="unresolved.pdf",
                work_name="Датчик ABS, замена",
                hint="Чтобы подобрать норму, в заказ-наряде нужно указать ось или сторону датчика ABS.",
            ),
        ]

        section = build_summary_section(rows, source_dir=Path("/tmp/samples"), labor_scope="dongfeng_2025")
        rendered = "\n".join(section)

        self.assertIn("- Docs without any matches: `2`", rendered)
        self.assertIn("- Docs without matches but only outside catalog: `1`", rendered)
        self.assertIn("- Docs with unresolved reference rows and no matches: `1`", rendered)

    def test_build_customer_testing_recommendation_section_marks_limited_pilot(self) -> None:
        rows = [
            SimpleWorkAuditRowFactory.matched(
                relative_path="doc-a.pdf",
                work_name="Воздушный фильтр - замена",
                code="11090111",
                norm_name="Диагностика неисправностей и замена элемента воздушного фильтра",
            ),
            SimpleWorkAuditRowFactory.catalog_gap(
                relative_path="doc-b.pdf",
                work_name="Датчик ABS, замена",
                hint="Чтобы подобрать норму, в заказ-наряде нужно указать ось или сторону датчика ABS.",
            ),
            SimpleWorkAuditRowFactory.outside_catalog(
                relative_path="doc-c.pdf",
                work_name="TO-1 (250 000)",
            ),
        ]

        section = build_customer_testing_recommendation_section(rows)
        rendered = "\n".join(section)

        self.assertIn("## Customer Testing Recommendation", rendered)
        self.assertIn("limited_pilot_only", rendered)
        self.assertIn("не как финальную сверку нормо-часов", rendered)
        self.assertIn("unresolved reference rows", rendered)

    def test_build_customer_testing_recommendation_section_does_not_count_outside_only_docs_as_match_defects(self) -> None:
        rows = [
            SimpleWorkAuditRowFactory.matched(
                relative_path="matched.pdf",
                work_name="Воздушный фильтр - замена",
                code="11090111",
                norm_name="Диагностика неисправностей и замена элемента воздушного фильтра",
            ),
            SimpleWorkAuditRowFactory.outside_catalog(
                relative_path="outside-only.pdf",
                work_name="Нормокомплект",
            ),
        ]

        section = build_customer_testing_recommendation_section(rows)
        rendered = "\n".join(section)

        self.assertIn("docs with unresolved reference rows and no matches `0`", rendered)
        self.assertNotIn("docs without any matches `1`", rendered)

    def test_build_customer_testing_recommendation_section_marks_ready_when_gaps_are_gone(self) -> None:
        rows = [
            SimpleWorkAuditRowFactory.matched(
                relative_path="doc-a.pdf",
                work_name="Воздушный фильтр - замена",
                code="11090111",
                norm_name="Диагностика неисправностей и замена элемента воздушного фильтра",
            ),
            SimpleWorkAuditRowFactory.matched(
                relative_path="doc-b.pdf",
                work_name="Ремень А/С снятие/установка",
                code="81040121",
                norm_name="Диагностика неисправностей и замена многоклинового ремня компрессора кондиционера",
            ),
            SimpleWorkAuditRowFactory.outside_catalog(
                relative_path="doc-a.pdf",
                work_name="TO-1 (250 000)",
            ),
            SimpleWorkAuditRowFactory.ocr_noise(
                relative_path="doc-b.pdf",
                work_name="Перекидка",
            ),
        ]

        section = build_customer_testing_recommendation_section(rows)
        rendered = "\n".join(section)

        self.assertIn("ready_for_customer_testing", rendered)

    def test_build_customer_test_guidance_section_lists_key_rules_and_examples(self) -> None:
        rows = [
            SimpleWorkAuditRowFactory.matched(
                relative_path="doc-a.pdf",
                work_name="Воздушный фильтр - замена",
                code="11090111",
                norm_name="Диагностика неисправностей и замена элемента воздушного фильтра",
            ),
            SimpleWorkAuditRowFactory.matched(
                relative_path="doc-b.pdf",
                work_name="Ремень А/С снятие/установка",
                code="81040121",
                norm_name="Диагностика неисправностей и замена многоклинового ремня компрессора кондиционера",
            ),
        ]

        section = build_customer_test_guidance_section(rows)
        rendered = "\n".join(section)

        self.assertIn("## Customer Test Guidance", rendered)
        self.assertIn("Для ABS-работ указывать ось или сторону", rendered)
        self.assertIn("Локальные сервисные услуги", rendered)
        self.assertIn("`Воздушный фильтр - замена` -> `11090111`", rendered)

    def test_classify_unmatched_row_marks_ocr_fragment_as_noise(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="Перекидка",
            work_code=None,
            standard_hours=0.5,
        )

        self.assertEqual(category, "ocr_noise")
        self.assertIn("обрывок", reason)

    def test_classify_unmatched_row_marks_dongfeng_diagnostic_software_entry_as_outside_catalog(self) -> None:
        category, reason = classify_unmatched_row(
            work_name="(нагностика с іспользованием ПС DongFeng",
            work_code=None,
            standard_hours=None,
        )

        self.assertEqual(category, "service_outside_catalog")
        self.assertIn("ПО производителя", reason)

    def test_build_token_candidates_uses_same_strict_rules_as_matcher(self) -> None:
        norms = [
            LaborNorm(
                scope="dongfeng_2025",
                brand_family="dongfeng",
                catalog_name="Dong Feng 2025",
                code="35501022",
                category="ABS",
                name_ru="Диагностика неисправностей и замена кронштейна-электромагнитный клапан ABS",
                name_ru_alt=None,
                name_cn=None,
                name_en=None,
                normalized_name=build_normalized_name(
                    "Диагностика неисправностей и замена кронштейна-электромагнитный клапан ABS"
                ),
                search_text="35501022 | Диагностика неисправностей и замена кронштейна-электромагнитный клапан ABS",
                standard_hours=0.5,
                source_sheet="Sheet1",
                source_file="catalog.csv",
                status=CatalogStatus.CONFIRMED,
            )
        ]

        candidates = build_token_candidates(
            "Диагностика/проверка датчика ABS",
            norms=norms,
        )

        self.assertEqual(candidates, [])

    def test_build_token_candidates_keeps_defensible_exact_code_candidate(self) -> None:
        norms = [
            LaborNorm(
                scope="dongfeng_2025",
                brand_family="dongfeng",
                catalog_name="Dong Feng 2025",
                code="11090111",
                category="ТО",
                name_ru="Диагностика неисправностей и замена элемента воздушного фильтра",
                name_ru_alt="Воздушный фильтр - замена;Воздушный фильтр",
                name_cn=None,
                name_en=None,
                normalized_name=build_normalized_name(
                    "Диагностика неисправностей и замена элемента воздушного фильтра"
                ),
                search_text="11090111 | Диагностика неисправностей и замена элемента воздушного фильтра",
                standard_hours=0.5,
                source_sheet="Sheet1",
                source_file="catalog.csv",
                status=CatalogStatus.CONFIRMED,
            )
        ]

        candidates = build_token_candidates(
            "Воздушный фильтр - замена",
            work_code="11090111",
            norms=norms,
        )

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].code, "11090111")
        self.assertEqual(candidates[0].matched_by, "code")
        self.assertEqual(candidates[0].score, 1.0)


if __name__ == "__main__":
    unittest.main()
