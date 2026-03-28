from __future__ import annotations

import unittest
from datetime import date
from types import SimpleNamespace

from app.models.enums import CatalogStatus, CheckSeverity, RepairStatus
from app.models.repair import Repair, RepairCheck, RepairPart, RepairWork
from app.services.repair_report_analysis import build_repair_executive_report


class RepairReportAnalysisTestCase(unittest.TestCase):
    def _build_repair(self, *, works: list[RepairWork], parts: list[RepairPart]) -> Repair:
        return Repair(
            order_number="A22598",
            repair_date=date(2026, 3, 20),
            vehicle_id=1,
            mileage=100000,
            reason="Ремонт крыла. Замена заднего правого фонаря.",
            employee_comment=None,
            work_total=12000,
            parts_total=5000,
            vat_total=0,
            grand_total=17000,
            status=RepairStatus.IN_REVIEW,
            is_preliminary=True,
            is_partially_recognized=False,
            works=works,
            parts=parts,
            checks=[],
            documents=[],
        )

    def test_report_flags_tail_light_part_without_matching_work(self) -> None:
        repair = self._build_repair(
            works=[
                RepairWork(
                    work_code="86301-2",
                    work_name="Ремонт заднего правого крыла",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=12000,
                    line_total=12000,
                    status=CatalogStatus.CONFIRMED,
                )
            ],
            parts=[
                RepairPart(
                    article="773-1926R-WE",
                    part_name="Задний фонарь правый",
                    quantity=1,
                    unit_name="шт",
                    price=5000,
                    line_total=5000,
                    status=CatalogStatus.CONFIRMED,
                )
            ],
        )

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        self.assertTrue(
            any(item["title"] == "Материал по зоне «фонарь» списан без профильной работы" for item in report["findings"])
        )

    def test_report_skips_tail_light_part_gap_when_matching_work_exists(self) -> None:
        repair = self._build_repair(
            works=[
                RepairWork(
                    work_code="86301-2",
                    work_name="Ремонт заднего правого крыла",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=8000,
                    line_total=8000,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="37100-2",
                    work_name="Замена заднего правого фонаря",
                    quantity=1,
                    standard_hours=0.5,
                    actual_hours=0.5,
                    price=4000,
                    line_total=4000,
                    status=CatalogStatus.CONFIRMED,
                ),
            ],
            parts=[
                RepairPart(
                    article="773-1926R-WE",
                    part_name="Задний фонарь правый",
                    quantity=1,
                    unit_name="шт",
                    price=5000,
                    line_total=5000,
                    status=CatalogStatus.CONFIRMED,
                )
            ],
        )

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        self.assertFalse(
            any(item["title"] == "Материал по зоне «фонарь» списан без профильной работы" for item in report["findings"])
        )

    def test_report_flags_incomplete_work_table_when_line_sum_mismatches_header_total(self) -> None:
        repair = self._build_repair(
            works=[
                RepairWork(
                    work_code="137102-3",
                    work_name="Электрические провода и разъемы, проверка, очистка",
                    quantity=1.5,
                    standard_hours=1.5,
                    actual_hours=1.5,
                    price=3600,
                    line_total=5130,
                    status=CatalogStatus.PRELIMINARY,
                )
            ],
            parts=[],
        )
        repair.work_total = 43023.6
        repair.grand_total = 43023.6
        repair.checks = [
            RepairCheck(
                repair_id=1,
                check_type="ocr_work_lines_total_mismatch",
                severity=CheckSeverity.SUSPICIOUS,
                title="Сумма строк работ не совпадает с итогом работ",
                details="Нужна ручная проверка работ в заказ-наряде",
                calculation_payload={"lines_total": 33105.6, "header_total": 43023.6},
                is_resolved=False,
            )
        ]

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        finding = next((item for item in report["findings"] if item["title"] == "Табличная часть работ распознана неполно"), None)
        self.assertIsNotNone(finding)
        self.assertEqual(finding["severity"], "high")
        self.assertIn("не сходится", finding["summary"])
        self.assertTrue(any("77%" in evidence for evidence in finding["evidence"]))

    def test_report_flags_total_mismatch_as_ocr_risk(self) -> None:
        repair = self._build_repair(works=[], parts=[])
        repair.checks = [
            RepairCheck(
                repair_id=1,
                check_type="ocr_total_mismatch",
                severity=CheckSeverity.SUSPICIOUS,
                title="Сумма строк не совпадает с итоговой суммой",
                details="Нужна ручная проверка итогов заказ-наряда",
                calculation_payload={
                    "calculated_total": 15000.0,
                    "calculated_total_with_vat": 18000.0,
                    "grand_total": 17000.0,
                },
                is_resolved=False,
            )
        ]

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        finding = next((item for item in report["findings"] if item["title"] == "Итоги документа не сходятся после OCR-разбора"), None)
        self.assertIsNotNone(finding)
        self.assertEqual(finding["severity"], "high")
        self.assertEqual(finding["category"], "Документ и OCR")

    def test_report_keeps_multiple_distinct_findings_with_same_title(self) -> None:
        repair = self._build_repair(works=[], parts=[])
        repair.checks = [
            RepairCheck(
                repair_id=1,
                check_type="ocr_work_reference_missing",
                severity=CheckSeverity.WARNING,
                title="Работа не найдена в динамическом справочнике",
                details="Замена рулевой тяги · в базе пока нет подтвержденной истории для сверки",
                calculation_payload={
                    "work_code": "123",
                    "work_name": "Замена рулевой тяги",
                    "comparison_source": "none",
                },
                is_resolved=False,
            ),
            RepairCheck(
                repair_id=1,
                check_type="ocr_work_reference_missing",
                severity=CheckSeverity.WARNING,
                title="Работа не найдена в динамическом справочнике",
                details="Замена трубки компрессора · в базе пока нет подтвержденной истории для сверки",
                calculation_payload={
                    "work_code": "456",
                    "work_name": "Замена трубки компрессора",
                    "comparison_source": "none",
                },
                is_resolved=False,
            ),
        ]

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        matching_findings = [item for item in report["findings"] if item["title"] == "Работа не подтверждается накопленной практикой"]
        self.assertEqual(len(matching_findings), 2)
        self.assertTrue(any("Замена рулевой тяги" in evidence for item in matching_findings for evidence in item["evidence"]))
        self.assertTrue(
            any("Замена трубки компрессора" in evidence for item in matching_findings for evidence in item["evidence"])
        )

    def test_report_flags_unresolved_vibration_and_non_original_work_markers(self) -> None:
        repair = self._build_repair(
            works=[
                RepairWork(
                    work_code="31",
                    work_name="Индукция. слесарные работы.",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=2100,
                    line_total=1890,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="32",
                    work_name="Доработка аналоговых з/ч",
                    quantity=0.2,
                    standard_hours=0.2,
                    actual_hours=0.2,
                    price=2101.85,
                    line_total=378.33,
                    status=CatalogStatus.CONFIRMED,
                ),
            ],
            parts=[],
        )
        repair.order_number = "ЛТ250012276"
        repair.reason = "На холостом ходу при малых оборотах вибрации по кабине."
        repair.employee_comment = "неисправности по вибрации по кабине на момент осмотра не обнаружено, подушки двс в норме"
        repair.work_total = 2268.33
        repair.grand_total = 2268.33

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        vibration_finding = next(
            (item for item in report["findings"] if item["title"] == "По заявленной вибрации проблема не подтверждена"),
            None,
        )
        self.assertIsNotNone(vibration_finding)
        self.assertEqual(vibration_finding["severity"], "high")

        non_original_finding = next(
            (item for item in report["findings"] if item["title"] == "Есть признаки неоригинальных или восстановленных запчастей"),
            None,
        )
        self.assertIsNotNone(non_original_finding)

        finance_section = next((item for item in report["full_report_sections"] if item["key"] == "financial_risks"), None)
        self.assertIsNotNone(finance_section)
        self.assertTrue(any("2 268,33 ₽" in line for line in finance_section["items"]))

    def test_report_flags_suspicious_oil_for_volvo_family_vehicle(self) -> None:
        repair = self._build_repair(
            works=[],
            parts=[
                RepairPart(
                    article="ZZ000253133903",
                    part_name="Масло моторное синтетическое DONGFENG Diesel Ultra CS, EURO-6 10W40, бочка 205 л.",
                    quantity=37,
                    unit_name="литр",
                    price=447.16,
                    line_total=15717.50,
                    status=CatalogStatus.CONFIRMED,
                )
            ],
        )
        repair.order_number = "ЛТ250012276"
        repair.__dict__["vehicle"] = SimpleNamespace(brand="FH13A42T", model=None)
        repair.parts_total = 15717.50
        repair.grand_total = 15717.50

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        finding = next(
            (item for item in report["findings"] if item["title"] == "Моторное масло требует проверки на соответствие Volvo"),
            None,
        )
        self.assertIsNotNone(finding)
        self.assertEqual(finding["severity"], "high")

    def test_report_flags_exchange_program_from_document_notes(self) -> None:
        repair = self._build_repair(works=[], parts=[])

        report = build_repair_executive_report(
            repair,
            source_payload={"normalization_notes": ["exchange_program_present"]},
            manual_review_reason_labels={},
        )

        finding = next(
            (item for item in report["findings"] if item["title"] == "Документ содержит отметку об Exchange Program"),
            None,
        )
        self.assertIsNotNone(finding)

    def test_report_flags_service_not_done_and_shows_gross_risk_estimate(self) -> None:
        repair = self._build_repair(
            works=[
                RepairWork(
                    work_code="30",
                    work_name="Обтекатель лев. - ремонт",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=2100,
                    line_total=1890.0,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="31",
                    work_name="Индукция. слесарные работы.",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=2100,
                    line_total=1890.0,
                    status=CatalogStatus.CONFIRMED,
                ),
            ],
            parts=[],
        )
        repair.work_total = 3780.0
        repair.parts_total = 0
        repair.vat_total = 756.0
        repair.grand_total = 4536.0

        report = build_repair_executive_report(
            repair,
            source_payload={"service_not_done": ["Забиты глушители на модуляторах"]},
            manual_review_reason_labels={},
        )

        finding = next(
            (item for item in report["findings"] if item["title"] == "Сервис сам зафиксировал нерешённые замечания"),
            None,
        )
        self.assertIsNotNone(finding)

        finance_section = next((item for item in report["full_report_sections"] if item["key"] == "financial_risks"), None)
        self.assertIsNotNone(finance_section)
        self.assertTrue(any("с НДС" in line for line in finance_section["items"]))

    def test_report_flags_scope_expansion_and_brake_work_outside_reason(self) -> None:
        repair = self._build_repair(
            works=[
                RepairWork(
                    work_code="1",
                    work_name="БАЗОВЫЙ СЕРВИС",
                    quantity=1.2,
                    standard_hours=1.2,
                    actual_hours=1.2,
                    price=2100,
                    line_total=2268.33,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="2",
                    work_name="ЩЕТКА СТЕКЛООЧИСТИТЕЛЯ ВЕТРОВОГО СТЕКЛА. ЗАМЕНА.",
                    quantity=0.4,
                    standard_hours=0.4,
                    actual_hours=0.4,
                    price=2100,
                    line_total=755.83,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="3",
                    work_name="ТОРМОЗНЫЕ КОЛОДКИ ВЕДУЩЕЙ ОСИ. ЗАМЕНА. КОЛЕСА СНЯТЫ.",
                    quantity=1.8,
                    standard_hours=1.8,
                    actual_hours=1.8,
                    price=2100,
                    line_total=3401.67,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="4",
                    work_name="ТОРМОЗНЫЕ КОЛОДКИ ПЕРЕДНЕГО КОЛЕСА. ЗАМЕНА. БАРАБАН СНЯТ.",
                    quantity=1.8,
                    standard_hours=1.8,
                    actual_hours=1.8,
                    price=2100,
                    line_total=3401.67,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="5",
                    work_name="Продольная рулевая тяга - смена",
                    quantity=2.2,
                    standard_hours=2.2,
                    actual_hours=2.2,
                    price=2100,
                    line_total=4158.33,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="6",
                    work_name="Трубка - компрессор - смена",
                    quantity=1.5,
                    standard_hours=1.5,
                    actual_hours=1.5,
                    price=2100,
                    line_total=2835.0,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="7",
                    work_name="Обтекатель лев. - ремонт",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=2100,
                    line_total=1890.0,
                    status=CatalogStatus.CONFIRMED,
                ),
                RepairWork(
                    work_code="8",
                    work_name="Индукция. слесарные работы.",
                    quantity=1,
                    standard_hours=1.0,
                    actual_hours=1.0,
                    price=2100,
                    line_total=1890.0,
                    status=CatalogStatus.CONFIRMED,
                ),
            ],
            parts=[],
        )
        repair.reason = "ТО основное. Вибрация по кабине. Заменить щетки стеклоочистителей."
        repair.work_total = 20600.83
        repair.grand_total = 20600.83

        report = build_repair_executive_report(
            repair,
            source_payload={},
            manual_review_reason_labels={},
        )

        self.assertTrue(any(item["title"] == "Объем работ шире исходной заявки" for item in report["findings"]))
        self.assertTrue(any(item["title"] == "Тормозные работы не следуют из исходной жалобы" for item in report["findings"]))
        finance_section = next((item for item in report["full_report_sections"] if item["key"] == "financial_risks"), None)
        self.assertIsNotNone(finance_section)
        self.assertTrue(any("6 803,34 ₽" in line for line in finance_section["items"]))


if __name__ == "__main__":
    unittest.main()
