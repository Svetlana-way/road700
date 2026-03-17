#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.codespaces"
LOG_DIR="$RUNTIME_DIR/logs"

mkdir -p "$LOG_DIR"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

export DATABASE_URL="sqlite:///$ROOT_DIR/backend/local.db"
export INITIAL_ADMIN_FULL_NAME="${INITIAL_ADMIN_FULL_NAME:-System Administrator}"
export INITIAL_ADMIN_LOGIN="${INITIAL_ADMIN_LOGIN:-admin}"
export INITIAL_ADMIN_EMAIL="${INITIAL_ADMIN_EMAIL:-Kide_16rus@mail.ru}"
export INITIAL_ADMIN_PASSWORD="${INITIAL_ADMIN_PASSWORD:-Road700Admin!2026}"

cd "$ROOT_DIR/backend"
./.venv/bin/alembic upgrade head
./.venv/bin/python -m app.scripts.init_admin

is_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill -0 "$pid" 2>/dev/null
}

start_backend() {
  if is_running "$BACKEND_PID_FILE"; then
    return
  fi

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
}

start_frontend() {
  if is_running "$FRONTEND_PID_FILE"; then
    return
  fi

  (
    cd "$ROOT_DIR/frontend"
    nohup env VITE_BACKEND_PROXY_TARGET="http://127.0.0.1:8000" \
      npm run dev -- --host 0.0.0.0 --port 5173 \
      >"$FRONTEND_LOG" 2>&1 &
    echo $! >"$FRONTEND_PID_FILE"
  )
}

start_backend
start_frontend
