"""Add composite indexes for document hot paths

Revision ID: 20260331_0020
Revises: 20260331_0019
Create Date: 2026-03-31 13:25:00
"""

from alembic import op


revision = "20260331_0020"
down_revision = "20260331_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_documents_status_created_at_id",
        "documents",
        ["status", "created_at", "id"],
    )
    op.create_index(
        "ix_documents_review_queue_priority_updated_at_id",
        "documents",
        ["review_queue_priority", "updated_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_documents_review_queue_priority_updated_at_id", table_name="documents")
    op.drop_index("ix_documents_status_created_at_id", table_name="documents")
