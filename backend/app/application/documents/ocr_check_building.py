from __future__ import annotations

from app.application.documents import ocr_checks_access
from app.models.enums import CheckSeverity


def build_document_ocr_checks(
    db,
    *,
    repair,
    extracted_fields: dict,
    extracted_items: dict,
    manual_review_reasons: list,
) -> list[dict]:
    checks = []
    checks.extend(ocr_checks_access.build_dynamic_work_reference_checks(db, repair, extracted_items["works"]))

    if "plate_number" in extracted_fields and repair.vehicle.plate_number:
        extracted_plate_compare = ocr_checks_access.normalize_plate_compare_token(str(extracted_fields["plate_number"]))
        vehicle_plate_compare = ocr_checks_access.normalize_plate_compare_token(repair.vehicle.plate_number)
        if extracted_plate_compare and vehicle_plate_compare and extracted_plate_compare != vehicle_plate_compare:
            checks.append(
                {
                    "check_type": "ocr_vehicle_plate_mismatch",
                    "severity": CheckSeverity.WARNING,
                    "title": "Госномер в документе не совпадает с карточкой техники",
                    "details": (
                        f"В документе найден {extracted_fields['plate_number']}, "
                        f"в системе {repair.vehicle.plate_number}"
                    ),
                    "payload": {
                        "document_plate_number": extracted_fields["plate_number"],
                        "vehicle_plate_number": repair.vehicle.plate_number,
                    },
                }
            )

    works_sum = round(sum(float(item["line_total"]) for item in extracted_items["works"]), 2)
    parts_sum = round(sum(float(item["line_total"]) for item in extracted_items["parts"]), 2)
    checks.extend(ocr_checks_access.build_standard_hours_checks(extracted_items["works"]))
    checks.extend(ocr_checks_access.build_repeat_repair_checks(db, repair, extracted_items["works"]))
    checks.extend(ocr_checks_access.build_duplicate_line_checks(extracted_items["works"], extracted_items["parts"]))
    expected_total, expected_total_checks = ocr_checks_access.build_expected_total_checks(db, repair, extracted_items["works"])
    repair.expected_total = expected_total
    checks.extend(expected_total_checks)

    if extracted_items["works"] and "work_total" in extracted_fields:
        if not ocr_checks_access.amounts_match(works_sum, float(extracted_fields["work_total"])):
            checks.append(
                {
                    "check_type": "ocr_work_lines_total_mismatch",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Сумма строк работ не совпадает с итогом работ",
                    "details": "Нужна ручная проверка работ в заказ-наряде",
                    "payload": {
                        "lines_total": works_sum,
                        "header_total": float(extracted_fields["work_total"]),
                    },
                }
            )

    if extracted_items["parts"] and "parts_total" in extracted_fields:
        if not ocr_checks_access.amounts_match(parts_sum, float(extracted_fields["parts_total"])):
            checks.append(
                {
                    "check_type": "ocr_part_lines_total_mismatch",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Сумма строк запчастей не совпадает с итогом материалов",
                    "details": "Нужна ручная проверка состава материалов",
                    "payload": {
                        "lines_total": parts_sum,
                        "header_total": float(extracted_fields["parts_total"]),
                    },
                }
            )

    if "grand_total" in extracted_fields:
        work_total = float(extracted_fields.get("work_total", 0) or 0)
        parts_total = float(extracted_fields.get("parts_total", 0) or 0)
        vat_total = float(extracted_fields.get("vat_total", 0) or 0)
        grand_total = float(extracted_fields["grand_total"])
        calculated_total = round(work_total + parts_total, 2)
        calculated_total_with_vat = round(calculated_total + vat_total, 2)
        if not ocr_checks_access.amounts_match(calculated_total, grand_total) and not ocr_checks_access.amounts_match(
            calculated_total_with_vat,
            grand_total,
        ):
            checks.append(
                {
                    "check_type": "ocr_total_mismatch",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Сумма строк не совпадает с итоговой суммой",
                    "details": "Нужна ручная проверка итогов заказ-наряда",
                    "payload": {
                        "work_total": work_total,
                        "parts_total": parts_total,
                        "vat_total": vat_total,
                        "calculated_total": calculated_total,
                        "calculated_total_with_vat": calculated_total_with_vat,
                        "grand_total": grand_total,
                    },
                }
            )

    for reason in manual_review_reasons:
        checks.append(ocr_checks_access.build_manual_review_check(reason, extracted_fields=extracted_fields))

    return checks
