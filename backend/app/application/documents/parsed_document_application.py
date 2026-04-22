from __future__ import annotations

from app.application.documents import document_matching_access
from app.application.services.service_catalog import resolve_service_by_name


def apply_parsed_document_state(
    db,
    *,
    document,
    text: str,
    extracted_fields: dict,
    extracted_items: dict,
    confidence_map: dict,
    manual_review_reasons: list,
    normalization_notes: list,
):
    document_matching_access.apply_document_metadata_fallbacks(
        document,
        extracted_fields=extracted_fields,
        confidence_map=confidence_map,
        manual_review_reasons=manual_review_reasons,
        normalization_notes=normalization_notes,
    )

    repair = document.repair
    document_matching_access.auto_link_repair_vehicle_from_registry(
        db,
        repair,
        extracted_fields=extracted_fields,
        normalization_notes=normalization_notes,
    )
    if repair.vehicle is not None and repair.vehicle.external_id == document_matching_access.PLACEHOLDER_VEHICLE_EXTERNAL_ID:
        created_vehicle = document_matching_access.auto_create_repair_vehicle_from_document(
            repair,
            document,
            extracted_fields=extracted_fields,
            text=text,
            normalization_notes=normalization_notes,
        )
        if created_vehicle:
            db.add(repair.vehicle)
            db.flush()
            repair.vehicle_id = repair.vehicle.id

    document_matching_access.enrich_vehicle_fields_from_repair(
        repair,
        extracted_fields=extracted_fields,
        confidence_map=confidence_map,
        normalization_notes=normalization_notes,
    )
    document_matching_access.enrich_vehicle_fields_from_registry(
        db,
        extracted_fields=extracted_fields,
        confidence_map=confidence_map,
        normalization_notes=normalization_notes,
    )

    if repair.vehicle is not None and repair.vehicle.external_id == document_matching_access.PLACEHOLDER_VEHICLE_EXTERNAL_ID:
        if extracted_fields.get("plate_number") or extracted_fields.get("vin"):
            document_matching_access.add_manual_review_reason(manual_review_reasons, "vehicle_not_found")
            normalization_notes.append("Техника из документа не найдена в базе и требует ручной привязки.")
        else:
            document_matching_access.add_manual_review_reason(manual_review_reasons, "vehicle_missing")

    labor_norm_applicability = document_matching_access.assess_labor_norm_applicability(db, repair.vehicle)
    labor_norm_notes, labor_norm_summary = document_matching_access.enrich_work_payloads_with_labor_norms(
        db,
        extracted_items["works"],
        labor_norm_applicability,
        text,
    )
    normalization_notes.extend(labor_norm_notes)

    if "order_number" in extracted_fields:
        repair.order_number = str(extracted_fields["order_number"])
    if "repair_date" in extracted_fields:
        parsed_repair_date = document_matching_access.parse_date_value(str(extracted_fields["repair_date"]).replace("-", "."))
        if parsed_repair_date is not None:
            repair.repair_date = parsed_repair_date
    if "mileage" in extracted_fields:
        repair.mileage = int(extracted_fields["mileage"])
    if "reason" in extracted_fields:
        repair.reason = str(extracted_fields["reason"])
    if "employee_comment" in extracted_fields:
        repair.employee_comment = str(extracted_fields["employee_comment"])
    repair.work_total = float(extracted_fields["work_total"]) if "work_total" in extracted_fields else 0.0
    repair.parts_total = float(extracted_fields["parts_total"]) if "parts_total" in extracted_fields else 0.0
    repair.vat_total = float(extracted_fields["vat_total"]) if "vat_total" in extracted_fields else 0.0
    repair.grand_total = float(extracted_fields["grand_total"]) if "grand_total" in extracted_fields else 0.0

    if "service_name" in extracted_fields:
        service = resolve_service_by_name(db, str(extracted_fields["service_name"]))
        if service is not None:
            extracted_fields["service_name"] = service.name
            repair.service_id = service.id
            document_matching_access.remove_manual_review_reason(manual_review_reasons, "service_not_found")
        else:
            document_matching_access.add_manual_review_reason(manual_review_reasons, "service_not_found")
            normalization_notes.append(
                f"Сервис из документа не найден в справочнике: {extracted_fields['service_name']}"
            )
        document_matching_access.remove_manual_review_reason(manual_review_reasons, "service_name_missing")
    else:
        document_matching_access.add_manual_review_reason(manual_review_reasons, "service_name_missing")

    return labor_norm_applicability, labor_norm_summary
