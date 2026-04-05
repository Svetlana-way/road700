from __future__ import annotations

from collections import defaultdict
import re
from typing import Iterable, Optional

from app.models.enums import CheckSeverity
from app.models.repair import Repair, RepairCheck
from app.services.document_repair_relations import get_repair_source_document


SECTION_ZONE_LABELS = {
    "catalogs": "Справочники и идентификация",
    "labor_norms": "Нормо-часы",
    "amounts": "Суммы и структура",
    "history": "История и аномалии",
    "ocr": "Документ и OCR",
}
SEVERITY_LEVELS = {
    "error": "high",
    "suspicious": "high",
    "warning": "medium",
    "normal": "low",
}
LEVEL_ORDER = {"low": 0, "medium": 1, "high": 2}
LEVEL_LABELS = {"low": "низкий", "medium": "средний", "high": "высокий"}
FINDING_TITLE_PRIORITY = {
    "По заявленной вибрации проблема не подтверждена": 0,
    "Моторное масло требует проверки на соответствие Volvo": 1,
    "Тормозные работы не следуют из исходной жалобы": 2,
    "Объем работ шире исходной заявки": 3,
    "Сервис сам зафиксировал нерешённые замечания": 4,
    "Есть работы с недостаточно прозрачными формулировками": 5,
    "Дорогая запчасть слабо связана с причиной обращения": 6,
    "Есть признаки неоригинальных или восстановленных запчастей": 7,
    "Документ содержит отметку об Exchange Program": 8,
    "Часть документа была восстановлена эвристически": 9,
}
CATEGORY_PRIORITY = {
    "Соответствие дефекта и ремонта": 0,
    "Суммы и структура": 1,
    "Прозрачность ремонта": 2,
    "Состав ремонта": 3,
    "Документ и OCR": 4,
    "Сопоставление с историей": 5,
    "Повторяемость ремонтов": 6,
    "Нормо-часы": 7,
}
REASON_SIGNAL_RULES = [
    {
        "label": "ABS",
        "symptoms": ("abs", "абс"),
        "repair_terms": ("abs", "абс", "датчик", "модулятор", "проводк", "блок abs"),
    },
    {
        "label": "пневматика",
        "symptoms": ("утечк", "воздух", "пневм", "компрессор"),
        "repair_terms": ("утечк", "воздух", "пневм", "компрессор", "трубк", "шланг", "клапан"),
    },
    {
        "label": "тормозная система",
        "symptoms": ("тормоз", "колод", "суппорт", "диск"),
        "repair_terms": ("тормоз", "колод", "суппорт", "диск"),
    },
]
BRAKE_TERMS = ("тормоз", "колод", "суппорт", "диск")
PART_WORK_ALIGNMENT_RULES = [
    {
        "label": "фонарь",
        "reason_terms": ("фонар",),
        "part_terms": ("фонар",),
        "work_terms": ("фонар",),
    },
]
WORK_CLUSTER_RULES = [
    {
        "label": "ТО и обслуживание",
        "terms": ("то", "техобслуж", "обслужив", "масл", "фильтр", "смазк"),
    },
    {
        "label": "Тормозная система",
        "terms": ("тормоз", "колод", "суппорт", "диск"),
    },
    {
        "label": "Рулевое управление",
        "terms": ("рулев", "тяга", "наконечник"),
    },
    {
        "label": "Пневмосистема",
        "terms": ("пневм", "воздух", "компрессор", "клапан", "шланг", "ресивер"),
    },
    {
        "label": "Электрика",
        "terms": ("электр", "провод", "разъем", "датчик", "генератор", "стартер", "фонар"),
    },
    {
        "label": "Кузов и кабина",
        "terms": ("крыл", "двер", "кабин", "обтекател", "бампер", "стекл", "зеркал"),
    },
    {
        "label": "Диагностика",
        "terms": ("диагност", "tech tool", "тех тул", "скан", "компьютер"),
    },
]
AMBIGUOUS_WORK_TERMS = (
    "слесарн",
    "доработк",
    "индукц",
    "обтекател",
    "сопутств",
    "проч",
    "адаптац",
    "подгонк",
)
NON_ORIGINAL_PART_TERMS = (
    "аналог",
    "exchange",
    "reman",
    "восстанов",
)
VOLVO_FAMILY_TERMS = ("volvo", "fh", "fm")
SUSPICIOUS_OIL_TERMS = ("dongfeng", "diesel ultra cs")


def build_repair_executive_report(
    repair: Repair,
    *,
    source_payload: dict,
    manual_review_reason_labels: dict[str, str],
) -> dict[str, object]:
    findings: list[dict[str, object]] = []
    seen_findings: set[tuple[object, ...]] = set()

    for finding in _build_check_findings(repair.checks):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_reason_gap_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_part_work_alignment_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_unresolved_symptom_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_oil_compatibility_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_scope_expansion_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_out_of_scope_brake_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_reason_quality_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_diagnostics_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_expensive_part_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_ambiguous_work_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_non_original_part_findings(repair):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_document_quality_findings(repair, source_payload, manual_review_reason_labels):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_document_program_findings(source_payload):
        _append_finding(findings, seen_findings, finding)

    for finding in _build_service_not_done_findings(source_payload):
        _append_finding(findings, seen_findings, finding)

    findings.sort(key=_finding_sort_key)

    overall_risk = "low"
    if findings:
        overall_risk = max((str(item["severity"]) for item in findings), key=lambda value: LEVEL_ORDER[value])

    highlights = _build_highlights(repair, findings)
    recommendations = _collect_recommendations(findings)
    risk_matrix = _build_risk_matrix(findings)
    headline, summary = _build_summary(repair, findings, overall_risk)
    full_report_sections = _build_full_report_sections(repair, findings, recommendations, overall_risk)

    return {
        "headline": headline,
        "summary": summary,
        "status": LEVEL_LABELS[overall_risk],
        "overall_risk": overall_risk,
        "highlights": highlights,
        "findings": findings,
        "risk_matrix": risk_matrix,
        "recommendations": recommendations,
        "full_report_sections": full_report_sections,
    }


def _append_finding(
    findings: list[dict[str, object]],
    seen_findings: set[tuple[object, ...]],
    finding: dict[str, object],
) -> None:
    fingerprint = _build_finding_fingerprint(finding)
    if fingerprint in seen_findings:
        return
    seen_findings.add(fingerprint)
    findings.append(finding)


def _build_finding_fingerprint(finding: dict[str, object]) -> tuple[object, ...]:
    evidence = finding.get("evidence")
    evidence_items = tuple(str(item) for item in evidence) if isinstance(evidence, list) else ()
    return (
        str(finding.get("title", "")),
        str(finding.get("severity", "")),
        str(finding.get("category", "")),
        str(finding.get("summary", "")),
        str(finding.get("rationale", "")),
        evidence_items,
        str(finding.get("recommendation", "")),
    )


def _build_check_findings(checks: Iterable[RepairCheck]) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    for check in sorted(checks, key=lambda item: (item.is_resolved, item.created_at, item.id)):
        if check.is_resolved:
            continue
        custom_finding = _build_custom_check_finding(check)
        if custom_finding is not None:
            findings.append(custom_finding)
            continue
        severity = SEVERITY_LEVELS.get(check.severity.value, "medium")
        category = SECTION_ZONE_LABELS[_get_check_zone_key(check.check_type)]
        findings.append(
            {
                "title": check.title,
                "severity": severity,
                "category": category,
                "summary": check.details or "Выявлено несоответствие, требующее ручной проверки.",
                "rationale": _build_check_rationale(check),
                "evidence": _build_check_evidence(check),
                "recommendation": _recommendation_for_check(check.check_type),
            }
        )
    return findings


def _build_custom_check_finding(check: RepairCheck) -> dict[str, object] | None:
    payload = check.calculation_payload if isinstance(check.calculation_payload, dict) else {}

    if check.check_type == "ocr_expected_total_exceeded":
        expected_total = payload.get("expected_total")
        actual_total = payload.get("actual_total")
        return {
            "title": "Стоимость ремонта выше ожидаемой по истории",
            "severity": "high",
            "category": "Сопоставление с историей",
            "summary": "Итоговая стоимость ремонта заметно превышает ориентир по истории аналогичных работ.",
            "rationale": "Это может быть нормальным только при наличии понятного объяснения по составу работ, пробегу или сервису.",
            "evidence": [
                check.details or "Обнаружено превышение ожидаемой стоимости.",
                f"Фактическая сумма: {_format_money(float(actual_total))}" if isinstance(actual_total, (int, float)) else "",
                f"Ожидаемая сумма: {_format_money(float(expected_total))}" if isinstance(expected_total, (int, float)) else "",
            ],
            "recommendation": "Запросить расшифровку, за счет каких строк стоимость вышла выше исторического ориентира.",
        }

    if check.check_type == "ocr_work_reference_price_deviation":
        current_price = payload.get("current_price")
        median_price = payload.get("median_price")
        source_label = payload.get("comparison_source_label")
        return {
            "title": "Цена работы отклоняется от накопленной практики",
            "severity": SEVERITY_LEVELS.get(check.severity.value, "medium"),
            "category": "Сопоставление с историей",
            "summary": "По конкретной работе цена заметно отличается от медианы по накопленной базе аналогичных ремонтов.",
            "rationale": "Такой сигнал полезен для выявления завышения, нетипичного тарифа или ошибки в смете.",
            "evidence": [
                check.details or "",
                f"Текущая цена: {_format_money(float(current_price))}" if isinstance(current_price, (int, float)) else "",
                f"Медианная цена: {_format_money(float(median_price))}" if isinstance(median_price, (int, float)) else "",
                f"Источник сравнения: {source_label}" if isinstance(source_label, str) and source_label else "",
            ],
            "recommendation": "Проверить, чем сервис обосновывает отклонение цены по этой работе относительно накопленной практики.",
        }

    if check.check_type == "ocr_repeat_repair_detected":
        previous_order_number = payload.get("previous_order_number")
        previous_repair_date = payload.get("previous_repair_date")
        days_since_previous = payload.get("days_since_previous")
        return {
            "title": "Выявлен повторный ремонт по той же работе",
            "severity": "high",
            "category": "Повторяемость ремонтов",
            "summary": "По этой машине уже был похожий ремонт в недавнем прошлом, что повышает риск неустраненной первопричины.",
            "rationale": "Для парка это один из ключевых сигналов: повторяемость обычно говорит о слабой диагностике, низком качестве ремонта или неправильной эксплуатации.",
            "evidence": [
                check.details or "",
                f"Предыдущий заказ-наряд: {previous_order_number}" if isinstance(previous_order_number, str) and previous_order_number else "",
                f"Дата прошлого ремонта: {previous_repair_date}" if isinstance(previous_repair_date, str) and previous_repair_date else "",
                f"Интервал между ремонтами: {days_since_previous} дн." if isinstance(days_since_previous, int) else "",
            ],
            "recommendation": "Поднять предыдущий заказ-наряд и проверить, была ли устранена причина первого ремонта или проблема повторяется.",
        }

    if check.check_type in {"ocr_duplicate_work_lines", "ocr_duplicate_part_lines"}:
        duplicate_count = payload.get("duplicate_count")
        return {
            "title": "Есть признаки задвоения строк в заказ-наряде",
            "severity": "high",
            "category": "Суммы и структура",
            "summary": "Система нашла повторяющиеся строки работ или запчастей с одинаковыми параметрами.",
            "rationale": "Это типичный источник переплаты или ошибки при составлении заказ-наряда.",
            "evidence": [
                check.details or "",
                f"Совпадающих строк: {duplicate_count}" if isinstance(duplicate_count, int) else "",
            ],
            "recommendation": "Проверить, не включены ли в счет одни и те же позиции повторно.",
        }

    if check.check_type == "ocr_work_reference_mileage_outlier":
        repair_mileage = payload.get("repair_mileage")
        min_mileage = payload.get("min_mileage")
        max_mileage = payload.get("max_mileage")
        return {
            "title": "Работа нетипична для текущего пробега",
            "severity": "medium",
            "category": "Сопоставление с историей",
            "summary": "Для такой работы пробег машины выглядит нетипичным относительно накопленной практики.",
            "rationale": "Это не означает ошибку автоматически, но требует проверки: работа могла быть навязана, ошибочно классифицирована или связана с иным дефектом.",
            "evidence": [
                check.details or "",
                f"Пробег в ремонте: {repair_mileage} км" if isinstance(repair_mileage, int) else "",
                (
                    f"Исторический диапазон: {min_mileage}-{max_mileage} км"
                    if isinstance(min_mileage, int) and isinstance(max_mileage, int)
                    else ""
                ),
            ],
            "recommendation": "Уточнить, почему работа выполнена на этом пробеге и есть ли подтверждающая дефектовка.",
        }

    if check.check_type == "ocr_work_reference_missing":
        return {
            "title": "Работа не подтверждается накопленной практикой",
            "severity": "medium",
            "category": "Сопоставление с историей",
            "summary": "Для этой работы в системе пока нет подтвержденной истории, на которую можно опереться при проверке.",
            "rationale": "Такие позиции требуют повышенного внимания, особенно если они дорогие или слабо связаны с причиной обращения.",
            "evidence": [check.details or ""],
            "recommendation": "Проверить работу вручную и по возможности пополнить справочник подтвержденных операций после закрытия ремонта.",
        }

    if check.check_type in {"ocr_work_lines_total_mismatch", "ocr_part_lines_total_mismatch"}:
        lines_total = payload.get("lines_total")
        header_total = payload.get("header_total")
        line_kind = "работ" if check.check_type == "ocr_work_lines_total_mismatch" else "материалов"
        ratio_text = ""
        if isinstance(lines_total, (int, float)) and isinstance(header_total, (int, float)) and float(header_total) > 0:
            ratio = round((float(lines_total) / float(header_total)) * 100)
            ratio_text = f"Распознано примерно {ratio}% от итога по шапке."
        return {
            "title": f"Табличная часть {line_kind} распознана неполно",
            "severity": "high" if check.severity == CheckSeverity.SUSPICIOUS else SEVERITY_LEVELS.get(check.severity.value, "medium"),
            "category": "Документ и OCR",
            "summary": (
                f"Сумма распознанных строк {line_kind} не сходится с итогом документа, "
                "поэтому часть анализа по составу ремонта может быть неполной."
            ),
            "rationale": (
                "При таком расхождении нельзя считать табличную часть надежно разобранной: "
                "часть строк могла быть потеряна, склеена OCR или неверно распределена по позициям."
            ),
            "evidence": [
                check.details or "",
                f"Сумма распознанных строк: {_format_money(float(lines_total))}" if isinstance(lines_total, (int, float)) else "",
                f"Итог по шапке: {_format_money(float(header_total))}" if isinstance(header_total, (int, float)) else "",
                ratio_text,
            ],
            "recommendation": (
                "Запросить более качественный PDF или проверить табличную часть вручную, "
                "потому что текущий OCR-разбор не покрывает весь состав документа."
            ),
        }

    if check.check_type == "ocr_total_mismatch":
        calculated_total = payload.get("calculated_total")
        calculated_total_with_vat = payload.get("calculated_total_with_vat")
        grand_total = payload.get("grand_total")
        return {
            "title": "Итоги документа не сходятся после OCR-разбора",
            "severity": "high",
            "category": "Документ и OCR",
            "summary": "Итоговая сумма заказ-наряда не подтверждается автоматически рассчитанной суммой по распознанным полям.",
            "rationale": "Обычно это означает ошибку OCR в шапке или неполный разбор строк работ и материалов.",
            "evidence": [
                check.details or "",
                (
                    f"Работы + материалы: {_format_money(float(calculated_total))}"
                    if isinstance(calculated_total, (int, float))
                    else ""
                ),
                (
                    f"Работы + материалы + НДС: {_format_money(float(calculated_total_with_vat))}"
                    if isinstance(calculated_total_with_vat, (int, float))
                    else ""
                ),
                f"Итог документа: {_format_money(float(grand_total))}" if isinstance(grand_total, (int, float)) else "",
            ],
            "recommendation": "Перепроверить шапку документа и суммы строк вручную до использования отчёта как основания для управленческого решения.",
        }

    return None


def _build_reason_gap_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(" ".join(filter(None, [repair.reason, repair.employee_comment])))
    if not reason_text:
        return []

    work_text = _normalize_text(" ".join(item.work_name for item in repair.works))
    part_text = _normalize_text(" ".join(item.part_name for item in repair.parts))
    findings: list[dict[str, object]] = []

    for rule in REASON_SIGNAL_RULES:
        if not _contains_any(reason_text, rule["symptoms"]):
            continue
        if _contains_any(work_text, rule["repair_terms"]) or _contains_any(part_text, rule["repair_terms"]):
            continue
        findings.append(
            {
                "title": f"Нет прозрачного ремонта по зоне «{rule['label']}»",
                "severity": "high" if rule["label"] == "ABS" else "medium",
                "category": "Соответствие дефекта и ремонта",
                "summary": (
                    "В описании обращения есть проблема по конкретной системе, "
                    "но в заказ-наряде не видно прямых работ по ее устранению."
                ),
                "rationale": "Есть риск формального закрытия обращения диагностикой или сопутствующими работами.",
                "evidence": [
                    f"Описание обращения: {repair.reason or repair.employee_comment or 'не указано'}",
                    (
                        "Работы в заказ-наряде: "
                        + ", ".join(item.work_name for item in repair.works[:6])
                        if repair.works
                        else "Работы по этой зоне не выделены."
                    ),
                ],
                "recommendation": (
                    f"Запросить у сервиса расшифровку, какие действия по зоне «{rule['label']}» были выполнены "
                    "и чем подтверждено устранение неисправности."
                ),
            }
        )
    return findings


def _build_reason_quality_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(repair.reason or "")
    if not reason_text:
        return []

    if "проч" not in reason_text:
        return []

    return [
        {
            "title": "Причина ремонта оформлена слишком размыто",
            "severity": "medium",
            "category": "Прозрачность ремонта",
            "summary": "Заказ-наряд закрыт с общей формулировкой причины, что ухудшает управляемость и претензионную работу.",
            "rationale": "При формулировке вроде «прочее» сложно доказать, какой именно дефект должен был быть устранен.",
            "evidence": [f"Причина ремонта: {repair.reason or 'не указана'}"],
            "recommendation": "Ввести правило: не закрывать заказ-наряды с причиной «прочее» без расшифровки конкретного дефекта.",
        }
    ]


def _build_unresolved_symptom_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(repair.reason or "")
    comment_text = _normalize_text(repair.employee_comment or "")
    if not reason_text or not comment_text:
        return []

    findings: list[dict[str, object]] = []
    if "вибрац" in reason_text and "вибрац" in comment_text and "не обнаруж" in comment_text:
        findings.append(
            {
                "title": "По заявленной вибрации проблема не подтверждена",
                "severity": "high",
                "category": "Соответствие дефекта и ремонта",
                "summary": "В причине обращения указана вибрация, но в рекомендациях сервиса зафиксировано, что неисправность на осмотре не обнаружена.",
                "rationale": "Для управленческого контроля это критично: деньги потрачены, а ключевой дефект документально не подтвержден как устраненный.",
                "evidence": [
                    f"Причина обращения: {_truncate_text(repair.reason or 'не указана', 220)}",
                    f"Рекомендации сервиса: {_truncate_text(repair.employee_comment or 'не указаны', 220)}",
                ],
                "recommendation": "Запросить у сервиса пояснение, какие действия были выполнены по вибрации и почему проблема отражена как не обнаруженная.",
            }
        )

    return findings


def _build_oil_compatibility_findings(repair: Repair) -> list[dict[str, object]]:
    suspicious_oils = _collect_suspicious_oil_parts(repair)
    if not suspicious_oils:
        return []

    total = sum(float(item.line_total or 0) for item in suspicious_oils)
    return [
        {
            "title": "Моторное масло требует проверки на соответствие Volvo",
            "severity": "high",
            "category": "Состав ремонта",
            "summary": "В заказ-наряде для техники семейства Volvo/FH указано моторное масло DONGFENG. Нужно отдельно подтвердить соответствие спецификации двигателя.",
            "rationale": "Для управленческого контроля это критично, потому что неподходящее масло влияет на ресурс двигателя и может стать предметом претензии к сервису.",
            "evidence": [
                f"Техника: {_truncate_text(' '.join(filter(None, [_get_vehicle_attr(repair, 'brand'), _get_vehicle_attr(repair, 'model')])), 120)}",
                "Масло: " + ", ".join(item.part_name for item in suspicious_oils[:2]),
                f"Сумма по строкам масла: {_format_money(total)}",
            ],
            "recommendation": "Запросить у сервиса подтверждение допуска масла для Volvo и отдельно проверить соответствие спецификации уровня VDS-4/VDS-4.5.",
        }
    ]


def _build_scope_expansion_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(repair.reason or "")
    if not reason_text or len(repair.works) < 8:
        return []

    grouped_works = [bucket for bucket in _group_work_buckets(repair) if float(bucket["total"]) > 0]
    dominant_buckets = [bucket for bucket in grouped_works if bucket["label"] != "Прочие работы"]
    if len(dominant_buckets) < 3:
        return []

    top_scope = "; ".join(
        f"{bucket['label']} ({bucket['count']} строк)"
        for bucket in dominant_buckets[:4]
    )
    return [
        {
            "title": "Объем работ шире исходной заявки",
            "severity": "medium",
            "category": "Соответствие дефекта и ремонта",
            "summary": "Состав заказ-наряда охватывает несколько ремонтных зон и выглядит заметно шире кратко описанной причины обращения.",
            "rationale": "Такой профиль ремонта не всегда ошибочен, но требует проверки, были ли дополнительные работы согласованы с заказчиком.",
            "evidence": [
                f"Причина обращения: {_truncate_text(repair.reason or 'не указана', 180)}",
                f"Основные зоны работ: {top_scope}",
                f"Всего работ в заказ-наряде: {len(repair.works)}",
            ],
            "recommendation": "Проверить, какие из дополнительных работ были заранее согласованы, а какие появились уже в ходе ремонта.",
        }
    ]


def _build_out_of_scope_brake_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(repair.reason or "")
    if not repair.works or _contains_any(reason_text, BRAKE_TERMS):
        return []

    brake_works = [work for work in repair.works if _contains_any(_normalize_text(work.work_name), BRAKE_TERMS)]
    if not brake_works:
        return []

    brake_total = sum(float(item.line_total or 0) for item in brake_works)
    if brake_total <= 0:
        return []

    return [
        {
            "title": "Тормозные работы не следуют из исходной жалобы",
            "severity": "medium",
            "category": "Соответствие дефекта и ремонта",
            "summary": "В заявке нет явной жалобы на тормозную систему, но в заказ-наряд включены тормозные работы с отдельной стоимостью.",
            "rationale": "Такой блок может быть обоснован дефектовкой, но без отдельного пояснения выглядит как дополнительный объем ремонта вне первоначального обращения.",
            "evidence": [
                f"Причина обращения: {_truncate_text(repair.reason or 'не указана', 180)}",
                "Тормозные работы: " + ", ".join(item.work_name for item in brake_works[:3]),
                f"Сумма тормозных работ: {_format_money(brake_total)}",
            ],
            "recommendation": "Запросить обоснование тормозных работ и подтверждение, что необходимость их выполнения была согласована отдельно.",
        }
    ]


def _build_part_work_alignment_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(" ".join(filter(None, [repair.reason, repair.employee_comment])))
    if not reason_text or not repair.parts:
        return []

    findings: list[dict[str, object]] = []
    for rule in PART_WORK_ALIGNMENT_RULES:
        if not _contains_any(reason_text, rule["reason_terms"]):
            continue

        matched_parts = [
            item.part_name
            for item in repair.parts
            if _contains_any(_normalize_text(item.part_name), rule["part_terms"])
        ]
        if not matched_parts:
            continue

        matched_works = [
            item.work_name
            for item in repair.works
            if _contains_any(_normalize_text(item.work_name), rule["work_terms"])
        ]
        if matched_works:
            continue

        findings.append(
            {
                "title": f"Материал по зоне «{rule['label']}» списан без профильной работы",
                "severity": "high",
                "category": "Состав ремонта",
                "summary": (
                    "В заказ-наряде есть запчасть по заявленному дефекту, "
                    "но среди работ нет явной операции по ее замене или ремонту."
                ),
                "rationale": (
                    "Такое расхождение повышает риск неполного отражения ремонта "
                    "и требует отдельного подтверждения от сервиса."
                ),
                "evidence": [
                    f"Причина обращения: {repair.reason or repair.employee_comment or 'не указана'}",
                    (
                        "Работы в заказ-наряде: "
                        + ", ".join(item.work_name for item in repair.works[:6])
                        if repair.works
                        else "Работы в заказ-наряде отсутствуют."
                    ),
                    f"Материалы по зоне: {', '.join(matched_parts[:4])}",
                ],
                "recommendation": (
                    f"Запросить у сервиса пояснение, почему по зоне «{rule['label']}» списан материал "
                    "без отдельной работы, и при необходимости добавить корректную позицию работ."
                ),
            }
        )

    return findings


def _build_diagnostics_findings(repair: Repair) -> list[dict[str, object]]:
    diagnostic_works = [
        item.work_name
        for item in repair.works
        if _contains_any(_normalize_text(item.work_name), ("диагност", "tech tool", "тех тул", "скан", "компьютер"))
    ]
    if len(diagnostic_works) < 2:
        return []

    return [
        {
            "title": "В заказ-наряде несколько диагностических работ",
            "severity": "medium",
            "category": "Суммы и структура",
            "summary": "Есть риск дублирования диагностики или раздельного биллинга одной и той же операции.",
            "rationale": "Для управленческого контроля такие работы нужно разделять только при явном различии этапов или систем.",
            "evidence": [f"Диагностические позиции: {', '.join(diagnostic_works[:4])}"],
            "recommendation": "Запросить у сервиса, чем отличаются диагностические позиции и почему они тарифицировались отдельно.",
        }
    ]


def _build_expensive_part_findings(repair: Repair) -> list[dict[str, object]]:
    reason_text = _normalize_text(" ".join(filter(None, [repair.reason, repair.employee_comment])))
    if not repair.parts or float(repair.grand_total or 0) <= 0:
        return []

    findings: list[dict[str, object]] = []
    for part in sorted(repair.parts, key=lambda item: float(item.line_total or 0), reverse=True)[:3]:
        part_total = float(part.line_total or 0)
        if part_total <= 0:
            continue
        share = part_total / float(repair.grand_total)
        if share < 0.25:
            continue

        normalized_part_name = _normalize_text(part.part_name)
        related = any(
            _contains_any(reason_text, rule["symptoms"]) and _contains_any(normalized_part_name, rule["repair_terms"])
            for rule in REASON_SIGNAL_RULES
        )
        if related or not reason_text:
            continue

        findings.append(
            {
                "title": "Дорогая запчасть слабо связана с причиной обращения",
                "severity": "medium",
                "category": "Состав ремонта",
                "summary": "В заказ-наряде есть крупная по сумме запчасть, но ее связь с заявленной причиной ремонта неочевидна.",
                "rationale": "Это может быть нормой, но без дефектовки или пояснения от сервиса такой блок выглядит как потенциальная допродажа.",
                "evidence": [
                    f"Причина обращения: {repair.reason or repair.employee_comment or 'не указана'}",
                    f"Запчасть: {part.part_name} · сумма {_format_money(part_total)}",
                    f"Доля в заказ-наряде: {round(share * 100)}%",
                ],
                "recommendation": "Запросить дефектовку или пояснение, почему эта запчасть была заменена именно в рамках данного обращения.",
            }
        )
    return findings


def _build_ambiguous_work_findings(repair: Repair) -> list[dict[str, object]]:
    ambiguous_works = _collect_ambiguous_works(repair)
    if not ambiguous_works:
        return []

    ambiguous_total = sum(float(item.line_total or 0) for item in ambiguous_works)
    return [
        {
            "title": "Есть работы с недостаточно прозрачными формулировками",
            "severity": "medium",
            "category": "Прозрачность ремонта",
            "summary": "В заказ-наряде есть позиции, по которым без расшифровки сложно понять фактический объем и цель выполненных действий.",
            "rationale": "Такие строки затрудняют управленческую проверку и повышают риск спорного биллинга.",
            "evidence": [
                "Позиции: " + ", ".join(item.work_name for item in ambiguous_works[:4]),
                f"Сумма по этим строкам: {_format_money(ambiguous_total)}",
            ],
            "recommendation": "Запросить у сервиса расшифровку спорных формулировок и подтверждение объема каждой такой работы.",
        }
    ]


def _build_non_original_part_findings(repair: Repair) -> list[dict[str, object]]:
    matched_parts = [
        item
        for item in repair.parts
        if _contains_any(_normalize_text(item.part_name), NON_ORIGINAL_PART_TERMS)
    ]
    matched_works = [
        item
        for item in repair.works
        if _contains_any(_normalize_text(item.work_name), NON_ORIGINAL_PART_TERMS)
    ]
    if not matched_parts and not matched_works:
        return []

    parts_total = sum(float(item.line_total or 0) for item in matched_parts)
    works_total = sum(float(item.line_total or 0) for item in matched_works)
    evidence: list[str] = []
    if matched_parts:
        evidence.append("Запчасти: " + ", ".join(item.part_name for item in matched_parts[:4]))
    if matched_works:
        evidence.append("Работы: " + ", ".join(item.work_name for item in matched_works[:4]))
    evidence.append(f"Сумма по этим строкам: {_format_money(parts_total + works_total)}")
    return [
        {
            "title": "Есть признаки неоригинальных или восстановленных запчастей",
            "severity": "medium",
            "category": "Состав ремонта",
            "summary": "В наименованиях запчастей есть маркеры, указывающие на аналоговые или восстановленные комплектующие.",
            "rationale": "Это не всегда нарушение, но такой состав ремонта должен быть явно согласован и прозрачно отражен в заказ-наряде.",
            "evidence": evidence,
            "recommendation": "Зафиксировать в карточке ремонта статус этих запчастей и проверить, были ли они согласованы до установки.",
        }
    ]


def _build_document_quality_findings(
    repair: Repair,
    source_payload: dict,
    manual_review_reason_labels: dict[str, str],
) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    document = get_repair_source_document(repair)
    manual_review_reasons = source_payload.get("manual_review_reasons")
    reason_codes = [str(item) for item in manual_review_reasons] if isinstance(manual_review_reasons, list) else []
    labeled_reasons = [manual_review_reason_labels.get(item, item) for item in reason_codes]
    normalization_notes_raw = source_payload.get("normalization_notes")
    normalization_notes = [str(item) for item in normalization_notes_raw] if isinstance(normalization_notes_raw, list) else []
    restoration_signals = _collect_document_restoration_signals(normalization_notes)

    if document is not None and (document.ocr_confidence or 0) < 0.75 and document.ocr_confidence is not None:
        findings.append(
            {
                "title": "Низкая уверенность OCR по основному документу",
                "severity": "medium",
                "category": "Документ и OCR",
                "summary": "Распознавание прошло с пониженной уверенностью, поэтому часть выводов требует дополнительной ручной проверки.",
                "rationale": "Чем хуже исходный документ, тем выше риск ошибок в шапке, суммах и составе работ.",
                "evidence": [f"OCR confidence: {round(document.ocr_confidence * 100)}%"],
                "recommendation": "Проверить ключевые поля вручную и запросить у сервиса более качественную копию документа при необходимости.",
            }
        )

    if reason_codes:
        findings.append(
            {
                "title": "Документ содержит признаки неполного или спорного распознавания",
                "severity": "medium" if any(item in {"text_not_found", "repair_date_invalid"} for item in reason_codes) else "low",
                "category": "Документ и OCR",
                "summary": "Часть полей система не смогла уверенно извлечь автоматически.",
                "rationale": "Это повышает риск ручных правок и управленческих ошибок при закрытии ремонта.",
                "evidence": [f"Причины ручной проверки: {', '.join(labeled_reasons[:5])}"],
                "recommendation": "До подтверждения ремонта проверить вручную все поля, отмеченные системой как спорные или отсутствующие.",
            }
        )

    if restoration_signals:
        high_impact_restoration = any(
            marker in note
            for note in normalization_notes
            for marker in ("_items_restored_from_", "_totals_restored_from_", "_total_restored_from_", "_derived_from_")
        )
        findings.append(
            {
                "title": "Часть документа была восстановлена эвристически",
                "severity": "medium" if high_impact_restoration else "low",
                "category": "Документ и OCR",
                "summary": "Система собирала часть строк или итогов не напрямую из исходной структуры, а через восстановление по другим блокам документа.",
                "rationale": "Это не означает ошибку автоматически, но снижает прозрачность OCR-разбора и повышает важность ручной сверки ключевых сумм и спорных строк.",
                "evidence": restoration_signals[:4],
                "recommendation": "Перед использованием отчёта для управленческого решения вручную сверить восстановленные суммы и ключевые строки документа.",
            }
        )

    return findings


def _build_document_program_findings(source_payload: dict) -> list[dict[str, object]]:
    notes = source_payload.get("normalization_notes")
    normalization_notes = [str(item) for item in notes] if isinstance(notes, list) else []
    if "exchange_program_present" not in normalization_notes:
        return []

    return [
        {
            "title": "Документ содержит отметку об Exchange Program",
            "severity": "medium",
            "category": "Состав ремонта",
            "summary": "В тексте заказ-наряда есть оговорка об Exchange Program, то есть документ допускает использование восстановленных запасных частей.",
            "rationale": "Для управленческого контроля это важно: такая замена должна быть понятна и согласована до закрытия ремонта.",
            "evidence": ["В тексте документа найдена отметка об Exchange Program."],
            "recommendation": "Проверить, какие именно узлы или запчасти были поставлены по схеме Exchange Program и было ли это согласовано.",
        }
    ]


def _build_service_not_done_findings(source_payload: dict) -> list[dict[str, object]]:
    raw_items = source_payload.get("service_not_done")
    items = [str(item) for item in raw_items] if isinstance(raw_items, list) else []
    if not items:
        return []

    return [
        {
            "title": "Сервис сам зафиксировал нерешённые замечания",
            "severity": "medium",
            "category": "Соответствие дефекта и ремонта",
            "summary": "В документе есть блок «НЕ ДЕЛАЕМ», то есть сервис прямо указал работы или замечания, которые остались вне выполненного ремонта.",
            "rationale": "Для управленческого контроля это важно: часть технических замечаний документально перенесена на будущее и не вошла в текущий результат ремонта.",
            "evidence": [f"НЕ ДЕЛАЕМ: {', '.join(items[:3])}"],
            "recommendation": "Проверить, какие замечания из блока «НЕ ДЕЛАЕМ» критичны для эксплуатации и нужно ли оформлять их отдельным согласованием.",
        }
    ]


def _build_summary(
    repair: Repair,
    findings: list[dict[str, object]],
    overall_risk: str,
) -> tuple[str, str]:
    order_ref = repair.order_number or f"#{repair.id}"
    total = _format_money(float(repair.grand_total))
    findings_count = len(findings)

    if not findings:
        return (
            "Серьезных управленческих рисков не найдено",
            f"Заказ-наряд {order_ref} на сумму {total} проверен. Критичных несоответствий, требующих отдельного контроля, не выявлено.",
        )

    risk_label = LEVEL_LABELS[overall_risk]
    return (
        "Есть сигналы для управленческого контроля",
        f"Заказ-наряд {order_ref} на сумму {total} содержит {findings_count} значимых сигналов. Общий уровень риска: {risk_label}.",
    )


def _build_full_report_sections(
    repair: Repair,
    findings: list[dict[str, object]],
    recommendations: list[str],
    overall_risk: str,
) -> list[dict[str, object]]:
    sections = [
        _build_finance_section(repair),
        _build_work_scope_section(repair),
        _build_findings_section(findings),
        _build_financial_risk_section(repair, findings),
        _build_norm_hours_section(repair, findings),
        _build_logic_section(repair, findings),
        _build_conclusion_section(repair, findings, overall_risk),
        _build_recommendations_section(recommendations),
    ]
    return [section for section in sections if section["items"]]


def _build_finance_section(repair: Repair) -> dict[str, object]:
    has_vat = float(repair.vat_total or 0) > 0
    items = [
        (
            f"Работы без НДС: {_format_money(float(repair.work_total or 0))}."
            if has_vat
            else f"Работы: {_format_money(float(repair.work_total or 0))}."
        ),
        (
            f"Запчасти и материалы без НДС: {_format_money(float(repair.parts_total or 0))}."
            if has_vat
            else f"Запчасти и материалы: {_format_money(float(repair.parts_total or 0))}."
        ),
        f"НДС: {_format_money(float(repair.vat_total or 0))}.",
        (
            f"Итого по заказ-наряду с НДС: {_format_money(float(repair.grand_total or 0))}."
            if has_vat
            else f"Итого по заказ-наряду: {_format_money(float(repair.grand_total or 0))}."
        ),
    ]

    calculated_total = float(repair.work_total or 0) + float(repair.parts_total or 0) + float(repair.vat_total or 0)
    if abs(calculated_total - float(repair.grand_total or 0)) <= 1:
        items.append("Арифметика по шапке документа сходится.")
    else:
        items.append(
            "Арифметика по шапке документа не сходится: "
            f"работы + материалы + НДС дают {_format_money(calculated_total)}."
        )

    if repair.expected_total is not None:
        delta = float(repair.grand_total or 0) - float(repair.expected_total)
        sign = "+" if delta >= 0 else ""
        items.append(
            "Отклонение от ожидаемой суммы: "
            f"{sign}{_format_money(delta)} при ориентире {_format_money(float(repair.expected_total))}."
        )

    return {
        "key": "finance",
        "title": "1. Финансы",
        "items": items,
    }


def _build_work_scope_section(repair: Repair) -> dict[str, object]:
    items = [
        f"В заказ-наряде отражено {len(repair.works)} работ и {len(repair.parts)} запчастей.",
    ]

    if repair.reason or repair.employee_comment:
        items.append(f"Заявленная причина обращения: {_truncate_text(repair.reason or repair.employee_comment, 260)}.")

    grouped_works = _group_work_buckets(repair)
    if grouped_works:
        summary = "; ".join(
            f"{bucket['label']} ({bucket['count']} строк, {_format_money(bucket['total'])})"
            for bucket in grouped_works[:4]
        )
        items.append(f"Основной состав работ: {summary}.")
    elif repair.works:
        items.append(
            "Основные работы: "
            + ", ".join(item.work_name for item in sorted(repair.works, key=lambda value: float(value.line_total or 0), reverse=True)[:4])
            + "."
        )

    if repair.parts:
        top_parts = sorted(repair.parts, key=lambda item: float(item.line_total or 0), reverse=True)[:3]
        parts_summary = "; ".join(f"{item.part_name} ({_format_money(float(item.line_total or 0))})" for item in top_parts)
        items.append(f"Крупнейшие позиции по запчастям: {parts_summary}.")

    return {
        "key": "work_scope",
        "title": "2. Что фактически сделано",
        "items": items,
    }


def _build_findings_section(findings: list[dict[str, object]]) -> dict[str, object]:
    ordered_findings = sorted(findings, key=_finding_sort_key)
    if not ordered_findings:
        items = ["Критичных и средних замечаний по данным автоматической проверки не выявлено."]
    else:
        items = [
            f"{item['title']}: {item['summary']}"
            for item in ordered_findings[:6]
        ]

    return {
        "key": "critical_findings",
        "title": "3. Критические проблемы",
        "items": items,
    }


def _build_financial_risk_section(repair: Repair, findings: list[dict[str, object]]) -> dict[str, object]:
    items, suspicious_total = _collect_financial_risk_items(repair, findings)
    if suspicious_total > 0:
        gross_total = _estimate_gross_risk_total(repair, suspicious_total)
        if gross_total > suspicious_total:
            items.insert(
                0,
                "По прямым сигналам объём спорных затрат оценивается до "
                f"{_format_money(suspicious_total)} без НДС, или примерно {_format_money(gross_total)} с НДС.",
            )
        else:
            items.insert(0, f"По прямым сигналам объём спорных затрат оценивается до {_format_money(suspicious_total)}.")
    if not items:
        items = ["Прямых финансовых сигналов с понятной суммой система не нашла."]

    return {
        "key": "financial_risks",
        "title": "4. Финансовые несоответствия",
        "items": items,
    }


def _build_norm_hours_section(repair: Repair, findings: list[dict[str, object]]) -> dict[str, object]:
    deviations = _collect_hour_deviations(repair)
    items: list[str] = []

    if deviations:
        in_range = len([item for item in deviations if item["status"] == "ok"])
        out_of_range = len(deviations) - in_range
        items.append(
            f"По {len(deviations)} работам есть данные для сравнения фактических и нормативных часов: "
            f"в норме {in_range}, с отклонением {out_of_range}."
        )
        for deviation in sorted(deviations, key=lambda item: abs(item["ratio"] - 1), reverse=True)[:4]:
            items.append(
                f"{deviation['name']}: норма {deviation['standard']:.2f} ч, факт {deviation['actual']:.2f} ч, "
                f"отклонение {deviation['ratio_percent']}%."
            )
    elif any(str(item["category"]) == "Нормо-часы" for item in findings):
        items.extend(
            f"{item['title']}: {item['summary']}"
            for item in findings
            if str(item["category"]) == "Нормо-часы"
        )
    else:
        items.append("Недостаточно данных для сравнения нормо-часов: в заказ-наряде нет пар норма/факт по работам.")

    return {
        "key": "norm_hours",
        "title": "5. Нормо-часы",
        "items": items,
    }


def _build_logic_section(repair: Repair, findings: list[dict[str, object]]) -> dict[str, object]:
    logic_categories = {"Соответствие дефекта и ремонта", "Состав ремонта", "Прозрачность ремонта"}
    items = [
        f"{item['title']}: {item['summary']}"
        for item in findings
        if str(item["category"]) in logic_categories
    ]

    if repair.reason and len(repair.works) >= 6 and len(_group_work_buckets(repair)) >= 3:
        items.insert(
            0,
            "Объем ремонта выглядит широким относительно кратко описанной причины обращения. "
            "Такой заказ-наряд стоит дополнительно перепроверить на предмет согласования допработ.",
        )

    if not items:
        items = ["Явных логических противоречий между причиной обращения и составом ремонта система не нашла."]

    return {
        "key": "logic",
        "title": "6. Логические противоречия",
        "items": items[:5],
    }


def _build_conclusion_section(
    repair: Repair,
    findings: list[dict[str, object]],
    overall_risk: str,
) -> dict[str, object]:
    risk_label = LEVEL_LABELS[overall_risk]
    items = [
        f"Общий уровень управленческого риска: {risk_label}.",
    ]

    if not findings:
        items.append(
            f"Заказ-наряд на сумму {_format_money(float(repair.grand_total or 0))} выглядит управляемым: существенных сигналов не найдено."
        )
    else:
        high_count = len([item for item in findings if str(item["severity"]) == "high"])
        items.append(
            f"Система зафиксировала {len(findings)} значимых сигналов, из них {high_count} высокого уровня."
        )
        if high_count > 0:
            items.append("Документ лучше не закрывать без ручной проверки спорных строк и подтверждения от сервиса.")
        else:
            items.append("Документ можно использовать как основу для решения, но только после точечной ручной сверки спорных мест.")

    return {
        "key": "conclusion",
        "title": "7. Итог",
        "items": items,
    }


def _build_recommendations_section(recommendations: list[str]) -> dict[str, object]:
    items = recommendations[:6] if recommendations else ["Дополнительных действий по данным автоматической проверки не требуется."]
    return {
        "key": "recommendations",
        "title": "8. Рекомендация",
        "items": items,
    }


def _group_work_buckets(repair: Repair) -> list[dict[str, object]]:
    buckets: dict[str, dict[str, object]] = {}
    for work in repair.works:
        normalized = _normalize_text(work.work_name)
        label = "Прочие работы"
        for rule in WORK_CLUSTER_RULES:
            if _contains_any(normalized, rule["terms"]):
                label = str(rule["label"])
                break
        bucket = buckets.setdefault(label, {"label": label, "count": 0, "total": 0.0})
        bucket["count"] = int(bucket["count"]) + 1
        bucket["total"] = float(bucket["total"]) + float(work.line_total or 0)
    return sorted(buckets.values(), key=lambda item: (-float(item["total"]), str(item["label"])))


def _collect_ambiguous_works(repair: Repair) -> list[object]:
    return [
        work
        for work in repair.works
        if _contains_any(_normalize_text(work.work_name), AMBIGUOUS_WORK_TERMS)
    ]


def _collect_financial_risk_items(
    repair: Repair,
    findings: list[dict[str, object]],
) -> tuple[list[str], float]:
    items: list[str] = []
    suspicious_total = 0.0
    counted_work_keys: set[int] = set()
    counted_part_keys: set[int] = set()

    if repair.expected_total is not None:
        delta = float(repair.grand_total or 0) - float(repair.expected_total)
        if delta > 0:
            suspicious_total += delta
            items.append(
                f"Итог по заказ-наряду выше ожидаемой суммы на {_format_money(delta)}."
            )

    diagnostic_works = [
        work for work in repair.works if _contains_any(_normalize_text(work.work_name), ("диагност", "tech tool", "тех тул", "скан", "компьютер"))
    ]
    if len(diagnostic_works) >= 2:
        diagnostic_total = sum(float(item.line_total or 0) for item in diagnostic_works)
        suspicious_total += diagnostic_total
        items.append(
            f"Несколько диагностических строк дают {_format_money(diagnostic_total)} и требуют отдельного обоснования."
        )

    suspicious_oils = _collect_suspicious_oil_parts(repair)
    if suspicious_oils:
        suspicious_oil_total = sum(float(item.line_total or 0) for item in suspicious_oils)
        suspicious_total += _sum_unique_line_totals(suspicious_oils, counted_part_keys)
        items.append(
            f"Строки по моторному маслу, требующему проверки допуска Volvo, составляют {_format_money(suspicious_oil_total)}."
        )

    ambiguous_works = _collect_ambiguous_works(repair)
    if ambiguous_works:
        ambiguous_total = sum(float(item.line_total or 0) for item in ambiguous_works)
        suspicious_total += _sum_unique_line_totals(ambiguous_works, counted_work_keys)
        items.append(
            f"Работы с расплывчатыми формулировками составляют {_format_money(ambiguous_total)}."
        )

    non_original_works = [
        work for work in repair.works if _contains_any(_normalize_text(work.work_name), NON_ORIGINAL_PART_TERMS)
    ]
    if non_original_works:
        non_original_total = sum(float(item.line_total or 0) for item in non_original_works)
        suspicious_total += _sum_unique_line_totals(non_original_works, counted_work_keys)
        items.append(
            f"Строки с признаками аналоговых или восстановленных комплектующих составляют {_format_money(non_original_total)}."
        )

    brake_works = [
        work for work in repair.works
        if _contains_any(_normalize_text(work.work_name), BRAKE_TERMS)
    ]
    if brake_works and not _contains_any(_normalize_text(repair.reason or ""), BRAKE_TERMS):
        brake_total = sum(float(item.line_total or 0) for item in brake_works)
        suspicious_total += _sum_unique_line_totals(brake_works, counted_work_keys)
        items.append(
            f"Тормозные работы вне исходной жалобы составляют {_format_money(brake_total)}."
        )

    high_findings = [item for item in findings if str(item["severity"]) == "high"]
    if high_findings:
        items.append(
            f"Высокорисковых сигналов: {len(high_findings)}. Их нужно рассматривать как спорные до ручного подтверждения."
        )

    return items[:5], suspicious_total


def _collect_hour_deviations(repair: Repair) -> list[dict[str, object]]:
    deviations: list[dict[str, object]] = []
    for work in repair.works:
        if work.standard_hours is None or work.actual_hours is None or float(work.standard_hours) <= 0:
            continue
        ratio = float(work.actual_hours) / float(work.standard_hours)
        if 0.85 <= ratio <= 1.15:
            status = "ok"
        else:
            status = "attention"
        deviations.append(
            {
                "name": work.work_name,
                "standard": float(work.standard_hours),
                "actual": float(work.actual_hours),
                "ratio": ratio,
                "ratio_percent": round((ratio - 1) * 100),
                "status": status,
            }
        )
    return deviations


def _estimate_gross_risk_total(repair: Repair, net_total: float) -> float:
    base_total = float(repair.work_total or 0) + float(repair.parts_total or 0)
    vat_total = float(repair.vat_total or 0)
    if net_total <= 0 or base_total <= 0 or vat_total <= 0:
        return net_total
    vat_ratio = vat_total / base_total
    return round(net_total * (1 + vat_ratio), 2)


def _build_highlights(repair: Repair, findings: list[dict[str, object]]) -> list[str]:
    high_findings_count = len([item for item in findings if str(item["severity"]) == "high"])
    _, suspicious_total = _collect_financial_risk_items(repair, findings)
    gross_suspicious_total = _estimate_gross_risk_total(repair, suspicious_total)
    highlights = [
        f"Сумма заказ-наряда: {_format_money(float(repair.grand_total))}",
        f"Работ: {len(repair.works)} · запчастей: {len(repair.parts)}",
        f"Сигналов в отчёте: {len(findings)}",
        f"Высокорисковых сигналов: {high_findings_count}",
    ]
    if suspicious_total > 0:
        if gross_suspicious_total > suspicious_total:
            highlights.append(
                "Спорные затраты по прямым сигналам: "
                f"{_format_money(suspicious_total)} без НДС, около {_format_money(gross_suspicious_total)} с НДС"
            )
        else:
            highlights.append(f"Спорные затраты по прямым сигналам: до {_format_money(suspicious_total)}")
    return highlights[:5]


def _collect_recommendations(findings: list[dict[str, object]]) -> list[str]:
    recommendations: list[str] = []
    seen: set[str] = set()
    for finding in findings:
        recommendation = finding.get("recommendation")
        if not recommendation:
            continue
        text = str(recommendation)
        if text in seen:
            continue
        seen.add(text)
        recommendations.append(text)
    return recommendations[:6]


def _build_risk_matrix(findings: list[dict[str, object]]) -> list[dict[str, str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for finding in findings:
        grouped[str(finding["category"])].append(str(finding["severity"]))

    matrix: list[dict[str, str]] = []
    for zone, levels in grouped.items():
        level = max(levels, key=lambda item: LEVEL_ORDER[item])
        matrix.append(
            {
                "zone": zone,
                "level": level,
                "comment": _risk_comment(zone, level),
            }
        )
    matrix.sort(key=lambda item: (-LEVEL_ORDER[item["level"]], item["zone"]))
    return matrix


def _risk_comment(zone: str, level: str) -> str:
    if level == "high":
        return f"По зоне «{zone}» есть признаки, требующие отдельного управленческого контроля."
    if level == "medium":
        return f"По зоне «{zone}» есть спорные моменты, которые стоит уточнить до закрытия ремонта."
    return f"По зоне «{zone}» значимых рисков не выявлено."


def _finding_sort_key(item: dict[str, object]) -> tuple[int, int, int, str]:
    severity = str(item.get("severity", "low"))
    title = str(item.get("title", ""))
    category = str(item.get("category", ""))
    title_priority = FINDING_TITLE_PRIORITY.get(title, 100)
    category_priority = CATEGORY_PRIORITY.get(category, 100)
    return (-LEVEL_ORDER.get(severity, 0), title_priority, category_priority, title)


def _build_check_rationale(check: RepairCheck) -> Optional[str]:
    if check.check_type.startswith("ocr_"):
        return "Несоответствие выявлено автоматической сверкой документа с данными ремонта и справочниками."
    if "standard_hours" in check.check_type:
        return "Отклонение найдено при сравнении работ с каталогом нормо-часов."
    if "repeat_repair" in check.check_type or "duplicate" in check.check_type:
        return "Сигнал собран на основе повторяющихся или аномально похожих операций."
    return None


def _build_check_evidence(check: RepairCheck) -> list[str]:
    payload = check.calculation_payload if isinstance(check.calculation_payload, dict) else {}
    evidence: list[str] = []
    key_pairs = (
        ("document_plate_number", "Госномер в документе"),
        ("vehicle_plate_number", "Госномер в карточке"),
        ("lines_total", "Сумма строк"),
        ("header_total", "Итог по шапке"),
        ("expected_total", "Ожидаемая сумма"),
        ("actual_total", "Фактическая сумма"),
        ("work_name", "Работа"),
        ("part_name", "Запчасть"),
        ("catalog_name", "Каталог"),
        ("standard_hours", "Нормо-часы"),
        ("actual_hours", "Фактические часы"),
    )
    for key, label in key_pairs:
        if key not in payload:
            continue
        evidence.append(f"{label}: {payload[key]}")
    if line_breakdown := payload.get("line_breakdown"):
        if isinstance(line_breakdown, list) and line_breakdown:
            sample = line_breakdown[0]
            if isinstance(sample, dict):
                work_name = sample.get("work_name")
                expected_line_total = sample.get("expected_line_total")
                if work_name:
                    evidence.append(
                        "Пример строки для сравнения: "
                        + str(work_name)
                        + (
                            f" · ожидаемо {_format_money(float(expected_line_total))}"
                            if isinstance(expected_line_total, (int, float))
                            else ""
                        )
                    )
    if check.details:
        evidence.insert(0, check.details)
    return [item for item in evidence[:5] if item]


def _recommendation_for_check(check_type: str) -> Optional[str]:
    if "vehicle" in check_type:
        return "Проверить привязку техники и убедиться, что документ относится к нужной карточке ТС."
    if "service" in check_type:
        return "Подтвердить сервис по справочнику и снять предупреждение только после ручной проверки."
    if "standard_hours" in check_type:
        return "Сверить работу с каталогом нормо-часов и подтвердить допустимость отклонения."
    if "duplicate" in check_type:
        return "Проверить, не задвоены ли работы или материалы в заказ-наряде."
    if "expected_total" in check_type or "total" in check_type:
        return "Пересчитать стоимость работ и материалов по строкам до закрытия заказ-наряда."
    if check_type.startswith("ocr_"):
        return "Проверить спорные поля вручную и зафиксировать корректные значения перед подтверждением."
    return None


def _get_check_zone_key(check_type: str) -> str:
    if "vehicle" in check_type or "service" in check_type:
        return "catalogs"
    if "standard_hours" in check_type:
        return "labor_norms"
    if "total" in check_type or "duplicate" in check_type or "expected_total" in check_type:
        return "amounts"
    if "repeat_repair" in check_type:
        return "history"
    return "ocr"


def _normalize_text(value: str) -> str:
    return (
        value.lower()
        .replace("ё", "е")
        .replace("\n", " ")
        .replace("\t", " ")
        .strip()
    )


def _contains_any(text: str, needles: Iterable[str]) -> bool:
    return any(needle in text for needle in needles)


def _sum_unique_line_totals(items: Iterable[object], seen_keys: set[int]) -> float:
    total = 0.0
    for item in items:
        key = id(item)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        total += float(getattr(item, "line_total", 0) or 0)
    return total


def _collect_suspicious_oil_parts(repair: Repair) -> list[object]:
    vehicle_text = _normalize_text(" ".join(filter(None, [_get_vehicle_attr(repair, "brand"), _get_vehicle_attr(repair, "model")])))
    if not vehicle_text or not _contains_any(vehicle_text, VOLVO_FAMILY_TERMS):
        return []

    return [
        item
        for item in repair.parts
        if "масло" in _normalize_text(item.part_name) and _contains_any(_normalize_text(item.part_name), SUSPICIOUS_OIL_TERMS)
    ]


def _get_vehicle_attr(repair: Repair, attr_name: str) -> str | None:
    vehicle = getattr(repair, "vehicle", None)
    value = getattr(vehicle, attr_name, None) if vehicle is not None else None
    if value is None:
        return None
    return str(value)


def _format_money(value: float) -> str:
    formatted = f"{value:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} ₽"


def _truncate_text(value: str, max_length: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    if len(normalized) <= max_length:
        return normalized
    return normalized[: max_length - 1].rstrip() + "…"


def _collect_document_restoration_signals(normalization_notes: list[str]) -> list[str]:
    signals: list[str] = []
    for note in normalization_notes:
        if note.startswith("noise_work_items_removed"):
            removed_count = note.partition(":")[2]
            if removed_count.isdigit():
                signals.append(f"OCR удалил шумовые строки из таблицы работ: {removed_count}.")
            else:
                signals.append("OCR удалил шумовые строки из таблицы работ.")
            continue
        if "_items_restored_from_" in note:
            signals.append("Состав работ или материалов восстановлен из другого блока документа.")
            continue
        if "_totals_restored_from_" in note or "_total_restored_from_" in note:
            signals.append("Итоги документа восстановлены по итоговому или служебному блоку.")
            continue
        if "_derived_from_" in note:
            signals.append("Часть сумм была вычислена из связанных полей документа.")
            continue
        if note.endswith("_items_suppressed") or "_items_suppressed:" in note:
            signals.append("Часть строк была подавлена как шум или нерелевантный блок документа.")
            continue

    return list(dict.fromkeys(signals))
