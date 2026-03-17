"""Add review rules

Revision ID: 20260317_0007
Revises: 20260317_0006
Create Date: 2026-03-17 14:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260317_0007"
down_revision = "20260317_0006"
branch_labels = None
depends_on = None


DEFAULT_RULES = [
    ("manual_review_reason", "order_number_missing", "Не найден номер заказ-наряда", 8, None, True, 10, None),
    ("manual_review_reason", "repair_date_missing", "Не найдена дата ремонта", 8, None, True, 20, None),
    ("manual_review_reason", "repair_date_invalid", "Дата ремонта распознана с ошибкой", 8, None, True, 30, None),
    ("manual_review_reason", "mileage_missing", "Не найден пробег", 8, None, True, 40, None),
    ("manual_review_reason", "service_name_suspicious", "Название сервиса распознано сомнительно", 8, None, True, 50, None),
    ("manual_review_reason", "text_not_found", "Текст документа не извлечён", 12, "critical", True, 60, None),
    ("manual_review_reason", "image_text_not_found", "На изображении не удалось распознать текст", 12, "critical", True, 70, None),
    ("manual_review_reason", "pdf_text_not_found", "В PDF не удалось распознать текст", 12, "critical", True, 80, None),
    ("manual_review_reason", "pdf_ocr_unavailable", "OCR для PDF недоступен", 16, "critical", True, 90, None),
    ("manual_review_reason", "image_ocr_unavailable", "OCR для изображений недоступен", 16, "critical", True, 100, None),
    ("document_status", "uploaded", "Документ ждёт обработки", 50, None, True, 110, None),
    ("document_status", "partially_recognized", "Документ распознан частично", 80, None, True, 120, None),
    ("document_status", "needs_review", "Документ отправлен на ручную проверку", 70, None, True, 130, None),
    ("document_status", "ocr_error", "Ошибка автоматической обработки документа", 130, "critical", True, 140, None),
    ("repair_status", "in_review", "Ремонт ждёт проверки", 40, None, True, 150, None),
    ("repair_status", "employee_confirmed", "Ремонт подготовлен сотрудником и ждёт подтверждения", 60, None, True, 160, None),
    ("repair_status", "suspicious", "Ремонт помечен как подозрительный", 200, "suspicious", True, 170, None),
    ("repair_status", "ocr_error", "Ремонт требует ручного восстановления после OCR", 130, "critical", True, 180, None),
    ("check_severity", "error", "Есть проверки с ошибками", 140, "critical", True, 190, None),
    ("check_severity", "suspicious", "Есть подозрительные проверки", 180, "suspicious", True, 200, None),
    ("signal", "repair_partial", "Ремонт отмечен как частично распознанный", 25, None, True, 210, None),
    ("signal", "low_ocr_confidence", "Низкая уверенность OCR", 40, None, True, 220, "Вес умножается на (1 - confidence)"),
    ("signal", "manual_review_cap", "Ограничение суммарного веса причин ручной проверки", 32, None, True, 230, None),
]


def upgrade() -> None:
    op.create_table(
        "review_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rule_type", sa.String(length=64), nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("weight", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bucket_override", sa.String(length=32), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("rule_type", "code", name="uq_review_rules_rule_type_code"),
    )
    op.create_index("ix_review_rules_rule_type", "review_rules", ["rule_type"], unique=False)
    op.create_index("ix_review_rules_code", "review_rules", ["code"], unique=False)
    op.create_index("ix_review_rules_is_active", "review_rules", ["is_active"], unique=False)
    op.create_index("ix_review_rules_sort_order", "review_rules", ["sort_order"], unique=False)

    bind = op.get_bind()
    for rule in DEFAULT_RULES:
        bind.execute(
            sa.text(
                """
                INSERT INTO review_rules (
                    rule_type,
                    code,
                    title,
                    weight,
                    bucket_override,
                    is_active,
                    sort_order,
                    notes
                )
                VALUES (
                    :rule_type,
                    :code,
                    :title,
                    :weight,
                    :bucket_override,
                    :is_active,
                    :sort_order,
                    :notes
                )
                """
            ),
            {
                "rule_type": rule[0],
                "code": rule[1],
                "title": rule[2],
                "weight": rule[3],
                "bucket_override": rule[4],
                "is_active": rule[5],
                "sort_order": rule[6],
                "notes": rule[7],
            },
        )


def downgrade() -> None:
    op.drop_index("ix_review_rules_sort_order", table_name="review_rules")
    op.drop_index("ix_review_rules_is_active", table_name="review_rules")
    op.drop_index("ix_review_rules_code", table_name="review_rules")
    op.drop_index("ix_review_rules_rule_type", table_name="review_rules")
    op.drop_table("review_rules")
