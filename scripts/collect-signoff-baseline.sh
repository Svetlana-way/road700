#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNOFF_ROOT="$ROOT_DIR/signoff_artifacts"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/collect-signoff-baseline.sh <run-folder-name>

Examples:
  ./scripts/collect-signoff-baseline.sh 2026-04-04_report-export-signoff
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

REGRESSION_DIR="$RUN_DIR/regression"
mkdir -p "$REGRESSION_DIR"

declare -a RESULT_LINES=()
overall_status=0

run_and_capture() {
  local label="$1"
  local logfile="$2"
  shift 2

  local started_at
  local finished_at
  local exit_code=0

  started_at="$(date '+%Y-%m-%d %H:%M:%S %z')"
  {
    echo "== $label =="
    echo "Started: $started_at"
    echo "Command: $*"
    echo
  } >"$logfile"

  if "$@" >>"$logfile" 2>&1; then
    exit_code=0
  else
    exit_code=$?
    overall_status=1
  fi

  finished_at="$(date '+%Y-%m-%d %H:%M:%S %z')"
  {
    echo
    echo "Finished: $finished_at"
    echo "Exit code: $exit_code"
  } >>"$logfile"

  if [[ "$exit_code" -eq 0 ]]; then
    RESULT_LINES+=("- [ok] \`$(basename "$logfile")\`")
  else
    RESULT_LINES+=("- [failed:$exit_code] \`$(basename "$logfile")\`")
  fi
}

run_and_capture \
  "Backend targeted regression for report/export and employee workflow" \
  "$REGRESSION_DIR/backend_report_export_workflow_tests.log" \
  bash -lc "cd '$ROOT_DIR/backend' && ./.venv/bin/python -m unittest \
tests.test_review_and_services.ReviewAndServicesApiTestCase.test_repair_export_includes_workflow_stage_and_final_report_sections \
tests.test_review_and_services.ReviewAndServicesApiTestCase.test_employee_workflow_runs_end_to_end_between_employee_and_admin \
tests.test_review_and_services.ReviewAndServicesApiTestCase.test_upload_to_repair_reopens_employee_confirmed_repair_for_review \
tests.test_review_and_services.ReviewAndServicesApiTestCase.test_reprocess_reopens_employee_confirmed_repair_for_review \
tests.test_review_and_services.ReviewAndServicesApiTestCase.test_review_field_update_resets_employee_confirmed_repair_back_to_in_review"

run_and_capture \
  "Frontend production build" \
  "$REGRESSION_DIR/frontend_build.log" \
  bash -lc "cd '$ROOT_DIR/frontend' && npm run build"

run_and_capture \
  "Pre-deploy use case check" \
  "$REGRESSION_DIR/predeploy_usecase_check.log" \
  bash -lc "cd '$ROOT_DIR' && bash ./scripts/predeploy-usecase-check.sh"

summary_status="complete"
if [[ "$overall_status" -ne 0 ]]; then
  summary_status="failed"
fi

{
  echo "# Regression Summary"
  echo
  echo "- Run: \`$RUN_NAME\`"
  echo "- Collected at: \`$(date '+%Y-%m-%d %H:%M:%S %z')\`"
  echo "- Status: \`$summary_status\`"
  echo
  echo "## Logs"
  printf '%s\n' "${RESULT_LINES[@]}"
} >"$REGRESSION_DIR/summary.md"

echo "Baseline logs written to: $REGRESSION_DIR"
if [[ "$overall_status" -eq 0 ]]; then
  echo "Technical baseline collected successfully."
  exit 0
fi

echo "Technical baseline collection finished with failures. See logs in: $REGRESSION_DIR" >&2
exit 1
