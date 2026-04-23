#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_ROOT="${DEPLOY_PATH:-/opt/road700}"
REMOTE_APP_DIR="${DEPLOY_APP_DIR:-$REMOTE_ROOT/app}"
REMOTE_ENV_FILE="${DEPLOY_ENV_FILE:-$REMOTE_ROOT/.env.server}"
REMOTE_VENV_DIR="${DEPLOY_VENV_DIR:-$REMOTE_ROOT/venv}"
REMOTE_REF="${DEPLOY_REF:-origin/main}"
REMOTE_RUN_USER="${DEPLOY_RUN_USER:-road700}"
APP_SERVICE="${DEPLOY_APP_SERVICE:-road700-app.service}"
WORKER_SERVICE="${DEPLOY_WORKER_SERVICE:-road700-worker.service}"
SSH_PASSWORD="${DEPLOY_PASSWORD:-${SSH_PASSWORD:-}}"
PUBLIC_HEALTH_URL="${DEPLOY_PUBLIC_HEALTH_URL:-}"
MIN_FREE_MB="${DEPLOY_MIN_FREE_MB:-2048}"
LOCAL_HEALTH_URL="${DEPLOY_LOCAL_HEALTH_URL:-http://127.0.0.1:3240/api/health}"
HEALTH_RETRIES="${DEPLOY_HEALTH_RETRIES:-30}"
HEALTH_DELAY_SECONDS="${DEPLOY_HEALTH_DELAY_SECONDS:-2}"
SSH_CONTROL_DIR=""
SSH_CONTROL_PATH=""

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_HOST=your-server ./scripts/deploy-systemd-server.sh

This deploy path is for non-Docker servers that already have:
  - repository checkout in /opt/road700/app
  - Python venv in /opt/road700/venv
  - env file in /opt/road700/.env.server
  - systemd units road700-app.service and road700-worker.service

Optional environment variables:
  DEPLOY_USER               SSH user, default: root
  DEPLOY_PATH               Remote root, default: /opt/road700
  DEPLOY_APP_DIR            Remote app checkout, default: $DEPLOY_PATH/app
  DEPLOY_ENV_FILE           Remote env file, default: $DEPLOY_PATH/.env.server
  DEPLOY_VENV_DIR           Remote venv, default: $DEPLOY_PATH/venv
  DEPLOY_REF                Remote git ref to deploy, default: origin/main
  DEPLOY_RUN_USER           Remote app user, default: road700
  DEPLOY_APP_SERVICE        API systemd unit, default: road700-app.service
  DEPLOY_WORKER_SERVICE     Worker systemd unit, default: road700-worker.service
  DEPLOY_PUBLIC_HEALTH_URL  Optional external health URL to check after restart
  DEPLOY_MIN_FREE_MB        Required free disk space before frontend build, default: 2048
  DEPLOY_LOCAL_HEALTH_URL   Local health URL, default: http://127.0.0.1:3240/api/health
  DEPLOY_HEALTH_RETRIES     Health-check attempts after restart, default: 30
  DEPLOY_HEALTH_DELAY_SECONDS Delay between health attempts, default: 2
  DEPLOY_PASSWORD           Password for sshpass-based deploy
  SSH_PASSWORD              Alternative password variable name
  SKIP_USE_CASE_CHECK=1     Skip local pre-deploy use case check
EOF
}

if [[ -z "$REMOTE_HOST" ]]; then
  usage
  exit 1
fi

if [[ "${SKIP_USE_CASE_CHECK:-0}" != "1" ]]; then
  echo "Running local pre-deploy use case check"
  bash "$ROOT_DIR/scripts/predeploy-usecase-check.sh"
fi

SSH_BASE_ARGS=(-o StrictHostKeyChecking=no)
SSH_CONTROL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/r7sd.XXXXXX")"
SSH_CONTROL_PATH="$SSH_CONTROL_DIR/sock"
SSH_BASE_ARGS+=(
  -o ControlMaster=auto
  -o ControlPersist=300
  -o ControlPath="$SSH_CONTROL_PATH"
)

cleanup() {
  if [[ -n "$SSH_CONTROL_PATH" && -S "$SSH_CONTROL_PATH" ]]; then
    ssh "${SSH_BASE_ARGS[@]}" -O exit "$REMOTE_USER@$REMOTE_HOST" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SSH_CONTROL_DIR" ]]; then
    rm -rf "$SSH_CONTROL_DIR"
  fi
}

trap cleanup EXIT

if [[ -n "$SSH_PASSWORD" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass is required when DEPLOY_PASSWORD or SSH_PASSWORD is set" >&2
    exit 1
  fi
  SSH_BASE_ARGS+=(
    -o PreferredAuthentications=password,keyboard-interactive
    -o PubkeyAuthentication=no
  )
fi

run_ssh() {
  if [[ -n "$SSH_PASSWORD" ]]; then
    SSHPASS="$SSH_PASSWORD" sshpass -e ssh "${SSH_BASE_ARGS[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"
    return
  fi
  ssh "${SSH_BASE_ARGS[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"
}

echo "Deploying $REMOTE_REF to $REMOTE_HOST:$REMOTE_APP_DIR"

run_ssh "test -d '$REMOTE_APP_DIR/.git'"
run_ssh "test -x '$REMOTE_VENV_DIR/bin/python'"
run_ssh "test -f '$REMOTE_ENV_FILE'"

echo "Fetching and checking out remote ref"
run_ssh "sudo -u '$REMOTE_RUN_USER' git -C '$REMOTE_APP_DIR' fetch origin main && sudo -u '$REMOTE_RUN_USER' git -C '$REMOTE_APP_DIR' checkout -B main '$REMOTE_REF'"

echo "Installing backend dependencies"
run_ssh "sudo -u '$REMOTE_RUN_USER' bash -lc 'cd \"$REMOTE_APP_DIR/backend\" && \"$REMOTE_VENV_DIR/bin/pip\" install --no-cache-dir -e .'"

echo "Preparing frontend build workspace"
run_ssh "rm -rf '$REMOTE_APP_DIR/frontend/node_modules' '$REMOTE_APP_DIR/frontend/.tsbuild' '$REMOTE_APP_DIR/frontend/.tsbuildinfo' '$REMOTE_APP_DIR/frontend/.npm-cache' '$REMOTE_ROOT/.npm' '$REMOTE_ROOT/.npm-cache'"

echo "Checking remote disk space"
run_ssh "available_mb=\$(df -Pm '$REMOTE_APP_DIR' | awk 'NR==2 {print \$4}'); if [ \"\$available_mb\" -lt '$MIN_FREE_MB' ]; then echo \"Not enough free disk space for frontend build: \${available_mb}MB available, need ${MIN_FREE_MB}MB\" >&2; exit 1; fi; echo \"Free disk space before frontend build: \${available_mb}MB\""

echo "Building frontend"
run_ssh "sudo -u '$REMOTE_RUN_USER' bash -lc 'cd \"$REMOTE_APP_DIR/frontend\" && npm ci --cache .npm-cache --prefer-offline --no-audit --no-fund && npm run build && rm -rf node_modules .tsbuild .tsbuildinfo .npm-cache'"

echo "Running database migrations"
run_ssh "sudo -u '$REMOTE_RUN_USER' bash -lc 'set -a; . \"$REMOTE_ENV_FILE\"; set +a; cd \"$REMOTE_APP_DIR/backend\" && \"$REMOTE_VENV_DIR/bin/alembic\" -c alembic.ini upgrade head'"

echo "Restarting systemd services"
run_ssh "systemctl restart '$APP_SERVICE' '$WORKER_SERVICE'"

echo "Checking service status"
run_ssh "systemctl is-active '$APP_SERVICE' '$WORKER_SERVICE'"

echo "Running local server health check"
run_ssh "for attempt in \$(seq 1 '$HEALTH_RETRIES'); do if curl --fail --silent --show-error --max-time 10 '$LOCAL_HEALTH_URL' >/dev/null; then echo \"Local health check passed on attempt \$attempt\"; exit 0; fi; sleep '$HEALTH_DELAY_SECONDS'; done; echo \"Local health check failed after ${HEALTH_RETRIES} attempts\" >&2; systemctl --no-pager --full status '$APP_SERVICE' '$WORKER_SERVICE' || true; exit 1"

if [[ -n "$PUBLIC_HEALTH_URL" ]]; then
  echo "Running public health check"
  curl --fail --silent --show-error --max-time 20 "$PUBLIC_HEALTH_URL" >/dev/null
fi

echo "Non-Docker systemd deploy completed."
