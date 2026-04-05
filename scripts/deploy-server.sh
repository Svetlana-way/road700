#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${DEPLOY_PATH:-/opt/road700}"
REMOTE_ENV_FILE="${DEPLOY_ENV_FILE:-.env.server}"
SSH_PASSWORD="${DEPLOY_PASSWORD:-${SSH_PASSWORD:-}}"

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_HOST=your-server-ip-or-hostname DEPLOY_PASSWORD=secret ./scripts/deploy-server.sh

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

if [[ -n "$SSH_PASSWORD" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass is required when DEPLOY_PASSWORD or SSH_PASSWORD is set" >&2
    exit 1
  fi
  SSH_BASE_ARGS+=(
    -o PreferredAuthentications=password,keyboard-interactive
    -o PubkeyAuthentication=no
  )
  REMOTE_SHELL="ssh ${SSH_BASE_ARGS[*]}"
else
  REMOTE_SHELL="ssh ${SSH_BASE_ARGS[*]}"
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

looks_like_ip_address() {
  local value="$1"
  [[ "$value" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ || "$value" == *:* ]]
}

echo "Creating remote directory $REMOTE_DIR"
run_ssh "mkdir -p '$REMOTE_DIR'"

echo "Cleaning stale workstation-only artifacts on remote"
run_ssh "cd '$REMOTE_DIR' && rm -rf \
  .codespaces \
  .devcontainer \
  .github \
  .private \
  .qoder \
  tmp \
  frontend/node_modules \
  frontend/dist \
  frontend/.tsbuild \
  backend/.venv \
  backend/local.db"
run_ssh "find '$REMOTE_DIR' -maxdepth 1 -name '*.db' -delete"
run_ssh "find '$REMOTE_DIR/frontend' -maxdepth 1 -name '*.tsbuildinfo' -delete 2>/dev/null || true"

echo "Syncing project files"
run_rsync \
  -az \
  --delete \
  --filter="P $REMOTE_ENV_FILE" \
  --exclude "$REMOTE_ENV_FILE" \
  --filter='P storage/' \
  --exclude '.git' \
  --exclude '.github' \
  --exclude '.codespaces' \
  --exclude '.devcontainer' \
  --exclude '.private' \
  --exclude '.qoder' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'signoff_artifacts' \
  --exclude 'tmp' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'frontend/.tsbuild' \
  --exclude '*.tsbuildinfo' \
  --exclude 'backend/.venv' \
  --exclude 'backend/local.db' \
  --exclude '*.db' \
  --exclude 'storage' \
  -e "$REMOTE_SHELL" \
  "$ROOT_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "Rebuilding application containers"
run_ssh "cd '$REMOTE_DIR' && docker compose --env-file '$REMOTE_ENV_FILE' -f docker-compose.server.yml up -d --build app worker caddy"

echo "Reloading Caddy configuration"
run_ssh "cd '$REMOTE_DIR' && docker compose --env-file '$REMOTE_ENV_FILE' -f docker-compose.server.yml restart caddy"

echo "Container status"
run_ssh "cd '$REMOTE_DIR' && docker compose --env-file '$REMOTE_ENV_FILE' -f docker-compose.server.yml ps"

echo "Running OCR runtime smoke test"
run_ssh "cd '$REMOTE_DIR' && chmod +x ./scripts/smoke-test-ocr-runtime.sh && ENV_FILE='$REMOTE_ENV_FILE' COMPOSE_FILE='docker-compose.server.yml' ./scripts/smoke-test-ocr-runtime.sh"

if command -v curl >/dev/null 2>&1; then
  REMOTE_DOMAIN=""
  if ! REMOTE_DOMAIN="$(run_ssh "cd '$REMOTE_DIR' && awk -F= '/^[[:space:]]*#/ || !/=/{next} {key=\$1; sub(/^[[:space:]]+/, \"\", key); sub(/[[:space:]]+$/, \"\", key); if (key != \"DOMAIN\") next; value=substr(\$0, index(\$0, \"=\")+1); sub(/^[[:space:]]+/, \"\", value); sub(/[[:space:]]+$/, \"\", value); if ((value ~ /^\".*\"$/) || (value ~ /^'\"'\"'.*'\"'\"'$/)) value=substr(value, 2, length(value)-2); print value }' '$REMOTE_ENV_FILE' | tail -n 1" 2>/dev/null)"; then
    echo "Warning: failed to read DOMAIN from remote env; continuing with direct host smoke only." >&2
  fi

  if looks_like_ip_address "$REMOTE_HOST"; then
    echo "Running direct host smoke test"
    curl --fail --silent --show-error --max-time 20 "http://$REMOTE_HOST/api/health" >/dev/null
    echo "Direct host smoke test passed."
  fi

  if [[ -n "$REMOTE_DOMAIN" ]]; then
    echo "Running external access smoke test"
    curl --fail --silent --show-error --max-time 20 "https://$REMOTE_DOMAIN/api/health" >/dev/null
    curl --fail --silent --show-error --location --max-time 20 "http://$REMOTE_DOMAIN/api/health" >/dev/null
    echo "External access smoke test passed."
  fi
fi
