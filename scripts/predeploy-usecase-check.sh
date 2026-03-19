#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/3] Компиляция backend"
python3 -m compileall backend/app >/dev/null

echo "[2/3] Статическая проверка покрытия use case"
ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
from __future__ import annotations

import os
import sys
from pathlib import Path


root = Path(os.environ["ROOT_DIR"])

checks: list[tuple[str, list[str]]] = [
    (
        "Use Case сотрудника и чек-лист соответствия.md",
        [
            "## Чек-лист соответствия перед деплоем",
            "### Блок 4. Проверка справочников",
            "### Блок 5. Нормо-часы",
            "### Блок 7. Итоговый результат",
        ],
    ),
    (
        "Gap analysis и roadmap по use case сотрудника.md",
        [
            "### P4. Контур качества и pre-deploy соответствие",
            "### P2. Итоговый отчёт по заказ-наряду",
        ],
    ),
    (
        "backend/app/api/health.py",
        [
            '@router.get("/health")',
            'checks["database"] = "ok"',
            'checks["storage"] = "ok"',
        ],
    ),
    (
        "backend/app/api/documents.py",
        [
            "validate_document_upload",
            "def process_document_in_background(",
            "def enqueue_document_processing(",
        ],
    ),
    (
        "backend/app/services/document_processing.py",
        [
            "def build_manual_review_check(",
            '"check_type": "ocr_vehicle_not_found"',
            '"check_type": "ocr_service_not_found"',
            '"check_type": "ocr_service_missing"',
        ],
    ),
    (
        "backend/app/api/repairs.py",
        [
            'summary_sheet.title = "Отчет"',
            'warnings_sheet = workbook.create_sheet("Несоответствия")',
            "def build_report_status_summary(",
            "def build_export_warning_rows(",
            "def sync_service_checks(",
            "def update_repair_service(",
        ],
    ),
    (
        "frontend/src/App.tsx",
        [
            'uploaded: "В очереди OCR"',
            "Итоговый отчёт по заказ-наряду",
            "Ниже они сгруппированы по типам проверки.",
        ],
    ),
]

errors: list[str] = []

for relative_path, patterns in checks:
    path = root / relative_path
    if not path.exists():
        errors.append(f"Отсутствует файл: {relative_path}")
        continue

    content = path.read_text(encoding="utf-8")
    for pattern in patterns:
        if pattern not in content:
            errors.append(f"В файле {relative_path} не найден обязательный маркер: {pattern}")

if errors:
    print("Pre-deploy use case check failed.")
    for item in errors:
        print(f"- {item}")
    sys.exit(1)

print("Static use case markers are present.")
PY

echo "[3/3] Напоминание по ручной проверке"
cat <<'EOF'
Перед production deploy дополнительно подтвердите вручную:
- сотрудник может загрузить заказ-наряд и документ уходит в OCR, а не теряется;
- предупреждения по машине, сервису, нормо-часам и суммам видны в карточке ремонта;
- ручное назначение сервиса снимает сервисное warning без дублирования;
- итоговый отчёт по заказ-наряду содержит несоответствия и итоговый статус проверки.
EOF

echo "Pre-deploy use case check passed."
