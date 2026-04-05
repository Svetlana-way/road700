#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/signoff_artifacts/_template"
SIGNOFF_ROOT="$ROOT_DIR/signoff_artifacts"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/create-signoff-run.sh <short-release-or-commit>

Examples:
  ./scripts/create-signoff-run.sh release-report-fix
  ./scripts/create-signoff-run.sh 9f3c2ab

Optional environment variables:
  SIGNOFF_DATE   Override date prefix in YYYY-MM-DD format
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

LABEL="${1:-}"
if [[ -z "$LABEL" ]]; then
  usage
  exit 1
fi

if [[ ! -d "$TEMPLATE_DIR" ]]; then
  echo "Template directory not found: $TEMPLATE_DIR" >&2
  exit 1
fi

DATE_PREFIX="${SIGNOFF_DATE:-$(date +%F)}"
TARGET_DIR="$SIGNOFF_ROOT/${DATE_PREFIX}_${LABEL}"

if [[ -e "$TARGET_DIR" ]]; then
  echo "Sign-off run already exists: $TARGET_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp -R "$TEMPLATE_DIR"/. "$TARGET_DIR"/

echo "Created sign-off run:"
echo "  $TARGET_DIR"
echo
echo "Next steps:"
echo "  1. Put screenshots into $TARGET_DIR/screens/"
echo "  2. Put PDF exports into $TARGET_DIR/pdf/"
echo "  3. Put XLSX exports into $TARGET_DIR/xlsx/"
echo "  4. Collect regression baseline via ./scripts/collect-signoff-baseline.sh $(basename "$TARGET_DIR")"
echo "  5. Fill $TARGET_DIR/notes.md"
echo "  6. Link these paths from BUSINESS_SIGNOFF_REPORT_EXPORT.md"
