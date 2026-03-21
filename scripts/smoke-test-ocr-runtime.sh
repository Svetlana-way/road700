#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.server.yml}"
ENV_FILE="${ENV_FILE:-.env.server}"
APP_SERVICE="${APP_SERVICE:-app}"
WORKER_SERVICE="${WORKER_SERVICE:-worker}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/smoke-test-ocr-runtime.sh

Optional environment variables:
  COMPOSE_FILE   Compose file path, default: docker-compose.server.yml
  ENV_FILE       Compose env file path, default: .env.server
  APP_SERVICE    App service name, default: app
  WORKER_SERVICE Worker service name, default: worker
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "[1/5] Container status"
compose ps

echo "[2/5] OCR runtime inside app container"
compose exec -T "$APP_SERVICE" python -m app.scripts.check_ocr_runtime --require-full

echo "[3/5] OCR runtime inside worker container"
compose exec -T "$WORKER_SERVICE" python -m app.scripts.check_ocr_runtime --require-full

echo "[4/5] API health"
compose exec -T "$APP_SERVICE" python - <<'PY'
from __future__ import annotations

import json
import urllib.request

with urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=10) as response:
    payload = json.load(response)

checks = payload.get("checks", {})
print(json.dumps(payload, ensure_ascii=False, indent=2))

if checks.get("image_ocr") != "ok":
    raise SystemExit("image_ocr is not ok")
if checks.get("pdf_scan_ocr") != "ok":
    raise SystemExit("pdf_scan_ocr is not ok")
PY

echo "[5/5] System status"
compose exec -T "$APP_SERVICE" python - <<'PY'
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

password = os.environ.get("INITIAL_ADMIN_PASSWORD")
if not password:
    raise SystemExit("INITIAL_ADMIN_PASSWORD is not set in the app container")

login_data = urllib.parse.urlencode({"username": "admin", "password": password}).encode("utf-8")
login_request = urllib.request.Request(
    "http://127.0.0.1:8000/api/auth/login",
    data=login_data,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    method="POST",
)
with urllib.request.urlopen(login_request, timeout=10) as response:
    token_payload = json.load(response)

token = token_payload["access_token"]
status_request = urllib.request.Request(
    "http://127.0.0.1:8000/api/system/status",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(status_request, timeout=10) as response:
    payload = json.load(response)

print(json.dumps(payload, ensure_ascii=False, indent=2))

if not payload.get("image_ocr_available"):
    raise SystemExit("image_ocr_available is false")
if not payload.get("pdf_scan_ocr_available"):
    raise SystemExit("pdf_scan_ocr_available is false")
PY

echo "OCR runtime smoke test passed."
