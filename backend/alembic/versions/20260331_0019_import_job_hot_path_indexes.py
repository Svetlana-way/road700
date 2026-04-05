"""Add composite index for import job hot paths

Revision ID: 20260331_0019
Revises: 20260331_0018
Create Date: 2026-03-31 12:25:00
"""

from alembic import op


revision = "20260331_0019"
down_revision = "20260331_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_import_jobs_import_type_status_created_at_id",
        "import_jobs",
        ["import_type", "status", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_import_jobs_import_type_status_created_at_id", table_name="import_jobs")
