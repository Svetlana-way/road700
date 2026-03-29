"""Heal repair source document drift and align SQLite FK

Revision ID: 20260329_0017
Revises: 20260329_0016
Create Date: 2026-03-29 20:15:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260329_0017"
down_revision = "20260329_0016"
branch_labels = None
depends_on = None


PRIMARY_DOCUMENT_KINDS = {"ORDER", "REPEAT_SCAN"}


def _choose_replacement_source_document(document_rows: list[sa.RowMapping]) -> int | None:
    eligible_rows = [
        row
        for row in document_rows
        if row["kind"] in PRIMARY_DOCUMENT_KINDS and row["status"] != "ARCHIVED"
    ]
    if not eligible_rows:
        return None

    primary_rows = [row for row in eligible_rows if bool(row["is_primary"])]
    candidate_rows = primary_rows or eligible_rows
    chosen = max(candidate_rows, key=lambda row: (row["created_at"], row["id"]))
    return int(chosen["id"])


def _heal_invalid_repair_source_document_refs() -> None:
    connection = op.get_bind()
    invalid_repairs = connection.execute(
        sa.text(
            """
            select repairs.id
            from repairs
            left join documents source_document
                on source_document.id = repairs.source_document_id
            where repairs.source_document_id is not null
              and (
                  source_document.id is null
                  or source_document.repair_id != repairs.id
                  or source_document.status = 'ARCHIVED'
                  or source_document.kind not in ('ORDER', 'REPEAT_SCAN')
              )
            order by repairs.id asc
            """
        )
    ).scalars().all()

    if not invalid_repairs:
        return

    for repair_id in invalid_repairs:
        document_rows = connection.execute(
            sa.text(
                """
                select id, kind, status, is_primary, created_at
                from documents
                where repair_id = :repair_id
                order by created_at asc, id asc
                """
            ),
            {"repair_id": repair_id},
        ).mappings().all()

        replacement_id = _choose_replacement_source_document(document_rows)
        connection.execute(
            sa.text(
                """
                update repairs
                set source_document_id = :source_document_id,
                    updated_at = current_timestamp
                where id = :repair_id
                """
            ),
            {"repair_id": repair_id, "source_document_id": replacement_id},
        )
        connection.execute(
            sa.text(
                """
                update documents
                set is_primary = case when id = :source_document_id then 1 else 0 end
                where repair_id = :repair_id
                """
            ),
            {"repair_id": repair_id, "source_document_id": replacement_id},
        )


def upgrade() -> None:
    _heal_invalid_repair_source_document_refs()

    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("repairs") as batch_op:
            batch_op.create_foreign_key(
                "fk_repairs_source_document_id_documents",
                "documents",
                ["source_document_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("repairs") as batch_op:
            batch_op.drop_constraint("fk_repairs_source_document_id_documents", type_="foreignkey")
