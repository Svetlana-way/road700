"""Add labor norm catalogs

Revision ID: 20260317_0006
Revises: 20260317_0005
Create Date: 2026-03-17 12:10:00
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260317_0006"
down_revision = "20260317_0005"
branch_labels = None
depends_on = None


catalog_status = sa.Enum("PRELIMINARY", "CONFIRMED", "MERGED", "ARCHIVED", name="catalogstatus")
vehicle_type = sa.Enum("TRUCK", "TRAILER", name="vehicletype")

DEFAULT_SCOPE = "dongfeng_2025"
DEFAULT_BRAND_FAMILY = "dongfeng"
DEFAULT_CATALOG_NAME = "Dong Feng 2025"


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "labor_norm_catalogs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope", sa.String(length=64), nullable=False),
        sa.Column("catalog_name", sa.String(length=255), nullable=False),
        sa.Column("brand_family", sa.String(length=64), nullable=True),
        sa.Column(
            "vehicle_type",
            vehicle_type if bind.dialect.name != "sqlite" else sa.String(length=32),
            nullable=True,
        ),
        sa.Column("year_from", sa.Integer(), nullable=True),
        sa.Column("year_to", sa.Integer(), nullable=True),
        sa.Column("brand_keywords", sa.JSON(), nullable=True),
        sa.Column("model_keywords", sa.JSON(), nullable=True),
        sa.Column("vin_prefixes", sa.JSON(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("auto_match_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "status",
            catalog_status if bind.dialect.name != "sqlite" else sa.String(length=32),
            nullable=False,
            server_default="CONFIRMED",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("scope", name="uq_labor_norm_catalogs_scope"),
    )
    op.create_index("ix_labor_norm_catalogs_scope", "labor_norm_catalogs", ["scope"], unique=False)
    op.create_index("ix_labor_norm_catalogs_brand_family", "labor_norm_catalogs", ["brand_family"], unique=False)
    op.create_index("ix_labor_norm_catalogs_vehicle_type", "labor_norm_catalogs", ["vehicle_type"], unique=False)
    op.create_index("ix_labor_norm_catalogs_priority", "labor_norm_catalogs", ["priority"], unique=False)
    op.create_index("ix_labor_norm_catalogs_auto_match_enabled", "labor_norm_catalogs", ["auto_match_enabled"], unique=False)
    op.create_index("ix_labor_norm_catalogs_status", "labor_norm_catalogs", ["status"], unique=False)

    rows = bind.execute(
        sa.text(
            """
            SELECT scope, brand_family, catalog_name
            FROM labor_norms
            GROUP BY scope, brand_family, catalog_name
            ORDER BY scope
            """
        )
    ).fetchall()

    for row in rows:
        scope = row[0]
        brand_family = row[1]
        catalog_name = row[2] or scope
        is_default_scope = scope == DEFAULT_SCOPE
        bind.execute(
            sa.text(
                """
                INSERT INTO labor_norm_catalogs (
                    scope,
                    catalog_name,
                    brand_family,
                    vehicle_type,
                    year_from,
                    year_to,
                    brand_keywords,
                    model_keywords,
                    vin_prefixes,
                    priority,
                    auto_match_enabled,
                    status,
                    notes
                )
                VALUES (
                    :scope,
                    :catalog_name,
                    :brand_family,
                    :vehicle_type,
                    :year_from,
                    :year_to,
                    :brand_keywords,
                    :model_keywords,
                    :vin_prefixes,
                    :priority,
                    :auto_match_enabled,
                    :status,
                    :notes
                )
                """
            ),
            {
                "scope": scope,
                "catalog_name": catalog_name,
                "brand_family": brand_family or (DEFAULT_BRAND_FAMILY if is_default_scope else None),
                "vehicle_type": "TRUCK" if is_default_scope else None,
                "year_from": None,
                "year_to": None,
                "brand_keywords": json.dumps(["dongfeng", "dfh4180"]) if is_default_scope else json.dumps([]),
                "model_keywords": json.dumps(["тягач"]) if is_default_scope else json.dumps([]),
                "vin_prefixes": json.dumps(["LGAG3DV2"]) if is_default_scope else json.dumps([]),
                "priority": 100 if is_default_scope else 200,
                "auto_match_enabled": is_default_scope,
                "status": "CONFIRMED",
                "notes": (
                    "Создано автоматически из существующего каталога Dong Feng с базовыми правилами применимости."
                    if is_default_scope
                    else "Создано автоматически из ранее импортированного scope. Перед авто-матчингом заполните правила применимости."
                ),
            },
        )


def downgrade() -> None:
    op.drop_index("ix_labor_norm_catalogs_status", table_name="labor_norm_catalogs")
    op.drop_index("ix_labor_norm_catalogs_auto_match_enabled", table_name="labor_norm_catalogs")
    op.drop_index("ix_labor_norm_catalogs_priority", table_name="labor_norm_catalogs")
    op.drop_index("ix_labor_norm_catalogs_vehicle_type", table_name="labor_norm_catalogs")
    op.drop_index("ix_labor_norm_catalogs_brand_family", table_name="labor_norm_catalogs")
    op.drop_index("ix_labor_norm_catalogs_scope", table_name="labor_norm_catalogs")
    op.drop_table("labor_norm_catalogs")
