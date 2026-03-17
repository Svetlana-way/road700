"""Add OCR learning signals

Revision ID: 20260317_0010
Revises: 20260317_0009
Create Date: 2026-03-17 18:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_0010"
down_revision = "20260317_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ocr_learning_signals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("repair_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("document_version_id", sa.Integer(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("signal_type", sa.String(length=32), nullable=False),
        sa.Column("target_field", sa.String(length=64), nullable=False),
        sa.Column("ocr_profile_scope", sa.String(length=64), nullable=True),
        sa.Column("extracted_value", sa.Text(), nullable=True),
        sa.Column("corrected_value", sa.Text(), nullable=False),
        sa.Column("service_name", sa.String(length=255), nullable=True),
        sa.Column("source_type", sa.String(length=32), nullable=True),
        sa.Column("document_filename", sa.String(length=255), nullable=True),
        sa.Column("text_excerpt", sa.Text(), nullable=True),
        sa.Column("suggestion_summary", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="new"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["repair_id"], ["repairs.id"]),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["document_version_id"], ["document_versions.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
    )
    op.create_index("ix_ocr_learning_signals_repair_id", "ocr_learning_signals", ["repair_id"], unique=False)
    op.create_index("ix_ocr_learning_signals_document_id", "ocr_learning_signals", ["document_id"], unique=False)
    op.create_index("ix_ocr_learning_signals_document_version_id", "ocr_learning_signals", ["document_version_id"], unique=False)
    op.create_index("ix_ocr_learning_signals_created_by_user_id", "ocr_learning_signals", ["created_by_user_id"], unique=False)
    op.create_index("ix_ocr_learning_signals_signal_type", "ocr_learning_signals", ["signal_type"], unique=False)
    op.create_index("ix_ocr_learning_signals_target_field", "ocr_learning_signals", ["target_field"], unique=False)
    op.create_index("ix_ocr_learning_signals_ocr_profile_scope", "ocr_learning_signals", ["ocr_profile_scope"], unique=False)
    op.create_index("ix_ocr_learning_signals_status", "ocr_learning_signals", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ocr_learning_signals_status", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_ocr_profile_scope", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_target_field", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_signal_type", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_created_by_user_id", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_document_version_id", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_document_id", table_name="ocr_learning_signals")
    op.drop_index("ix_ocr_learning_signals_repair_id", table_name="ocr_learning_signals")
    op.drop_table("ocr_learning_signals")
