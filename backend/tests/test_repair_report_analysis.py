from __future__ import annotations

import unittest
from datetime import date

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


if __name__ == "__main__":
    unittest.main()
