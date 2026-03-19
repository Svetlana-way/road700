#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${DEPLOY_PATH:-/opt/road700}"
REMOTE_ENV_FILE="${DEPLOY_ENV_FILE:-.env.server}"
SSH_PASSWORD="${DEPLOY_PASSWORD:-${SSH_PASSWORD:-}}"
REMOTE_ENV_BASENAME="$(basename "$REMOTE_ENV_FILE")"

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_HOST=46.8.220.177 DEPLOY_PASSWORD=secret ./scripts/deploy-server.sh

Optional environment variables:
  DEPLOY_USER       SSH user, default: root
  DEPLOY_PATH       Remote project path, default: /opt/road700
  DEPLOY_ENV_FILE   Remote env file name, default: .env.server
  DEPLOY_PASSWORD   Password for sshpass-based deploy
  SSH_PASSWORD      Alternative password variable name
  SKIP_USE_CASE_CHECK=1  Skip local pre-deploy use case check
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
REMOTE_SHELL="ssh ${SSH_BASE_ARGS[*]}"

if [[ -n "$SSH_PASSWORD" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass is required when DEPLOY_PASSWORD or SSH_PASSWORD is set" >&2
    exit 1
  fi
fi

run_ssh() {
  if [[ -n "$SSH_PASSWORD" ]]; then
    SSHPASS="$SSH_PASSWORD" sshpass -e ssh "${SSH_BASE_ARGS[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"
    return
  fi
  ssh "${SSH_BASE_ARGS[@]}" "$REMOTE_USER@$REMOTE_HOST" "$@"
}

run_rsync() {
  if [[ -n "$SSH_PASSWORD" ]]; then
    SSHPASS="$SSH_PASSWORD" sshpass -e rsync "$@"
    return
  fi
  rsync "$@"
}

echo "Creating remote directory $REMOTE_DIR"
run_ssh "mkdir -p '$REMOTE_DIR'"

echo "Syncing project files"
run_rsync \
  -az \
  --delete \
  --filter="P $REMOTE_ENV_BASENAME" \
  --filter='P storage/' \
  --exclude '.git' \
  --exclude '.github' \
  --exclude '.codespaces' \
  --exclude '.devcontainer' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'backend/.venv' \
  --exclude 'backend/local.db' \
  --exclude 'storage' \
  -e "$REMOTE_SHELL" \
  "$ROOT_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "Rebuilding application containers"
run_ssh "cd '$REMOTE_DIR' && docker compose --env-file '$REMOTE_ENV_FILE' -f docker-compose.server.yml up -d --build app caddy"

echo "Container status"
run_ssh "cd '$REMOTE_DIR' && docker compose --env-file '$REMOTE_ENV_FILE' -f docker-compose.server.yml ps"
