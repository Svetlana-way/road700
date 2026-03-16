"""Add document kind

Revision ID: 20260316_0003
Revises: 20260316_0002
Create Date: 2026-03-16 22:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260316_0003"
down_revision = "20260316_0002"
branch_labels = None
depends_on = None


document_kind = sa.Enum(
    "ORDER",
    "REPEAT_SCAN",
    "ATTACHMENT",
    "CONFIRMATION",
    name="documentkind",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        document_kind.create(bind, checkfirst=True)

    with op.batch_alter_table("documents") as batch_op:
        batch_op.add_column(
            sa.Column(
                "kind",
                document_kind if bind.dialect.name != "sqlite" else sa.String(length=32),
                nullable=False,
                server_default="ORDER",
            )
        )
        batch_op.create_index("ix_documents_kind", ["kind"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    with op.batch_alter_table("documents") as batch_op:
        batch_op.drop_index("ix_documents_kind")
        batch_op.drop_column("kind")

    if bind.dialect.name != "sqlite":
        document_kind.drop(bind, checkfirst=True)
