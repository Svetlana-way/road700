"""Add document reference to import jobs

Revision ID: 20260316_0002
Revises: 20260316_0001
Create Date: 2026-03-16 19:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260316_0002"
down_revision = "20260316_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("import_jobs") as batch_op:
        batch_op.add_column(sa.Column("document_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_import_jobs_document_id", ["document_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("import_jobs") as batch_op:
        batch_op.drop_index("ix_import_jobs_document_id")
        batch_op.drop_column("document_id")
