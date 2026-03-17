"""Add OCR profile matchers

Revision ID: 20260317_0009
Revises: 20260317_0008
Create Date: 2026-03-17 17:15:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_0009"
down_revision = "20260317_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ocr_profile_matchers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_scope", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=True),
        sa.Column("filename_pattern", sa.Text(), nullable=True),
        sa.Column("text_pattern", sa.Text(), nullable=True),
        sa.Column("service_name_pattern", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ocr_profile_matchers_profile_scope", "ocr_profile_matchers", ["profile_scope"], unique=False)
    op.create_index("ix_ocr_profile_matchers_source_type", "ocr_profile_matchers", ["source_type"], unique=False)
    op.create_index("ix_ocr_profile_matchers_priority", "ocr_profile_matchers", ["priority"], unique=False)
    op.create_index("ix_ocr_profile_matchers_is_active", "ocr_profile_matchers", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ocr_profile_matchers_is_active", table_name="ocr_profile_matchers")
    op.drop_index("ix_ocr_profile_matchers_priority", table_name="ocr_profile_matchers")
    op.drop_index("ix_ocr_profile_matchers_source_type", table_name="ocr_profile_matchers")
    op.drop_index("ix_ocr_profile_matchers_profile_scope", table_name="ocr_profile_matchers")
    op.drop_table("ocr_profile_matchers")
