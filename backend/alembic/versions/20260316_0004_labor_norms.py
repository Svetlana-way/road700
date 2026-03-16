"""Add labor norms catalog

Revision ID: 20260316_0004
Revises: 20260316_0003
Create Date: 2026-03-16 23:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260316_0004"
down_revision = "20260316_0003"
branch_labels = None
depends_on = None


catalog_status = sa.Enum("PRELIMINARY", "CONFIRMED", "MERGED", "ARCHIVED", name="catalogstatus")


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "labor_norms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("name_ru", sa.String(length=500), nullable=False),
        sa.Column("name_ru_alt", sa.String(length=500), nullable=True),
        sa.Column("name_cn", sa.String(length=500), nullable=True),
        sa.Column("name_en", sa.String(length=500), nullable=True),
        sa.Column("normalized_name", sa.String(length=500), nullable=False),
        sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column("standard_hours", sa.Float(), nullable=False),
        sa.Column("source_sheet", sa.String(length=120), nullable=True),
        sa.Column("source_file", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            catalog_status if bind.dialect.name != "sqlite" else sa.String(length=32),
            nullable=False,
            server_default="CONFIRMED",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_labor_norms_code"),
    )
    op.create_index("ix_labor_norms_code", "labor_norms", ["code"], unique=False)
    op.create_index("ix_labor_norms_category", "labor_norms", ["category"], unique=False)
    op.create_index("ix_labor_norms_normalized_name", "labor_norms", ["normalized_name"], unique=False)
    op.create_index("ix_labor_norms_status", "labor_norms", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_labor_norms_status", table_name="labor_norms")
    op.drop_index("ix_labor_norms_normalized_name", table_name="labor_norms")
    op.drop_index("ix_labor_norms_category", table_name="labor_norms")
    op.drop_index("ix_labor_norms_code", table_name="labor_norms")
    op.drop_table("labor_norms")
