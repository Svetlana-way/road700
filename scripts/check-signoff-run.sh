#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNOFF_ROOT="$ROOT_DIR/signoff_artifacts"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/check-signoff-run.sh <run-folder-name>

Examples:
  ./scripts/check-signoff-run.sh 2026-04-04_report-export-signoff
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

RUN_NAME="${1:-}"
if [[ -z "$RUN_NAME" ]]; then
  usage
  exit 1
fi

RUN_DIR="$SIGNOFF_ROOT/$RUN_NAME"
if [[ ! -d "$RUN_DIR" ]]; then
  echo "Sign-off run not found: $RUN_DIR" >&2
  exit 1
fi

required_files=(
  "notes.md"
  "manifest.md"
  "screens/case1_lt250012276_screen.png"
  "pdf/case1_lt250012276_export.pdf"
  "xlsx/case1_lt250012276_export.xlsx"
  "screens/case2_axb_0000021658_screen.png"
  "pdf/case2_axb_0000021658_export.pdf"
  "xlsx/case2_axb_0000021658_export.xlsx"
  "screens/case3_workflow_employee_confirmed_before.png"
  "screens/case3_workflow_employee_confirmed_after.png"
  "pdf/case3_workflow_export_before.pdf"
  "pdf/case3_workflow_export_after.pdf"
  "xlsx/case3_workflow_export_before.xlsx"
  "xlsx/case3_workflow_export_after.xlsx"
)

missing=0

echo "Checking sign-off run: $RUN_DIR"
for relative_path in "${required_files[@]}"; do
  absolute_path="$RUN_DIR/$relative_path"
  if [[ -f "$absolute_path" ]]; then
    echo "[ok] $relative_path"
  else
    echo "[missing] $relative_path"
    missing=1
  fi
done

echo
if [[ "$missing" -eq 0 ]]; then
  echo "Sign-off run is complete."
  exit 0
fi

echo "Sign-off run is incomplete."
exit 1
