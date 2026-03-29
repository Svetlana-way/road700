"""Add composite indexes for hot query patterns

Revision ID: 20260329_0016
Revises: 20260329_0015
Create Date: 2026-03-29 19:10:00
"""

from alembic import op


revision = "20260329_0016"
down_revision = "20260329_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_audit_log_created_at_id", "audit_log", ["created_at", "id"])
    op.create_index("ix_import_jobs_created_at_id", "import_jobs", ["created_at", "id"])
    op.create_index(
        "ix_import_conflicts_status_created_at_id",
        "import_conflicts",
        ["status", "created_at", "id"],
    )
    op.create_index(
        "ix_repair_checks_is_resolved_repair_id",
        "repair_checks",
        ["is_resolved", "repair_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_repair_checks_is_resolved_repair_id", table_name="repair_checks")
    op.drop_index("ix_import_conflicts_status_created_at_id", table_name="import_conflicts")
    op.drop_index("ix_import_jobs_created_at_id", table_name="import_jobs")
    op.drop_index("ix_audit_log_created_at_id", table_name="audit_log")
