"""Add labor norm scopes

Revision ID: 20260317_0005
Revises: 20260316_0004
Create Date: 2026-03-17 09:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_0005"
down_revision = "20260316_0004"
branch_labels = None
depends_on = None


DEFAULT_SCOPE = "dongfeng_2025"
DEFAULT_BRAND_FAMILY = "dongfeng"
DEFAULT_CATALOG_NAME = "Dong Feng 2025"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("labor_norms", recreate="always") as batch_op:
            batch_op.drop_constraint("uq_labor_norms_code", type_="unique")
            batch_op.add_column(
                sa.Column("scope", sa.String(length=64), nullable=False, server_default=DEFAULT_SCOPE)
            )
            batch_op.add_column(sa.Column("brand_family", sa.String(length=64), nullable=True))
            batch_op.add_column(sa.Column("catalog_name", sa.String(length=255), nullable=True))
            batch_op.create_index("ix_labor_norms_scope", ["scope"], unique=False)
            batch_op.create_index("ix_labor_norms_brand_family", ["brand_family"], unique=False)
            batch_op.create_unique_constraint("uq_labor_norms_scope_code", ["scope", "code"])
    else:
        op.drop_constraint("uq_labor_norms_code", "labor_norms", type_="unique")
        op.add_column("labor_norms", sa.Column("scope", sa.String(length=64), nullable=False, server_default=DEFAULT_SCOPE))
        op.add_column("labor_norms", sa.Column("brand_family", sa.String(length=64), nullable=True))
        op.add_column("labor_norms", sa.Column("catalog_name", sa.String(length=255), nullable=True))
        op.create_index("ix_labor_norms_scope", "labor_norms", ["scope"], unique=False)
        op.create_index("ix_labor_norms_brand_family", "labor_norms", ["brand_family"], unique=False)
        op.create_unique_constraint("uq_labor_norms_scope_code", "labor_norms", ["scope", "code"])

    bind.execute(
        sa.text(
            """
            UPDATE labor_norms
            SET scope = :scope,
                brand_family = :brand_family,
                catalog_name = :catalog_name
            WHERE scope IS NULL
               OR scope = ''
               OR brand_family IS NULL
               OR catalog_name IS NULL
            """
        ),
        {
            "scope": DEFAULT_SCOPE,
            "brand_family": DEFAULT_BRAND_FAMILY,
            "catalog_name": DEFAULT_CATALOG_NAME,
        },
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("labor_norms", recreate="always") as batch_op:
            batch_op.drop_constraint("uq_labor_norms_scope_code", type_="unique")
            batch_op.drop_index("ix_labor_norms_brand_family")
            batch_op.drop_index("ix_labor_norms_scope")
            batch_op.drop_column("catalog_name")
            batch_op.drop_column("brand_family")
            batch_op.drop_column("scope")
            batch_op.create_unique_constraint("uq_labor_norms_code", ["code"])
    else:
        op.drop_constraint("uq_labor_norms_scope_code", "labor_norms", type_="unique")
        op.drop_index("ix_labor_norms_brand_family", table_name="labor_norms")
        op.drop_index("ix_labor_norms_scope", table_name="labor_norms")
        op.drop_column("labor_norms", "catalog_name")
        op.drop_column("labor_norms", "brand_family")
        op.drop_column("labor_norms", "scope")
        op.create_unique_constraint("uq_labor_norms_code", "labor_norms", ["code"])
