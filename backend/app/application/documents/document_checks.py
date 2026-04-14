from __future__ import annotations

import statistics
from datetime import timedelta
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.application.documents.parser_helpers import normalize_unit_name
from app.application.documents.config import (
    EXPECTED_TOTAL_HOURLY_SAMPLE_THRESHOLD,
    EXPECTED_TOTAL_REPAIR_STATUSES,
    EXPECTED_TOTAL_SERVICE_SAMPLE_THRESHOLD,
    EXPECTED_TOTAL_THRESHOLD_MULTIPLIER,
    HISTORICAL_IMPORT_REASON_PREFIX,
    REPEAT_REPAIR_WINDOW_DAYS,
    WORK_REFERENCE_MILEAGE_MARGIN_RATIO,
    WORK_REFERENCE_MIN_MILEAGE_MARGIN,
    WORK_REFERENCE_MIN_SAMPLES,
    WORK_REFERENCE_OPERATIONAL_STATUSES,
    WORK_REFERENCE_SERVICE_SAMPLE_THRESHOLD,
    WORK_REFERENCE_SUSPICIOUS_LOWER_MULTIPLIER,
    WORK_REFERENCE_SUSPICIOUS_MULTIPLIER,
    WORK_REFERENCE_VEHICLE_SAMPLE_THRESHOLD,
    WORK_REFERENCE_WARNING_LOWER_MULTIPLIER,
    WORK_REFERENCE_WARNING_MULTIPLIER,
)
from app.application.services.labor_norms import build_normalized_name
from app.models.enums import CheckSeverity, RepairStatus, ServiceStatus, VehicleStatus
from app.models.repair import Repair, RepairWork
from app.models.service import Service
from app.models.vehicle import Vehicle


def build_standard_hours_checks(
    works_payload: list[dict[str, object]],
) -> list[dict[str, object]]:
    checks: list[dict[str, object]] = []
    for item in works_payload:
        reference_payload = item.get("reference_payload")
        if not isinstance(reference_payload, dict):
            reference_payload = {}
        normalized_unit_name = normalize_unit_name(str(item.get("unit_name")) if item.get("unit_name") else None)
        actual_hours = item.get("actual_hours")
        if actual_hours is None and normalized_unit_name in {"нч", "ч"} and item.get("quantity") is not None:
            actual_hours = float(item["quantity"])
        document_standard_hours = reference_payload.get("document_standard_hours")
        if document_standard_hours is None:
            document_standard_hours = item.get("standard_hours")
        catalog_standard_hours = reference_payload.get("labor_norm_standard_hours")

        actual_value: Optional[float] = None
        if actual_hours is not None:
            try:
                actual_value = float(actual_hours)
            except (TypeError, ValueError):
                actual_value = None

        document_standard_value: Optional[float] = None
        if document_standard_hours is not None:
            try:
                document_standard_value = float(document_standard_hours)
            except (TypeError, ValueError):
                document_standard_value = None

        catalog_standard_value: Optional[float] = None
        if catalog_standard_hours is not None:
            try:
                catalog_standard_value = float(catalog_standard_hours)
            except (TypeError, ValueError):
                catalog_standard_value = None

        comparison_standard_value = document_standard_value if document_standard_value is not None else catalog_standard_value
        if (
            actual_value is not None
            and comparison_standard_value is not None
            and comparison_standard_value > 0
            and actual_value > round(comparison_standard_value * 1.1, 2)
        ):
            checks.append(
                {
                    "check_type": "ocr_standard_hours_exceeded",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Фактические часы превышают норматив",
                    "details": (
                        f"{item.get('work_name', 'Работа')} · факт {actual_value:.2f} ч, "
                        f"норма {comparison_standard_value:.2f} ч"
                    ),
                    "payload": {
                        "work_code": item.get("work_code"),
                        "work_name": item.get("work_name"),
                        "actual_hours": actual_value,
                        "standard_hours": comparison_standard_value,
                        "document_standard_hours": document_standard_value,
                        "catalog_standard_hours": catalog_standard_value,
                        "reference_payload": reference_payload,
                    },
                }
            )

        if (
            document_standard_value is not None
            and catalog_standard_value is not None
            and document_standard_value - catalog_standard_value > 0.01
        ):
            checks.append(
                {
                    "check_type": "ocr_document_standard_hours_exceeded",
                    "severity": CheckSeverity.SUSPICIOUS,
                    "title": "Норма в заказ-наряде выше нормы справочника",
                    "details": (
                        f"{item.get('work_name', 'Работа')} · в документе {document_standard_value:.2f} ч, "
                        f"в справочнике {catalog_standard_value:.2f} ч"
                    ),
                    "payload": {
                        "work_code": item.get("work_code"),
                        "work_name": item.get("work_name"),
                        "document_standard_hours": document_standard_value,
                        "catalog_standard_hours": catalog_standard_value,
                        "reference_payload": reference_payload,
                    },
                }
            )
    return checks


def build_repeat_repair_checks(
    db: Session,
    repair: Repair,
    works_payload: list[dict[str, object]],
) -> list[dict[str, object]]:
    if not works_payload or repair.vehicle_id is None or repair.repair_date is None:
        return []

    checks: list[dict[str, object]] = []
    seen_keys: set[tuple[Optional[str], str]] = set()
    window_start = repair.repair_date - timedelta(days=REPEAT_REPAIR_WINDOW_DAYS)

    previous_repairs = db.execute(
        select(Repair, RepairWork)
        .join(RepairWork, RepairWork.repair_id == Repair.id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(
            Repair.vehicle_id == repair.vehicle_id,
            Repair.id != repair.id,
            Repair.status != RepairStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            Repair.repair_date >= window_start,
            Repair.repair_date <= repair.repair_date,
        )
        .order_by(Repair.repair_date.desc(), Repair.id.desc(), RepairWork.id.desc())
    ).all()

    if not previous_repairs:
        return checks

    indexed_previous: dict[tuple[Optional[str], str], tuple[Repair, RepairWork]] = {}
    for previous_repair, previous_work in previous_repairs:
        normalized_name = build_normalized_name(previous_work.work_name or "")
        match_key = (previous_work.work_code or None, normalized_name)
        if match_key not in indexed_previous:
            indexed_previous[match_key] = (previous_repair, previous_work)

    for item in works_payload:
        work_name = str(item.get("work_name") or "").strip()
        if not work_name:
            continue
        work_code = str(item.get("work_code")).strip() if item.get("work_code") else None
        normalized_name = build_normalized_name(work_name)
        match_key = (work_code, normalized_name)
        fallback_key = (None, normalized_name)

        previous_match = indexed_previous.get(match_key) or indexed_previous.get(fallback_key)
        if previous_match is None or match_key in seen_keys:
            continue

        previous_repair, previous_work = previous_match
        seen_keys.add(match_key)
        days_delta = (repair.repair_date - previous_repair.repair_date).days

        checks.append(
            {
                "check_type": "ocr_repeat_repair_detected",
                "severity": CheckSeverity.SUSPICIOUS,
                "title": "Повторный ремонт по той же работе",
                "details": (
                    f"{work_name} · уже было {previous_repair.repair_date.isoformat()} "
                    f"по заказ-наряду {previous_repair.order_number or 'без номера'} "
                    f"({days_delta} дн. назад)"
                ),
                "payload": {
                    "work_code": work_code,
                    "work_name": work_name,
                    "previous_repair_id": previous_repair.id,
                    "previous_order_number": previous_repair.order_number,
                    "previous_repair_date": previous_repair.repair_date.isoformat(),
                    "previous_service_id": previous_repair.service_id,
                    "previous_work_id": previous_work.id,
                    "previous_work_code": previous_work.work_code,
                    "previous_work_name": previous_work.work_name,
                    "days_since_previous": days_delta,
                    "window_days": REPEAT_REPAIR_WINDOW_DAYS,
                },
            }
        )

    return checks


def build_duplicate_line_checks(
    works_payload: list[dict[str, object]],
    parts_payload: list[dict[str, object]],
) -> list[dict[str, object]]:
    checks: list[dict[str, object]] = []

    def build_group_key(
        item: dict[str, object],
        *,
        code_keys: tuple[str, ...],
        name_keys: tuple[str, ...],
    ) -> tuple[str | None, str, float | None, float | None, float | None]:
        code_value: str | None = None
        for key in code_keys:
            raw_code = item.get(key)
            if raw_code:
                code_value = str(raw_code).strip() or None
                if code_value:
                    break
        name_value = ""
        for key in name_keys:
            raw_name = item.get(key)
            if raw_name:
                name_value = build_normalized_name(str(raw_name))
                if name_value:
                    break
        quantity = float(item["quantity"]) if item.get("quantity") is not None else None
        price = float(item["price"]) if item.get("price") is not None else None
        line_total = float(item["line_total"]) if item.get("line_total") is not None else None
        return code_value, name_value, quantity, price, line_total

    work_groups: dict[tuple[str | None, str, float | None, float | None, float | None], list[dict[str, object]]] = {}
    for item in works_payload:
        group_key = build_group_key(item, code_keys=("work_code",), name_keys=("work_name",))
        if not group_key[1]:
            continue
        work_groups.setdefault(group_key, []).append(item)

    for (_code, _name, quantity, price, line_total), items in work_groups.items():
        if len(items) < 2:
            continue
        sample = items[0]
        checks.append(
            {
                "check_type": "ocr_duplicate_work_lines",
                "severity": CheckSeverity.SUSPICIOUS,
                "title": "Дубли строк работ в заказ-наряде",
                "details": (
                    f"{sample.get('work_name', 'Работа')} · совпадающих строк {len(items)}"
                    f"{f' · кол-во {quantity:.2f}' if quantity is not None else ''}"
                    f"{f' · цена {price:.2f}' if price is not None else ''}"
                    f"{f' · сумма {line_total:.2f}' if line_total is not None else ''}"
                ),
                "payload": {
                    "work_code": sample.get("work_code"),
                    "work_name": sample.get("work_name"),
                    "duplicate_count": len(items),
                    "quantity": quantity,
                    "price": price,
                    "line_total": line_total,
                },
            }
        )

    part_groups: dict[tuple[str | None, str, float | None, float | None, float | None], list[dict[str, object]]] = {}
    for item in parts_payload:
        group_key = build_group_key(item, code_keys=("article",), name_keys=("part_name", "name"))
        if not group_key[1]:
            continue
        part_groups.setdefault(group_key, []).append(item)

    for (_code, _name, quantity, price, line_total), items in part_groups.items():
        if len(items) < 2:
            continue
        sample = items[0]
        checks.append(
            {
                "check_type": "ocr_duplicate_part_lines",
                "severity": CheckSeverity.SUSPICIOUS,
                "title": "Дубли строк запчастей в заказ-наряде",
                "details": (
                    f"{sample.get('part_name', sample.get('name', 'Запчасть'))} · совпадающих строк {len(items)}"
                    f"{f' · кол-во {quantity:.2f}' if quantity is not None else ''}"
                    f"{f' · цена {price:.2f}' if price is not None else ''}"
                    f"{f' · сумма {line_total:.2f}' if line_total is not None else ''}"
                ),
                "payload": {
                    "article": sample.get("article"),
                    "part_name": sample.get("part_name") or sample.get("name"),
                    "duplicate_count": len(items),
                    "quantity": quantity,
                    "price": price,
                    "line_total": line_total,
                },
            }
        )

    return checks


def resolve_work_reference_hours(item: dict[str, object]) -> Optional[float]:
    reference_payload = item.get("reference_payload")
    if not isinstance(reference_payload, dict):
        reference_payload = {}

    candidate_values = [
        reference_payload.get("document_standard_hours"),
        item.get("standard_hours"),
        reference_payload.get("labor_norm_standard_hours"),
        item.get("actual_hours"),
    ]
    normalized_unit_name = normalize_unit_name(str(item.get("unit_name")) if item.get("unit_name") else None)
    if normalized_unit_name in {"нч", "ч"} and item.get("quantity") is not None:
        candidate_values.append(item.get("quantity"))

    for value in candidate_values:
        if value is None:
            continue
        try:
            normalized_value = float(value)
        except (TypeError, ValueError):
            continue
        if normalized_value > 0:
            return normalized_value
    return None


def build_expected_total_checks(
    db: Session,
    repair: Repair,
    works_payload: list[dict[str, object]],
) -> tuple[Optional[float], list[dict[str, object]]]:
    if not works_payload or repair.vehicle is None:
        return None, []

    historical_rows = db.execute(
        select(
            Repair.id,
            Repair.repair_date,
            Repair.service_id,
            Repair.work_total,
            Repair.parts_total,
            Repair.vat_total,
            Repair.grand_total,
            RepairWork.work_code,
            RepairWork.work_name,
            RepairWork.line_total,
            RepairWork.standard_hours,
            RepairWork.actual_hours,
        )
        .join(RepairWork, RepairWork.repair_id == Repair.id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(
            Repair.id != repair.id,
            Repair.status.in_(EXPECTED_TOTAL_REPAIR_STATUSES),
            Repair.grand_total > 0,
            Vehicle.status != VehicleStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            Vehicle.vehicle_type == repair.vehicle.vehicle_type,
        )
    ).all()

    if not historical_rows:
        return None, []

    current_service_id = repair.service_id
    expected_line_totals: list[float] = []
    line_breakdown: list[dict[str, object]] = []

    general_hourly_rates: list[float] = []
    service_hourly_rates: list[float] = []
    for row in historical_rows:
        reference_hours = row.standard_hours if row.standard_hours and row.standard_hours > 0 else row.actual_hours
        if reference_hours is None or reference_hours <= 0:
            continue
        hourly_rate = float(row.line_total) / float(reference_hours)
        if hourly_rate <= 0:
            continue
        general_hourly_rates.append(hourly_rate)
        if current_service_id is not None and row.service_id == current_service_id:
            service_hourly_rates.append(hourly_rate)

    for item in works_payload:
        work_name = str(item.get("work_name") or "").strip()
        if not work_name:
            continue
        work_code = str(item.get("work_code")).strip() if item.get("work_code") else None
        normalized_name = build_normalized_name(work_name)

        line_service_matches: list[float] = []
        line_general_matches: list[float] = []
        for row in historical_rows:
            same_code = bool(work_code and row.work_code and str(row.work_code).strip() == work_code)
            same_name = build_normalized_name(str(row.work_name or "")) == normalized_name
            if not same_code and not same_name:
                continue
            line_general_matches.append(float(row.line_total))
            if current_service_id is not None and row.service_id == current_service_id:
                line_service_matches.append(float(row.line_total))

        selected_matches = (
            line_service_matches
            if len(line_service_matches) >= EXPECTED_TOTAL_SERVICE_SAMPLE_THRESHOLD
            else line_general_matches
        )
        if selected_matches:
            expected_line_total = round(float(statistics.median(selected_matches)), 2)
            expected_line_totals.append(expected_line_total)
            line_breakdown.append(
                {
                    "work_code": work_code,
                    "work_name": work_name,
                    "source": "historical_work_median",
                    "samples": len(selected_matches),
                    "expected_line_total": expected_line_total,
                }
            )
            continue

        reference_hours = resolve_work_reference_hours(item)
        if reference_hours is None:
            continue

        selected_hourly_rates = (
            service_hourly_rates
            if len(service_hourly_rates) >= EXPECTED_TOTAL_HOURLY_SAMPLE_THRESHOLD
            else general_hourly_rates
        )
        if not selected_hourly_rates:
            continue

        expected_line_total = round(float(statistics.median(selected_hourly_rates)) * reference_hours, 2)
        expected_line_totals.append(expected_line_total)
        line_breakdown.append(
            {
                "work_code": work_code,
                "work_name": work_name,
                "source": "historical_hourly_rate",
                "samples": len(selected_hourly_rates),
                "reference_hours": reference_hours,
                "expected_line_total": expected_line_total,
            }
        )

    if not expected_line_totals:
        return None, []

    expected_work_total = round(sum(expected_line_totals), 2)
    expected_total = round(expected_work_total + float(repair.parts_total or 0) + float(repair.vat_total or 0), 2)
    actual_total = round(float(repair.grand_total or 0), 2)

    checks: list[dict[str, object]] = []
    if expected_total > 0 and actual_total > round(expected_total * EXPECTED_TOTAL_THRESHOLD_MULTIPLIER, 2):
        checks.append(
            {
                "check_type": "ocr_expected_total_exceeded",
                "severity": CheckSeverity.SUSPICIOUS,
                "title": "Стоимость ремонта выше ожидаемой",
                "details": (
                    f"Итого {actual_total:.2f} руб. при ожидаемой стоимости {expected_total:.2f} руб. "
                    f"по истории аналогичных работ"
                ),
                "payload": {
                    "actual_total": actual_total,
                    "expected_total": expected_total,
                    "expected_work_total": expected_work_total,
                    "actual_work_total": round(float(repair.work_total or 0), 2),
                    "actual_parts_total": round(float(repair.parts_total or 0), 2),
                    "actual_vat_total": round(float(repair.vat_total or 0), 2),
                    "threshold_multiplier": EXPECTED_TOTAL_THRESHOLD_MULTIPLIER,
                    "line_breakdown": line_breakdown,
                },
            }
        )

    return expected_total, checks


def describe_work_reference_source(source: str) -> str:
    if source == "same_vehicle":
        return "по этой же технике"
    if source == "same_service":
        return "по этому же сервису"
    return "по типу техники"


def build_dynamic_work_reference_checks(
    db: Session,
    repair: Repair,
    works_payload: list[dict[str, object]],
) -> list[dict[str, object]]:
    if not works_payload or repair.vehicle is None:
        return []

    historical_rows = db.execute(
        select(
            Repair.id.label("repair_id"),
            Repair.vehicle_id,
            Repair.service_id,
            Repair.repair_date,
            Repair.mileage,
            Repair.status,
            Repair.reason,
            RepairWork.id.label("work_id"),
            RepairWork.work_code,
            RepairWork.work_name,
            RepairWork.quantity,
            RepairWork.price,
            RepairWork.line_total,
        )
        .join(RepairWork, RepairWork.repair_id == Repair.id)
        .join(Vehicle, Vehicle.id == Repair.vehicle_id)
        .outerjoin(Service, Service.id == Repair.service_id)
        .where(
            Repair.id != repair.id,
            RepairWork.work_name.is_not(None),
            Repair.status != RepairStatus.ARCHIVED,
            Vehicle.status != VehicleStatus.ARCHIVED,
            or_(Repair.service_id.is_(None), Service.status != ServiceStatus.ARCHIVED),
            Vehicle.vehicle_type == repair.vehicle.vehicle_type,
            (
                Repair.reason.like(f"{HISTORICAL_IMPORT_REASON_PREFIX}%")
                | Repair.status.in_(WORK_REFERENCE_OPERATIONAL_STATUSES)
            ),
        )
    ).all()

    if not historical_rows:
        return []

    indexed_rows: dict[tuple[Optional[str], str], list[object]] = {}
    for row in historical_rows:
        work_name = str(row.work_name or "").strip()
        if not work_name:
            continue
        work_code = str(row.work_code).strip() if row.work_code else None
        normalized_name = build_normalized_name(work_name)
        key = (work_code, normalized_name)
        fallback_key = (None, normalized_name)
        indexed_rows.setdefault(key, []).append(row)
        if fallback_key != key:
            indexed_rows.setdefault(fallback_key, []).append(row)

    checks: list[dict[str, object]] = []
    seen_missing_keys: set[tuple[Optional[str], str]] = set()
    current_service_id = repair.service_id

    for item in works_payload:
        work_name = str(item.get("work_name") or "").strip()
        if not work_name:
            continue
        work_code = str(item.get("work_code")).strip() if item.get("work_code") else None
        normalized_name = build_normalized_name(work_name)
        match_key = (work_code, normalized_name)
        matches = indexed_rows.get(match_key) or indexed_rows.get((None, normalized_name)) or []

        reference_payload = item.get("reference_payload")
        if not isinstance(reference_payload, dict):
            reference_payload = {}
            item["reference_payload"] = reference_payload

        labor_norm_item_reason_code = str(reference_payload.get("labor_norm_item_reason_code") or "").strip()
        if labor_norm_item_reason_code == "outside_catalog_service":
            reference_payload["dynamic_work_reference"] = {
                "comparison_source": "not_applicable",
                "reason_code": labor_norm_item_reason_code,
                "reason": reference_payload.get("labor_norm_item_reason"),
                "sample_lines": 0,
                "historical_sample_lines": 0,
                "operational_sample_lines": 0,
            }
            continue

        if not matches:
            if match_key not in seen_missing_keys:
                checks.append(
                    {
                        "check_type": "ocr_work_reference_missing",
                        "severity": CheckSeverity.WARNING,
                        "title": "Работа не найдена в динамическом справочнике",
                        "details": f"{work_name} · в базе пока нет подтвержденной истории для сверки",
                        "payload": {
                            "work_code": work_code,
                            "work_name": work_name,
                            "comparison_source": "none",
                            "vehicle_type": repair.vehicle.vehicle_type.value,
                            "repair_mileage": repair.mileage,
                        },
                    }
                )
                seen_missing_keys.add(match_key)
            reference_payload["dynamic_work_reference"] = {
                "comparison_source": "none",
                "sample_lines": 0,
                "historical_sample_lines": 0,
                "operational_sample_lines": 0,
            }
            continue

        vehicle_matches = [row for row in matches if row.vehicle_id == repair.vehicle_id]
        service_matches = [row for row in matches if current_service_id is not None and row.service_id == current_service_id]
        if len(vehicle_matches) >= WORK_REFERENCE_VEHICLE_SAMPLE_THRESHOLD:
            selected_matches = vehicle_matches
            comparison_source = "same_vehicle"
        elif len(service_matches) >= WORK_REFERENCE_SERVICE_SAMPLE_THRESHOLD:
            selected_matches = service_matches
            comparison_source = "same_service"
        else:
            selected_matches = matches
            comparison_source = "vehicle_type"

        line_totals = [float(row.line_total) for row in selected_matches if row.line_total is not None]
        prices = [float(row.price) for row in selected_matches if row.price is not None]
        mileages = [int(row.mileage) for row in selected_matches if row.mileage is not None and int(row.mileage) > 0]
        historical_sample_lines = sum(
            1
            for row in matches
            if row.reason is not None and str(row.reason).startswith(HISTORICAL_IMPORT_REASON_PREFIX)
        )
        operational_sample_lines = len(matches) - historical_sample_lines

        reference_payload["dynamic_work_reference"] = {
            "comparison_source": comparison_source,
            "comparison_source_label": describe_work_reference_source(comparison_source),
            "sample_lines": len(selected_matches),
            "all_sample_lines": len(matches),
            "historical_sample_lines": historical_sample_lines,
            "operational_sample_lines": operational_sample_lines,
            "median_line_total": round(float(statistics.median(line_totals)), 2) if line_totals else None,
            "median_price": round(float(statistics.median(prices)), 2) if prices else None,
            "median_mileage": int(round(float(statistics.median(mileages)))) if mileages else None,
            "min_mileage": min(mileages) if mileages else None,
            "max_mileage": max(mileages) if mileages else None,
        }

        if len(selected_matches) < WORK_REFERENCE_MIN_SAMPLES:
            continue

        current_price = float(item["price"]) if item.get("price") is not None else None
        median_price = float(statistics.median(prices)) if prices else None
        if current_price is not None and median_price is not None and median_price > 0:
            price_ratio = round(current_price / median_price, 4)
            if (
                price_ratio >= WORK_REFERENCE_SUSPICIOUS_MULTIPLIER
                or price_ratio <= WORK_REFERENCE_SUSPICIOUS_LOWER_MULTIPLIER
            ):
                severity = CheckSeverity.SUSPICIOUS
            elif (
                price_ratio >= WORK_REFERENCE_WARNING_MULTIPLIER
                or price_ratio <= WORK_REFERENCE_WARNING_LOWER_MULTIPLIER
            ):
                severity = CheckSeverity.WARNING
            else:
                severity = None

            if severity is not None:
                checks.append(
                    {
                        "check_type": "ocr_work_reference_price_deviation",
                        "severity": severity,
                        "title": "Цена работы отклоняется от динамического справочника",
                        "details": (
                            f"{work_name} · цена {current_price:.2f} руб., медиана {median_price:.2f} руб. "
                            f"{describe_work_reference_source(comparison_source)}"
                        ),
                        "payload": {
                            "work_code": work_code,
                            "work_name": work_name,
                            "current_price": current_price,
                            "median_price": round(median_price, 2),
                            "price_ratio": price_ratio,
                            "comparison_source": comparison_source,
                            "comparison_source_label": describe_work_reference_source(comparison_source),
                            "sample_lines": len(selected_matches),
                            "all_sample_lines": len(matches),
                            "historical_sample_lines": historical_sample_lines,
                            "operational_sample_lines": operational_sample_lines,
                        },
                    }
                )

        if repair.mileage > 0 and len(mileages) >= WORK_REFERENCE_MIN_SAMPLES:
            min_mileage = min(mileages)
            max_mileage = max(mileages)
            median_mileage = int(round(float(statistics.median(mileages))))
            mileage_margin = max(
                WORK_REFERENCE_MIN_MILEAGE_MARGIN,
                int(round((max_mileage - min_mileage) * WORK_REFERENCE_MILEAGE_MARGIN_RATIO)),
            )
            if repair.mileage < (min_mileage - mileage_margin) or repair.mileage > (max_mileage + mileage_margin):
                checks.append(
                    {
                        "check_type": "ocr_work_reference_mileage_outlier",
                        "severity": CheckSeverity.WARNING,
                        "title": "Работа нетипична для текущего пробега",
                        "details": (
                            f"{work_name} · пробег {repair.mileage} км, "
                            f"наблюдаемый диапазон {min_mileage}-{max_mileage} км "
                            f"{describe_work_reference_source(comparison_source)}"
                        ),
                        "payload": {
                            "work_code": work_code,
                            "work_name": work_name,
                            "repair_mileage": repair.mileage,
                            "median_mileage": median_mileage,
                            "min_mileage": min_mileage,
                            "max_mileage": max_mileage,
                            "mileage_margin": mileage_margin,
                            "comparison_source": comparison_source,
                            "comparison_source_label": describe_work_reference_source(comparison_source),
                            "sample_lines": len(selected_matches),
                        },
                    }
                )

    return checks
