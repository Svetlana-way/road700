from __future__ import annotations

from sqlalchemy.orm import Session

from app.application.services.labor_norms import (
    LaborNormApplicability,
    LaborNormEnrichmentSummary,
    build_labor_norm_rewrite_draft,
    build_labor_norm_resolution_hint,
    build_normalized_name,
    classify_known_non_catalog_operation,
    find_best_labor_norm_match,
    infer_labor_norm_catalog_gap_reason_code,
    infer_labor_norm_catalog_gap_reason,
    normalize_known_work_name,
    normalize_labor_norm_code,
)


def enrich_work_payloads_with_labor_norms(
    db: Session,
    works_payload: list[dict[str, object]],
    applicability: LaborNormApplicability,
    document_text: str | None = None,
) -> tuple[list[str], LaborNormEnrichmentSummary]:
    notes: list[str] = []
    matched_count = 0
    unmatched_count = 0
    applicable_item_count = 0
    for item in works_payload:
        work_name = str(item.get("work_name") or "").strip()
        if not work_name:
            continue

        work_code = normalize_labor_norm_code(str(item.get("work_code"))) if item.get("work_code") else None
        if work_code:
            item["work_code"] = work_code
        normalized_work_name = normalize_known_work_name(work_name, work_code=work_code)
        if normalized_work_name and normalized_work_name != work_name:
            item["work_name"] = normalized_work_name
            work_name = normalized_work_name

        reference_payload = item.get("reference_payload")
        if not isinstance(reference_payload, dict):
            reference_payload = {}
        reference_payload["normalized_work_name"] = build_normalized_name(work_name)
        reference_payload["labor_norm_applicable"] = applicability.eligible
        reference_payload["labor_norm_scope"] = applicability.scope
        reference_payload["labor_norm_applicability_reason_code"] = applicability.reason_code
        reference_payload["labor_norm_applicability_reason"] = applicability.reason
        reference_payload["labor_norm_item_applicable"] = applicability.eligible
        reference_payload["labor_norm_item_reason_code"] = applicability.reason_code
        reference_payload["labor_norm_item_reason"] = applicability.reason
        if applicability.catalog_name:
            reference_payload["labor_norm_catalog_name"] = applicability.catalog_name
        if applicability.brand_family:
            reference_payload["labor_norm_brand_family"] = applicability.brand_family
        if item.get("standard_hours") is not None:
            try:
                reference_payload["document_standard_hours"] = float(item["standard_hours"])
            except (TypeError, ValueError):
                reference_payload.pop("document_standard_hours", None)

        is_non_catalog_service, non_catalog_reason = classify_known_non_catalog_operation(
            work_code=work_code,
            work_name=work_name,
        )
        if is_non_catalog_service:
            reference_payload["labor_norm_item_applicable"] = False
            reference_payload["labor_norm_item_reason_code"] = "outside_catalog_service"
            reference_payload["labor_norm_item_reason"] = non_catalog_reason
            reference_payload["labor_norm_reference_status"] = "outside_catalog_service"
            reference_payload["labor_norm_next_step"] = build_labor_norm_resolution_hint(
                work_name=work_name,
                reference_status="outside_catalog_service",
            )
            item["reference_payload"] = reference_payload
            notes.append("labor_norm_skip:outside_catalog_service")
            continue

        if not applicability.eligible:
            reference_payload["labor_norm_reference_status"] = "catalog_not_applicable"
            item["reference_payload"] = reference_payload
            continue

        applicable_item_count += 1
        match = find_best_labor_norm_match(
            db,
            work_code=work_code,
            work_name=work_name,
            scope=applicability.scope,
        )
        if match is None:
            reference_payload["labor_norm_reference_status"] = "catalog_gap"
            reference_payload["labor_norm_item_reason_code"] = (
                infer_labor_norm_catalog_gap_reason_code(work_name) or "catalog_gap"
            )
            reference_payload["labor_norm_item_reason"] = (
                infer_labor_norm_catalog_gap_reason(work_name)
                or "работа выглядит осмысленной, но не находится в каталоге нормо-часов"
            )
            reference_payload["labor_norm_next_step"] = build_labor_norm_resolution_hint(
                work_name=work_name,
                reference_status="catalog_gap",
            )
            reference_payload["labor_norm_rewrite_draft"] = build_labor_norm_rewrite_draft(
                work_name=work_name,
                reference_status="catalog_gap",
                document_text=document_text,
            )
            item["reference_payload"] = reference_payload
            unmatched_count += 1
            continue

        if not item.get("work_code"):
            item["work_code"] = match.norm.code
        reference_payload.update(
            {
                "labor_norm_id": match.norm.id,
                "labor_norm_code": match.norm.code,
                "labor_norm_scope": match.norm.scope,
                "labor_norm_catalog_name": match.norm.catalog_name,
                "labor_norm_brand_family": match.norm.brand_family,
                "labor_norm_name": match.norm.name_ru,
                "labor_norm_category": match.norm.category,
                "labor_norm_standard_hours": float(match.norm.standard_hours),
                "labor_norm_match_score": match.score,
                "labor_norm_matched_by": match.matched_by,
                "labor_norm_reference_status": "matched",
            }
        )
        item["reference_payload"] = reference_payload
        notes.append(f"labor_norm_match:{match.norm.code}")
        matched_count += 1

    if works_payload and not applicability.eligible:
        notes.append(f"labor_norm_skipped:{applicability.reason_code}")
    elif applicable_item_count > 0 and matched_count == 0:
        notes.append("labor_norm_match_missing")

    return notes, LaborNormEnrichmentSummary(
        matched_count=matched_count,
        unmatched_count=unmatched_count,
    )
