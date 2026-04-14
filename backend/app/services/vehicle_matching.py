from app.application.documents.vehicle_matching import (
    auto_create_repair_vehicle_from_document,
    auto_link_repair_vehicle_from_registry,
    enrich_vehicle_fields_from_registry,
    extract_vehicle_brand_model_from_document_text,
    extract_vehicle_year_from_document_text,
    find_vehicle_by_identifiers,
    infer_vehicle_type_from_document_text,
)

__all__ = [
    "auto_create_repair_vehicle_from_document",
    "auto_link_repair_vehicle_from_registry",
    "enrich_vehicle_fields_from_registry",
    "extract_vehicle_brand_model_from_document_text",
    "extract_vehicle_year_from_document_text",
    "find_vehicle_by_identifiers",
    "infer_vehicle_type_from_document_text",
]
