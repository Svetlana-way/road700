# Sign-off Notes Template

## Run Meta

- Date: `2026-04-04`
- Release / commit: `report-export-signoff`
- Environment: `local isolated sign-off sandbox`
- Reviewer:

## Technical Baseline

- Collected at: `2026-04-04 14:31:07 +0300`
- Summary: `regression/summary.md`
- Backend targeted regression: `ok`
- Frontend build: `ok`
- `scripts/predeploy-usecase-check.sh`: `ok`
- Known non-blocking note:
  - log still contains expected OCR line `[FAILED] ... test-order.pdf: ocr failure`, but the script finished with `Pre-deploy use case check passed.`
- Isolated export sandbox:
  - source DB copy: `backend/signoff_cases_20260404.db`
  - imported source files: `tmp/signoff_case_import/`
  - generated backend exports for case 1 and case 2 without screen capture; manual UI comparison is still pending
- Local UI capture sandbox:
  - backend: `http://127.0.0.1:8002`
  - frontend: `http://127.0.0.1:5175`
  - CORS override for sign-off run: `BACKEND_CORS_ORIGINS=http://127.0.0.1:5175`
  - auth storage state: generated temporarily and removed after capture
  - screenshots captured via `npx playwright screenshot`

## Included Cases

- [x] Case 1: `ЛТ250012276`
- [x] Case 2: `AXB / вв044416.pdf`
- [x] Case 3: workflow via `employee_confirmed`

## Files

- `screens/`
- `pdf/`
- `xlsx/`
- `regression/`
- `manifest.md`

## Case Matrix

### Case 1. `ЛТ250012276`

- Order number: `ЛТ250012276`
- File: `Заказ-наряд №ЛТ250012276 от 25.12.2025.pdf`
- UAT sections:
  - `## 6. Итоговый отчет по заказ-наряду`
  - `## 7. Проверка на эталонном кейсе`
  - `## 10. Экспорт`
- Expected artifacts:
  - `screens/case1_lt250012276_screen.png`
  - `pdf/case1_lt250012276_export.pdf`
  - `xlsx/case1_lt250012276_export.xlsx`
- Expected checkpoints:
  - total reads as `84 032 руб`
  - report contains the vibration storyline
  - executive summary is readable and non-empty
  - PDF/XLSX keep the same meaning as the screen
- Result:
  - screen: `screens/case1_lt250012276_screen.png`
  - pdf: `pdf/case1_lt250012276_export.pdf`
  - xlsx: `xlsx/case1_lt250012276_export.xlsx`
  - notes: screen and export artifacts collected from local isolated sign-off sandbox; formal reviewer verdict is still pending

### Case 2. `AXB / вв044416.pdf`

- Order number: `0000021658`
- File: `вв044416.pdf`
- UAT sections:
  - `## 5. Предупреждения и несоответствия`
  - `## 6. Итоговый отчет по заказ-наряду`
  - `## 10. Экспорт`
- Expected artifacts:
  - `screens/case2_axb_0000021658_screen.png`
  - `pdf/case2_axb_0000021658_export.pdf`
  - `xlsx/case2_axb_0000021658_export.xlsx`
- Expected checkpoints:
  - report does not hide that the case is problematic
  - warnings about OCR noise and labor norms mismatch are visible
  - export does not look clean while labor norm coverage remains `0/7`
  - context stays consistent with totals `45 474.14`, recognized works `33105.6`, work total `43023.6`
- Result:
  - screen: `screens/case2_axb_0000021658_screen.png`
  - pdf: `pdf/case2_axb_0000021658_export.pdf`
  - xlsx: `xlsx/case2_axb_0000021658_export.xlsx`
  - notes: screen and export artifacts collected from local isolated sign-off sandbox; formal reviewer verdict is still pending

### Case 3. Workflow via `employee_confirmed`

- Order number: `ЛТ250012276`
- File: `Заказ-наряд №ЛТ250012276 от 25.12.2025.pdf`
- Route:
  - `in_review -> employee_confirmed -> confirmed`
- UAT sections:
  - `## 8. Ручная корректировка`
  - `## 9. Сквозной сценарий сотрудника и администратора`
  - `## 10. Экспорт`
- Expected artifacts:
  - `screens/case3_workflow_employee_confirmed_before.png`
  - `screens/case3_workflow_employee_confirmed_after.png`
  - `pdf/case3_workflow_export_before.pdf`
  - `pdf/case3_workflow_export_after.pdf`
  - `xlsx/case3_workflow_export_before.xlsx`
  - `xlsx/case3_workflow_export_after.xlsx`
- Expected checkpoints:
  - workflow stage is explicit on screen and in export
  - for `employee_confirmed` the stage reads as `Ожидает финального подтверждения администратора`
  - XLSX contains `Итоговый отчет`, `Этап workflow`, `1. Финансы`, `2. Что фактически сделано`, `8. Рекомендация`
  - PDF contains `Короткий отчёт для руководителя`, `1. Финансы`, `7. Итог`
- Result:
  - screen before: `screens/case3_workflow_employee_confirmed_before.png`
  - screen after: `screens/case3_workflow_employee_confirmed_after.png`
  - pdf before: `pdf/case3_workflow_export_before.pdf`
  - pdf after: `pdf/case3_workflow_export_after.pdf`
  - xlsx before: `xlsx/case3_workflow_export_before.xlsx`
  - xlsx after: `xlsx/case3_workflow_export_after.xlsx`
  - notes: backend exports and UI screens collected from local isolated sign-off sandbox; XLSX confirms workflow transition `Ожидает финального подтверждения администратора -> Подтверждён`

## Findings

### Blocking

- none

### Non-blocking

- none

## Links Back

- `BUSINESS_SIGNOFF_REPORT_EXPORT.md`
- `RELEASE_CHECKLIST.md`
- `manifest.md`
- `regression/summary.md`
