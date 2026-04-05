#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.server.yml}"
ENV_FILE="${ENV_FILE:-.env.server}"
APP_SERVICE="${APP_SERVICE:-app}"
WORKER_SERVICE="${WORKER_SERVICE:-worker}"
SMOKE_TEST_ADMIN_LOGIN="${SMOKE_TEST_ADMIN_LOGIN:-}"
SMOKE_TEST_ADMIN_PASSWORD="${SMOKE_TEST_ADMIN_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/smoke-test-ocr-runtime.sh

Optional environment variables:
  COMPOSE_FILE   Compose file path, default: docker-compose.server.yml
  ENV_FILE       Compose env file path, default: .env.server
  APP_SERVICE    App service name, default: app
  WORKER_SERVICE Worker service name, default: worker
  SMOKE_TEST_ADMIN_LOGIN     Optional login override for authenticated checks
  SMOKE_TEST_ADMIN_PASSWORD  Optional password override for authenticated checks
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

read_env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi

  awk -F= -v key="$key" '
    /^[[:space:]]*#/ || !/=/{next}
    {
      current_key = $1
      sub(/^[[:space:]]+/, "", current_key)
      sub(/[[:space:]]+$/, "", current_key)
      if (current_key != key) {
        next
      }

      value = substr($0, index($0, "=") + 1)
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
        value = substr(value, 2, length(value) - 2)
      }
      print value
    }
  ' "$ENV_FILE" | tail -n 1
}

if [[ -z "$SMOKE_TEST_ADMIN_LOGIN" ]]; then
  SMOKE_TEST_ADMIN_LOGIN="$(read_env_value "SMOKE_TEST_ADMIN_LOGIN")"
fi

if [[ -z "$SMOKE_TEST_ADMIN_PASSWORD" ]]; then
  SMOKE_TEST_ADMIN_PASSWORD="$(read_env_value "SMOKE_TEST_ADMIN_PASSWORD")"
fi

compose_exec() {
  local -a env_args=()
  if [[ -n "$SMOKE_TEST_ADMIN_LOGIN" ]]; then
    env_args+=(-e "SMOKE_TEST_ADMIN_LOGIN=$SMOKE_TEST_ADMIN_LOGIN")
  fi
  if [[ -n "$SMOKE_TEST_ADMIN_PASSWORD" ]]; then
    env_args+=(-e "SMOKE_TEST_ADMIN_PASSWORD=$SMOKE_TEST_ADMIN_PASSWORD")
  fi
  compose exec -T "${env_args[@]}" "$@"
}

echo "[1/5] Container status"
compose ps

echo "[2/5] OCR runtime inside app container"
compose_exec "$APP_SERVICE" python -m app.scripts.check_ocr_runtime --require-full

echo "[3/5] OCR runtime inside worker container"
compose_exec "$WORKER_SERVICE" python -m app.scripts.check_ocr_runtime --require-full

echo "[4/5] API health"
compose_exec "$APP_SERVICE" python - <<'PY'
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
compose_exec "$APP_SERVICE" python - <<'PY'
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

login = (os.environ.get("SMOKE_TEST_ADMIN_LOGIN") or os.environ.get("INITIAL_ADMIN_LOGIN") or "admin").strip().lower()
password = os.environ.get("SMOKE_TEST_ADMIN_PASSWORD") or os.environ.get("INITIAL_ADMIN_PASSWORD")
if not login:
    raise SystemExit("Admin login is not configured for the smoke test")
if not password:
    raise SystemExit("Admin password is not configured for the smoke test")

login_data = urllib.parse.urlencode({"username": login, "password": password}).encode("utf-8")
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
