"""Normalize user emails to lowercase

Revision ID: 20260317_0012
Revises: 20260317_0011
Create Date: 2026-03-17 22:35:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_0012"
down_revision = "20260317_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    duplicate_pairs = connection.execute(
        sa.text(
            """
            select lower(email) as normalized_email, count(*)
            from users
            group by lower(email)
            having count(*) > 1
            """
        )
    ).fetchall()
    if duplicate_pairs:
        duplicates = ", ".join(str(row[0]) for row in duplicate_pairs)
        raise RuntimeError(f"Cannot normalize duplicate emails differing only by case: {duplicates}")

    connection.execute(sa.text("update users set email = lower(email) where email <> lower(email)"))


def downgrade() -> None:
    pass
