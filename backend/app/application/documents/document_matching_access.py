from __future__ import annotations

from app.application.documents.legacy_overrides import call_document_processing_override
from app.application.documents.document_metadata import (
    add_manual_review_reason,
    apply_document_metadata_fallbacks,
    enrich_vehicle_fields_from_repair,
    remove_manual_review_reason,
)
from app.application.documents.text_utils import parse_date_value
from app.application.documents.config import PLACEHOLDER_VEHICLE_EXTERNAL_ID
from app.application.services.labor_norm_enrichment import (
    enrich_work_payloads_with_labor_norms as enrich_work_payloads_with_labor_norms_default,
)
from app.application.services.labor_norms import assess_labor_norm_applicability as assess_labor_norm_applicability_default
from app.application.documents.vehicle_matching import (
    auto_create_repair_vehicle_from_document,
    auto_link_repair_vehicle_from_registry,
    enrich_vehicle_fields_from_registry,
)


def assess_labor_norm_applicability(db, vehicle):
    return call_document_processing_override(
        "assess_labor_norm_applicability",
        assess_labor_norm_applicability_default,
        db,
        vehicle,
    )


def enrich_work_payloads_with_labor_norms(db, works_payload, labor_norm_applicability, document_text=None):
    return call_document_processing_override(
        "enrich_work_payloads_with_labor_norms",
        enrich_work_payloads_with_labor_norms_default,
        db,
        works_payload,
        labor_norm_applicability,
        document_text,
    )
