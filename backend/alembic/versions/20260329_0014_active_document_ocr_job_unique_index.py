"""Add partial unique index for active document OCR jobs

Revision ID: 20260329_0014
Revises: 20260319_0013
Create Date: 2026-03-29 13:40:00
"""

from alembic import op
import sqlalchemy as sa

from app.models.imports import ACTIVE_DOCUMENT_OCR_JOB_INDEX_WHERE


revision = "20260329_0014"
down_revision = "20260319_0013"
branch_labels = None
depends_on = None


ACTIVE_JOB_STATUSES = ("QUEUED", "RETRY", "PROCESSING")


def _job_priority(row: sa.Row) -> tuple[int, object, object, object, int]:
    if row.status == "PROCESSING":
        return (
            1,
            row.started_at or row.updated_at or row.created_at,
            row.updated_at or row.created_at,
            row.created_at,
            row.id,
        )
    return (
        0,
        row.created_at,
        row.updated_at or row.created_at,
        row.created_at,
        -row.id,
    )


def _normalize_active_document_ocr_duplicates() -> None:
    connection = op.get_bind()
    duplicate_document_ids = connection.execute(
        sa.text(
            """
            select document_id
            from import_jobs
            where document_id is not null
              and import_type = 'document_ocr'
              and status in ('QUEUED', 'RETRY', 'PROCESSING')
            group by document_id
            having count(*) > 1
            """
        )
    ).fetchall()

    for duplicate_row in duplicate_document_ids:
        document_id = duplicate_row[0]
        active_jobs = connection.execute(
            sa.text(
                """
                select id, status, created_at, updated_at, started_at
                from import_jobs
                where document_id = :document_id
                  and import_type = 'document_ocr'
                  and status in ('QUEUED', 'RETRY', 'PROCESSING')
                order by created_at asc, id asc
                """
            ),
            {"document_id": document_id},
        ).fetchall()
        if len(active_jobs) <= 1:
            continue

        canonical_job = max(active_jobs, key=_job_priority)
        duplicate_ids = [row.id for row in active_jobs if row.id != canonical_job.id]
        if not duplicate_ids:
            continue

        connection.execute(
            sa.text(
                """
                update import_jobs
                set status = 'FAILED',
                    error_message = :error_message,
                    finished_at = coalesce(finished_at, current_timestamp),
                    updated_at = current_timestamp
                where id in :duplicate_ids
                """
            ).bindparams(sa.bindparam("duplicate_ids", expanding=True)),
            {
                "duplicate_ids": duplicate_ids,
                "error_message": "Superseded by active OCR job during migration 20260329_0014",
            },
        )


def upgrade() -> None:
    _normalize_active_document_ocr_duplicates()
    op.create_index(
        "uq_import_jobs_active_document_ocr",
        "import_jobs",
        ["document_id"],
        unique=True,
        sqlite_where=sa.text(ACTIVE_DOCUMENT_OCR_JOB_INDEX_WHERE),
        postgresql_where=sa.text(ACTIVE_DOCUMENT_OCR_JOB_INDEX_WHERE),
    )


def downgrade() -> None:
    op.drop_index("uq_import_jobs_active_document_ocr", table_name="import_jobs")
