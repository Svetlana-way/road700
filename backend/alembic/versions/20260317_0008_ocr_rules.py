"""Add OCR extraction rules

Revision ID: 20260317_0008
Revises: 20260317_0007
Create Date: 2026-03-17 16:05:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_0008"
down_revision = "20260317_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ocr_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_scope", sa.String(length=64), nullable=False, server_default="default"),
        sa.Column("target_field", sa.String(length=64), nullable=False),
        sa.Column("pattern", sa.Text(), nullable=False),
        sa.Column("value_parser", sa.String(length=32), nullable=False, server_default="raw"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.6"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("profile_scope", "target_field", "pattern", name="uq_ocr_rules_profile_field_pattern"),
    )
    op.create_index("ix_ocr_rules_profile_scope", "ocr_rules", ["profile_scope"], unique=False)
    op.create_index("ix_ocr_rules_target_field", "ocr_rules", ["target_field"], unique=False)
    op.create_index("ix_ocr_rules_value_parser", "ocr_rules", ["value_parser"], unique=False)
    op.create_index("ix_ocr_rules_priority", "ocr_rules", ["priority"], unique=False)
    op.create_index("ix_ocr_rules_is_active", "ocr_rules", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ocr_rules_is_active", table_name="ocr_rules")
    op.drop_index("ix_ocr_rules_priority", table_name="ocr_rules")
    op.drop_index("ix_ocr_rules_value_parser", table_name="ocr_rules")
    op.drop_index("ix_ocr_rules_target_field", table_name="ocr_rules")
    op.drop_index("ix_ocr_rules_profile_scope", table_name="ocr_rules")
    op.drop_table("ocr_rules")
