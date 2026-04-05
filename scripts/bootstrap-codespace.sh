#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install_ocr_system_packages() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Skipping OCR system packages: apt-get is not available."
    return 0
  fi

  if dpkg -s poppler-utils tesseract-ocr tesseract-ocr-rus >/dev/null 2>&1; then
    return 0
  fi

  local -a privilege_prefix=()
  if command -v sudo >/dev/null 2>&1; then
    privilege_prefix=(sudo)
  fi

  "${privilege_prefix[@]}" apt-get update
  "${privilege_prefix[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-rus
}

install_ocr_system_packages

cd "$ROOT_DIR/backend"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -e .

cd "$ROOT_DIR/frontend"
npm ci
