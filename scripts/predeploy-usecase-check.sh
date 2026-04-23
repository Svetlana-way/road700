#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/6] Компиляция backend"
python3 -m compileall backend/app >/dev/null

echo "[2/6] Backend tests"
(
  cd backend
  DATABASE_URL=sqlite:///local.db \
  INITIAL_ADMIN_EMAIL=admin@example.com \
  INITIAL_ADMIN_LOGIN=admin \
  INITIAL_ADMIN_PASSWORD=change-me \
  ./.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
)

echo "[3/6] Frontend typecheck"
(
  cd frontend
  npx tsc --noEmit --noUnusedLocals --noUnusedParameters
)

echo "[4/6] Frontend build"
(
  cd frontend
  npm run build
)

echo "[5/6] Статическая проверка покрытия use case"
ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
from __future__ import annotations

import os
import sys
from pathlib import Path


root = Path(os.environ["ROOT_DIR"])

checks: list[tuple[str, list[str]]] = [
    (
        "UAT_CHECKLIST_ЗАКАЗЧИК.md",
        [
            "## 6. Итоговый отчет по заказ-наряду",
            "## 9. Сквозной сценарий сотрудника и администратора",
            "## 10. Экспорт",
            "этап workflow",
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
        "RELEASE_CHECKLIST.md",
        [
            "## 1. Автоматические проверки перед релизом",
            "scripts/predeploy-usecase-check.sh",
            "## 2. Обязательная ручная проверка",
            "## 3. OCR Runtime Gate",
        ],
    ),
    (
        "BUSINESS_SIGNOFF_REPORT_EXPORT.md",
        [
            "## 3. Проверка экранного отчёта",
            "## 4. Проверка PDF/XLSX экспорта",
            "Report/export business sign-off",
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
            "def queue_document_processing(",
            "enqueue_document_processing_job(",
        ],
    ),
    (
        "backend/app/api/jobs.py",
        [
            '@router.get("/{job_id}", response_model=ImportJobRead)',
            '@router.post("/{job_id}/retry", response_model=ImportJobRetryResponse)',
        ],
    ),
    (
        "backend/app/scripts/run_job_worker.py",
        [
            "def process_single_job(",
            "claim_next_document_processing_job(",
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
            'executive_sheet = workbook.create_sheet("Итоговый отчет")',
            'warnings_sheet = workbook.create_sheet("Несоответствия")',
            "def build_report_status_summary(",
            "def build_report_workflow_summary(",
            "def build_report_executive_sections(",
            "def build_export_warning_rows(",
            "def sync_service_checks(",
            "def update_repair_service(",
        ],
    ),
    (
        "frontend/src/App.tsx",
        [
            'uploaded: "В очереди OCR"',
        ],
    ),
    (
        "frontend/src/components/RepairOverviewReportPanel.tsx",
        [
            "Итоговый отчёт по заказ-наряду",
            "Ниже они сгруппированы по типам проверки.",
        ],
    ),
    (
        "Dockerfile.app",
        [
            "FROM node:20-bookworm-slim AS frontend-build",
            "RUN npm ci",
            "RUN npm run build",
            "COPY --from=frontend-build /frontend/dist /app/frontend/dist",
        ],
    ),
    (
        ".github/workflows/ci.yml",
        [
            "server-image:",
            "docker/setup-buildx-action@v3",
            "docker build -f Dockerfile.app .",
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

echo "[6/6] Напоминание по ручной проверке"
cat <<'EOF'
Перед production deploy дополнительно подтвердите вручную:
- сотрудник может загрузить заказ-наряд и документ уходит в OCR, а не теряется;
- предупреждения по машине, сервису, нормо-часам и суммам видны в карточке ремонта;
- ручное назначение сервиса снимает сервисное warning без дублирования;
- итоговый отчёт по заказ-наряду содержит executive sections, несоответствия и итоговый статус проверки;
- PDF/XLSX экспорт ремонта показывает тот же workflow-этап и смысловой итог, что и экран.
EOF

echo "Pre-deploy use case check passed."
