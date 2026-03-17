"""Initial schema

Revision ID: 20260316_0001
Revises: None
Create Date: 2026-03-16 12:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260316_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role = postgresql.ENUM("ADMIN", "EMPLOYEE", name="userrole", create_type=False, _create_events=False)
vehicle_type = postgresql.ENUM("TRUCK", "TRAILER", name="vehicletype", create_type=False, _create_events=False)
vehicle_status = postgresql.ENUM(
    "ACTIVE",
    "IN_REPAIR",
    "WAITING_REPAIR",
    "INACTIVE",
    "DECOMMISSIONED",
    "ARCHIVED",
    name="vehiclestatus",
    create_type=False,
    _create_events=False,
)
service_status = postgresql.ENUM(
    "PRELIMINARY",
    "CONFIRMED",
    "ARCHIVED",
    name="servicestatus",
    create_type=False,
    _create_events=False,
)
document_status = postgresql.ENUM(
    "UPLOADED",
    "RECOGNIZED",
    "PARTIALLY_RECOGNIZED",
    "NEEDS_REVIEW",
    "CONFIRMED",
    "OCR_ERROR",
    "ARCHIVED",
    name="documentstatus",
    create_type=False,
    _create_events=False,
)
repair_status = postgresql.ENUM(
    "DRAFT",
    "IN_REVIEW",
    "EMPLOYEE_CONFIRMED",
    "SUSPICIOUS",
    "CONFIRMED",
    "OCR_ERROR",
    "ARCHIVED",
    name="repairstatus",
    create_type=False,
    _create_events=False,
)
catalog_status = postgresql.ENUM(
    "PRELIMINARY",
    "CONFIRMED",
    "MERGED",
    "ARCHIVED",
    name="catalogstatus",
    create_type=False,
    _create_events=False,
)
check_severity = postgresql.ENUM(
    "NORMAL",
    "WARNING",
    "SUSPICIOUS",
    "ERROR",
    name="checkseverity",
    create_type=False,
    _create_events=False,
)
import_status = postgresql.ENUM(
    "DRAFT",
    "PROCESSING",
    "COMPLETED",
    "COMPLETED_WITH_CONFLICTS",
    "FAILED",
    name="importstatus",
    create_type=False,
    _create_events=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    vehicle_type.create(bind, checkfirst=True)
    vehicle_status.create(bind, checkfirst=True)
    service_status.create(bind, checkfirst=True)
    document_status.create(bind, checkfirst=True)
    repair_status.create(bind, checkfirst=True)
    catalog_status.create(bind, checkfirst=True)
    check_severity.create(bind, checkfirst=True)
    import_status.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("login", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("login", name="uq_users_login"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_login", "users", ["login"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.String(length=100), nullable=True),
        sa.Column("vehicle_type", vehicle_type, nullable=False),
        sa.Column("vin", sa.String(length=64), nullable=True),
        sa.Column("plate_number", sa.String(length=32), nullable=True),
        sa.Column("brand", sa.String(length=120), nullable=True),
        sa.Column("model", sa.String(length=255), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("column_name", sa.String(length=100), nullable=True),
        sa.Column("mechanic_name", sa.String(length=255), nullable=True),
        sa.Column("current_driver_name", sa.String(length=255), nullable=True),
        sa.Column("last_coordinates_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("source_payload", sa.JSON(), nullable=True),
        sa.Column("status", vehicle_status, nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_vehicles_external_id", "vehicles", ["external_id"])
    op.create_index("ix_vehicles_vehicle_type", "vehicles", ["vehicle_type"])
    op.create_index("ix_vehicles_vin", "vehicles", ["vin"])
    op.create_index("ix_vehicles_plate_number", "vehicles", ["plate_number"])
    op.create_index("ix_vehicles_status", "vehicles", ["status"])

    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("contact", sa.String(length=255), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("status", service_status, nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("confirmed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_services_name", "services", ["name"])
    op.create_index("ix_services_status", "services", ["status"])

    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("import_type", sa.String(length=100), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("status", import_status, nullable=False),
        sa.Column("summary", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_import_jobs_import_type", "import_jobs", ["import_type"])
    op.create_index("ix_import_jobs_status", "import_jobs", ["status"])

    op.create_table(
        "repairs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_number", sa.String(length=100), nullable=True),
        sa.Column("repair_date", sa.Date(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id"), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("source_document_id", sa.Integer(), nullable=True),
        sa.Column("mileage", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("employee_comment", sa.Text(), nullable=True),
        sa.Column("work_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("parts_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("vat_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("grand_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("expected_total", sa.Numeric(14, 2), nullable=True),
        sa.Column("status", repair_status, nullable=False),
        sa.Column("is_preliminary", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_partially_recognized", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_manually_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_repairs_order_number", "repairs", ["order_number"])
    op.create_index("ix_repairs_repair_date", "repairs", ["repair_date"])
    op.create_index("ix_repairs_vehicle_id", "repairs", ["vehicle_id"])
    op.create_index("ix_repairs_service_id", "repairs", ["service_id"])
    op.create_index("ix_repairs_status", "repairs", ["status"])

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repair_id", sa.Integer(), sa.ForeignKey("repairs.id"), nullable=True),
        sa.Column("uploaded_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("status", document_status, nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
        sa.Column("review_queue_priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("storage_key", name="uq_documents_storage_key"),
    )
    op.create_index("ix_documents_repair_id", "documents", ["repair_id"])
    op.create_index("ix_documents_status", "documents", ["status"])

    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_repairs_source_document_id_documents",
            "repairs",
            "documents",
            ["source_document_id"],
            ["id"],
        )

    op.create_table(
        "document_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("parsed_payload", sa.JSON(), nullable=True),
        sa.Column("field_confidence_map", sa.JSON(), nullable=True),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_document_versions_document_id", "document_versions", ["document_id"])

    op.create_table(
        "vehicle_assignment_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("starts_at", sa.Date(), nullable=False),
        sa.Column("ends_at", sa.Date(), nullable=True),
        sa.Column("assigned_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
    )
    op.create_index("ix_vehicle_assignment_history_vehicle_id", "vehicle_assignment_history", ["vehicle_id"])
    op.create_index("ix_vehicle_assignment_history_user_id", "vehicle_assignment_history", ["user_id"])

    op.create_table(
        "vehicle_link_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("left_vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("right_vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id"), nullable=False),
        sa.Column("starts_at", sa.Date(), nullable=False),
        sa.Column("ends_at", sa.Date(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
    )
    op.create_index("ix_vehicle_link_history_left_vehicle_id", "vehicle_link_history", ["left_vehicle_id"])
    op.create_index("ix_vehicle_link_history_right_vehicle_id", "vehicle_link_history", ["right_vehicle_id"])

    op.create_table(
        "repair_works",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repair_id", sa.Integer(), sa.ForeignKey("repairs.id"), nullable=False),
        sa.Column("work_code", sa.String(length=100), nullable=True),
        sa.Column("work_name", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="1"),
        sa.Column("standard_hours", sa.Float(), nullable=True),
        sa.Column("actual_hours", sa.Float(), nullable=True),
        sa.Column("price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("status", catalog_status, nullable=False),
        sa.Column("reference_payload", sa.JSON(), nullable=True),
    )
    op.create_index("ix_repair_works_repair_id", "repair_works", ["repair_id"])
    op.create_index("ix_repair_works_work_code", "repair_works", ["work_code"])

    op.create_table(
        "repair_parts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repair_id", sa.Integer(), sa.ForeignKey("repairs.id"), nullable=False),
        sa.Column("article", sa.String(length=120), nullable=True),
        sa.Column("part_name", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False, server_default="1"),
        sa.Column("unit_name", sa.String(length=50), nullable=True),
        sa.Column("price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("status", catalog_status, nullable=False),
    )
    op.create_index("ix_repair_parts_repair_id", "repair_parts", ["repair_id"])
    op.create_index("ix_repair_parts_article", "repair_parts", ["article"])

    op.create_table(
        "repair_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repair_id", sa.Integer(), sa.ForeignKey("repairs.id"), nullable=False),
        sa.Column("check_type", sa.String(length=100), nullable=False),
        sa.Column("severity", check_severity, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("calculation_payload", sa.JSON(), nullable=True),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_repair_checks_repair_id", "repair_checks", ["repair_id"])
    op.create_index("ix_repair_checks_check_type", "repair_checks", ["check_type"])
    op.create_index("ix_repair_checks_severity", "repair_checks", ["severity"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.JSON(), nullable=True),
        sa.Column("new_value", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_entity_type", "audit_log", ["entity_type"])
    op.create_index("ix_audit_log_entity_id", "audit_log", ["entity_id"])
    op.create_index("ix_audit_log_action_type", "audit_log", ["action_type"])

    op.create_table(
        "import_conflicts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("import_job_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("conflict_key", sa.String(length=255), nullable=False),
        sa.Column("incoming_payload", sa.JSON(), nullable=True),
        sa.Column("existing_payload", sa.JSON(), nullable=True),
        sa.Column("resolution_payload", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_import_conflicts_import_job_id", "import_conflicts", ["import_job_id"])
    op.create_index("ix_import_conflicts_entity_type", "import_conflicts", ["entity_type"])
    op.create_index("ix_import_conflicts_conflict_key", "import_conflicts", ["conflict_key"])


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_import_conflicts_conflict_key", table_name="import_conflicts")
    op.drop_index("ix_import_conflicts_entity_type", table_name="import_conflicts")
    op.drop_index("ix_import_conflicts_import_job_id", table_name="import_conflicts")
    op.drop_table("import_conflicts")

    op.drop_index("ix_audit_log_action_type", table_name="audit_log")
    op.drop_index("ix_audit_log_entity_id", table_name="audit_log")
    op.drop_index("ix_audit_log_entity_type", table_name="audit_log")
    op.drop_index("ix_audit_log_user_id", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_index("ix_repair_checks_severity", table_name="repair_checks")
    op.drop_index("ix_repair_checks_check_type", table_name="repair_checks")
    op.drop_index("ix_repair_checks_repair_id", table_name="repair_checks")
    op.drop_table("repair_checks")

    op.drop_index("ix_repair_parts_article", table_name="repair_parts")
    op.drop_index("ix_repair_parts_repair_id", table_name="repair_parts")
    op.drop_table("repair_parts")

    op.drop_index("ix_repair_works_work_code", table_name="repair_works")
    op.drop_index("ix_repair_works_repair_id", table_name="repair_works")
    op.drop_table("repair_works")

    op.drop_index("ix_vehicle_link_history_right_vehicle_id", table_name="vehicle_link_history")
    op.drop_index("ix_vehicle_link_history_left_vehicle_id", table_name="vehicle_link_history")
    op.drop_table("vehicle_link_history")

    op.drop_index("ix_vehicle_assignment_history_user_id", table_name="vehicle_assignment_history")
    op.drop_index("ix_vehicle_assignment_history_vehicle_id", table_name="vehicle_assignment_history")
    op.drop_table("vehicle_assignment_history")

    op.drop_index("ix_document_versions_document_id", table_name="document_versions")
    op.drop_table("document_versions")

    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_repairs_source_document_id_documents", "repairs", type_="foreignkey")
    op.drop_index("ix_documents_status", table_name="documents")
    op.drop_index("ix_documents_repair_id", table_name="documents")
    op.drop_table("documents")

    op.drop_index("ix_repairs_status", table_name="repairs")
    op.drop_index("ix_repairs_service_id", table_name="repairs")
    op.drop_index("ix_repairs_vehicle_id", table_name="repairs")
    op.drop_index("ix_repairs_repair_date", table_name="repairs")
    op.drop_index("ix_repairs_order_number", table_name="repairs")
    op.drop_table("repairs")

    op.drop_index("ix_import_jobs_status", table_name="import_jobs")
    op.drop_index("ix_import_jobs_import_type", table_name="import_jobs")
    op.drop_table("import_jobs")

    op.drop_index("ix_services_status", table_name="services")
    op.drop_index("ix_services_name", table_name="services")
    op.drop_table("services")

    op.drop_index("ix_vehicles_status", table_name="vehicles")
    op.drop_index("ix_vehicles_plate_number", table_name="vehicles")
    op.drop_index("ix_vehicles_vin", table_name="vehicles")
    op.drop_index("ix_vehicles_vehicle_type", table_name="vehicles")
    op.drop_index("ix_vehicles_external_id", table_name="vehicles")
    op.drop_table("vehicles")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_login", table_name="users")
    op.drop_table("users")

    import_status.drop(bind, checkfirst=True)
    check_severity.drop(bind, checkfirst=True)
    catalog_status.drop(bind, checkfirst=True)
    repair_status.drop(bind, checkfirst=True)
    document_status.drop(bind, checkfirst=True)
    service_status.drop(bind, checkfirst=True)
    vehicle_status.drop(bind, checkfirst=True)
    vehicle_type.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
