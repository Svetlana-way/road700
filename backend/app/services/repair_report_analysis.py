from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Optional

from app.models.enums import CheckSeverity
from app.models.repair import Repair, RepairCheck


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


def build_repair_executive_report(
    repair: Repair,
    *,
    source_payload: dict,
    manual_review_reason_labels: dict[str, str],
) -> dict[str, object]:
    findings: list[dict[str, object]] = []
    seen_titles: set[str] = set()

    for finding in _build_check_findings(repair.checks):
        _append_finding(findings, seen_titles, finding)

    for finding in _build_reason_gap_findings(repair):
        _append_finding(findings, seen_titles, finding)

    for finding in _build_reason_quality_findings(repair):
        _append_finding(findings, seen_titles, finding)

    for finding in _build_diagnostics_findings(repair):
        _append_finding(findings, seen_titles, finding)

    for finding in _build_expensive_part_findings(repair):
        _append_finding(findings, seen_titles, finding)

    for finding in _build_document_quality_findings(repair, source_payload, manual_review_reason_labels):
        _append_finding(findings, seen_titles, finding)

    findings.sort(key=lambda item: (-LEVEL_ORDER[str(item["severity"])], str(item["title"])))

    overall_risk = "low"
    if findings:
        overall_risk = max((str(item["severity"]) for item in findings), key=lambda value: LEVEL_ORDER[value])

    highlights = _build_highlights(repair, findings)
    recommendations = _collect_recommendations(findings)
    risk_matrix = _build_risk_matrix(findings)
    headline, summary = _build_summary(repair, findings, overall_risk)

    return {
        "headline": headline,
        "summary": summary,
        "status": LEVEL_LABELS[overall_risk],
        "overall_risk": overall_risk,
        "highlights": highlights,
        "findings": findings,
        "risk_matrix": risk_matrix,
        "recommendations": recommendations,
    }


def _append_finding(
    findings: list[dict[str, object]],
    seen_titles: set[str],
    finding: dict[str, object],
) -> None:
    title = str(finding["title"])
    if title in seen_titles:
        return
    seen_titles.add(title)
    findings.append(finding)


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


def _build_document_quality_findings(
    repair: Repair,
    source_payload: dict,
    manual_review_reason_labels: dict[str, str],
) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    source_document = next((item for item in repair.documents if item.id == repair.source_document_id), None)
    document = source_document or next((item for item in repair.documents if item.is_primary), None) or (repair.documents[0] if repair.documents else None)
    manual_review_reasons = source_payload.get("manual_review_reasons")
    reason_codes = [str(item) for item in manual_review_reasons] if isinstance(manual_review_reasons, list) else []
    labeled_reasons = [manual_review_reason_labels.get(item, item) for item in reason_codes]

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

    return findings


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


def _build_highlights(repair: Repair, findings: list[dict[str, object]]) -> list[str]:
    highlights = [
        f"Сумма заказ-наряда: {_format_money(float(repair.grand_total))}",
        f"Работ: {len(repair.works)} · запчастей: {len(repair.parts)}",
        f"Открытых проверок: {len([item for item in repair.checks if not item.is_resolved])}",
    ]
    for finding in findings[:3]:
        highlights.append(str(finding["title"]))
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


def _format_money(value: float) -> str:
    formatted = f"{value:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} ₽"
