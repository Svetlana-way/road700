"""Extend import jobs for queued document processing

Revision ID: 20260319_0013
Revises: 20260317_0012
Create Date: 2026-03-19 13:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260319_0013"
down_revision = "20260317_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'QUEUED'")
        op.execute("ALTER TYPE importstatus ADD VALUE IF NOT EXISTS 'RETRY'")

    with op.batch_alter_table("import_jobs") as batch_op:
        batch_op.add_column(sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("import_jobs") as batch_op:
        batch_op.drop_column("finished_at")
        batch_op.drop_column("started_at")
        batch_op.drop_column("attempts")
