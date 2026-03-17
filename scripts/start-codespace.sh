#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codespaces"
LOG_DIR="$RUNTIME_DIR/logs"

mkdir -p "$LOG_DIR"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_BUILD_LOG="$LOG_DIR/frontend-build.log"
REVISION_FILE="$RUNTIME_DIR/revision.txt"
ADMIN_ENV_FILE="$RUNTIME_DIR/admin.env"
ADMIN_CREDENTIALS_FILE="$RUNTIME_DIR/admin-credentials.txt"

export DATABASE_URL="sqlite:///$ROOT_DIR/backend/local.db"

generate_admin_password() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(14))
PY
}

prepare_admin_credentials() {
  if [[ -f "$ADMIN_ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ADMIN_ENV_FILE"
  else
    local generated_password
    generated_password="$(generate_admin_password)"
    cat >"$ADMIN_ENV_FILE" <<EOF
INITIAL_ADMIN_FULL_NAME=${INITIAL_ADMIN_FULL_NAME:-System Administrator}
INITIAL_ADMIN_LOGIN=${INITIAL_ADMIN_LOGIN:-admin}
INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL:-admin@road700.local}
INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD:-$generated_password}
EOF
    chmod 600 "$ADMIN_ENV_FILE"
    cat >"$ADMIN_CREDENTIALS_FILE" <<EOF
Road700 Codespaces admin credentials
login: ${INITIAL_ADMIN_LOGIN:-admin}
email: ${INITIAL_ADMIN_EMAIL:-admin@road700.local}
password: ${INITIAL_ADMIN_PASSWORD:-$generated_password}
EOF
    chmod 600 "$ADMIN_CREDENTIALS_FILE"
    # shellcheck disable=SC1090
    source "$ADMIN_ENV_FILE"
  fi

  export INITIAL_ADMIN_FULL_NAME
  export INITIAL_ADMIN_LOGIN
  export INITIAL_ADMIN_EMAIL
  export INITIAL_ADMIN_PASSWORD
}

prepare_admin_credentials

cd "$ROOT_DIR/backend"
./.venv/bin/alembic upgrade head
./.venv/bin/python -m app.scripts.init_admin

current_revision="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
previous_revision=""
if [[ -f "$REVISION_FILE" ]]; then
  previous_revision="$(cat "$REVISION_FILE")"
fi

force_restart="false"
if [[ "$current_revision" != "$previous_revision" ]]; then
  force_restart="true"
fi

# Codespaces now serves the built frontend through the backend on port 8000.
# Stop any leftover Vite process from older revisions so users see one stable app port.
pkill -f "vite --host 0.0.0.0 --port 5173" 2>/dev/null || true

is_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill -0 "$pid" 2>/dev/null
}

stop_process() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
}

wait_for_url() {
  local url="$1"
  local retries="${2:-20}"
  local delay="${3:-1}"

  for ((i = 1; i <= retries; i += 1)); do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

backend_is_healthy() {
  wait_for_url "http://127.0.0.1:8000/api/health" 3 1
}

frontend_is_healthy() {
  wait_for_url "http://127.0.0.1:8000" 3 1
}

build_frontend() {
  cd "$ROOT_DIR/frontend"
  npm run build >"$FRONTEND_BUILD_LOG" 2>&1
}

start_backend() {
  if [[ "$force_restart" == "true" ]]; then
    stop_process "$BACKEND_PID_FILE"
  fi

  if is_running "$BACKEND_PID_FILE" && backend_is_healthy; then
    return
  fi

  stop_process "$BACKEND_PID_FILE"

  (
    cd "$ROOT_DIR/backend"
    nohup env DATABASE_URL="$DATABASE_URL" \
      INITIAL_ADMIN_FULL_NAME="$INITIAL_ADMIN_FULL_NAME" \
      INITIAL_ADMIN_LOGIN="$INITIAL_ADMIN_LOGIN" \
      INITIAL_ADMIN_EMAIL="$INITIAL_ADMIN_EMAIL" \
      INITIAL_ADMIN_PASSWORD="$INITIAL_ADMIN_PASSWORD" \
      ./.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
      >"$BACKEND_LOG" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )

  wait_for_url "http://127.0.0.1:8000/api/health" 30 1
}

build_frontend

start_backend
frontend_is_healthy

printf '%s\n' "$current_revision" >"$REVISION_FILE"
