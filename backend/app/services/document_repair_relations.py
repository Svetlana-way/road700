from app.application.documents.repair_relations import (
    PRIMARY_DOCUMENT_KINDS,
    PRIMARY_DOCUMENT_KIND_VALUES,
    assign_primary_document,
    build_canonical_source_document_id_expr,
    choose_primary_document_candidate,
    ensure_repair_vehicle_relation,
    get_document_recency_key,
    get_repair_source_document,
    is_document_primary_eligible,
    normalize_repair_primary_document,
    order_repair_documents_by_source_priority,
)
