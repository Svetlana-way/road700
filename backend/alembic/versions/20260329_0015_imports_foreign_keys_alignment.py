"""Align import jobs/conflicts foreign keys

Revision ID: 20260329_0015
Revises: 20260329_0014
Create Date: 2026-03-29 18:20:00
"""

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260329_0015"
down_revision = "20260329_0014"
branch_labels = None
depends_on = None


def _clear_orphan_import_job_document_refs() -> None:
    connection = op.get_bind()
    orphan_job_ids = connection.execute(
        sa.text(
            """
            select id
            from import_jobs
            where document_id is not null
              and not exists (
                  select 1
                  from documents
                  where documents.id = import_jobs.document_id
              )
            """
        )
    ).scalars().all()
    if not orphan_job_ids:
        return

    connection.execute(
        sa.text(
            """
            update import_jobs
            set document_id = null,
                updated_at = current_timestamp
            where id in :job_ids
            """
        ).bindparams(sa.bindparam("job_ids", expanding=True)),
        {"job_ids": orphan_job_ids},
    )


def _rehome_orphan_import_conflicts() -> None:
    connection = op.get_bind()
    orphan_conflicts = connection.execute(
        sa.text(
            """
            select id, import_job_id, entity_type, conflict_key
            from import_conflicts
            where not exists (
                select 1
                from import_jobs
                where import_jobs.id = import_conflicts.import_job_id
            )
            order by id asc
            """
        )
    ).all()
    if not orphan_conflicts:
        return

    import_jobs = sa.table(
        "import_jobs",
        sa.column("id", sa.Integer),
        sa.column("document_id", sa.Integer),
        sa.column("import_type", sa.String),
        sa.column("source_filename", sa.String),
        sa.column("status", sa.String),
        sa.column("summary", sa.JSON),
        sa.column("error_message", sa.Text),
        sa.column("attempts", sa.Integer),
        sa.column("started_at", sa.DateTime(timezone=True)),
        sa.column("finished_at", sa.DateTime(timezone=True)),
    )
    import_conflicts = sa.table(
        "import_conflicts",
        sa.column("id", sa.Integer),
        sa.column("import_job_id", sa.Integer),
    )

    for row in orphan_conflicts:
        finished_at = datetime.now(timezone.utc)
        insert_result = connection.execute(
            sa.insert(import_jobs).values(
                document_id=None,
                import_type="legacy_conflict_placeholder",
                source_filename=f"legacy_orphan_conflict_{row.id}",
                status="FAILED",
                summary={
                    "stage": "failed",
                    "source": "migration_20260329_0015",
                    "orphan_conflict_id": row.id,
                    "orphan_import_job_id": row.import_job_id,
                    "entity_type": row.entity_type,
                    "conflict_key": row.conflict_key,
                },
                error_message="Created automatically to preserve orphan import_conflict during FK alignment",
                attempts=1,
                started_at=finished_at,
                finished_at=finished_at,
            )
        )
        inserted_primary_key = tuple(insert_result.inserted_primary_key or ())
        placeholder_job_id = inserted_primary_key[0] if inserted_primary_key else insert_result.lastrowid
        if placeholder_job_id is None:
            raise RuntimeError("Could not create placeholder import_job for orphan import_conflict")
        connection.execute(
            sa.update(import_conflicts)
            .where(import_conflicts.c.id == row.id)
            .values(import_job_id=placeholder_job_id)
        )


def upgrade() -> None:
    _clear_orphan_import_job_document_refs()
    _rehome_orphan_import_conflicts()

    with op.batch_alter_table("import_jobs") as batch_op:
        batch_op.create_foreign_key(
            "fk_import_jobs_document_id_documents",
            "documents",
            ["document_id"],
            ["id"],
        )

    with op.batch_alter_table("import_conflicts") as batch_op:
        batch_op.create_foreign_key(
            "fk_import_conflicts_import_job_id_import_jobs",
            "import_jobs",
            ["import_job_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("import_conflicts") as batch_op:
        batch_op.drop_constraint("fk_import_conflicts_import_job_id_import_jobs", type_="foreignkey")

    with op.batch_alter_table("import_jobs") as batch_op:
        batch_op.drop_constraint("fk_import_jobs_document_id_documents", type_="foreignkey")
