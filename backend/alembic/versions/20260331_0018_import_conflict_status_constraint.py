"""Normalize import conflict statuses and add DB constraint

Revision ID: 20260331_0018
Revises: 20260329_0017
Create Date: 2026-03-31 11:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260331_0018"
down_revision = "20260329_0017"
branch_labels = None
depends_on = None


ALLOWED_IMPORT_CONFLICT_STATUSES = ("pending", "resolved", "ignored")


def _normalize_import_conflict_statuses() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            update import_conflicts
            set status = lower(trim(status)),
                updated_at = current_timestamp
            where status is not null
              and status != lower(trim(status))
            """
        )
    )
    connection.execute(
        sa.text(
            """
            update import_conflicts
            set status = 'pending',
                updated_at = current_timestamp
            where status is null
               or trim(status) = ''
               or lower(trim(status)) not in ('pending', 'resolved', 'ignored')
            """
        )
    )


def upgrade() -> None:
    _normalize_import_conflict_statuses()

    with op.batch_alter_table("import_conflicts") as batch_op:
        batch_op.create_check_constraint(
            "ck_import_conflicts_status_valid",
            f"status IN {ALLOWED_IMPORT_CONFLICT_STATUSES}",
        )


def downgrade() -> None:
    with op.batch_alter_table("import_conflicts") as batch_op:
        batch_op.drop_constraint("ck_import_conflicts_status_valid", type_="check")
