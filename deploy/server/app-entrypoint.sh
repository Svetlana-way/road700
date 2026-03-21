#!/usr/bin/env bash
set -euo pipefail

cd /app

python -m app.scripts.check_ocr_runtime
python -m alembic upgrade head
python -m app.scripts.init_admin

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
