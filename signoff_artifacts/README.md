# Sign-off Artifacts

## Назначение

Папка для хранения артефактов ручной приемки по:

- `BUSINESS_SIGNOFF_REPORT_EXPORT.md`
- `RELEASE_CHECKLIST.md`

## Рекомендуемая структура

Для каждого sign-off прогона создавать отдельную подпапку:

- `signoff_artifacts/YYYY-MM-DD_<short-release-or-commit>/`

Для быстрого старта можно копировать шаблон:

- `signoff_artifacts/_template/`
- или запускать `./scripts/create-signoff-run.sh <short-release-or-commit>`
- после сбора файлов можно проверять комплектность командой `./scripts/check-signoff-run.sh <run-folder-name>`

Внутри подпапки хранить:

- `screens/` скриншоты экрана
- `pdf/` выгруженные PDF
- `xlsx/` выгруженные XLSX
- `regression/` логи технического baseline перед ручной приемкой
- `notes.md` краткие замечания и ссылки на кейсы
- `manifest.md` чек-лист комплектности

Технический baseline удобно собирать командой:

- `./scripts/collect-signoff-baseline.sh <run-folder-name>`

## Минимум по файлам

Рекомендуется сохранять:

- эталонный кейс `ЛТ250012276`
- проблемный OCR-кейс `AXB / вв044416.pdf`
- workflow-кейс через `employee_confirmed`

## Правило именования

Использовать имена вида:

- `case1_lt250012276_screen.png`
- `case1_lt250012276_export.pdf`
- `case1_lt250012276_export.xlsx`
- `case2_axb_0000021658_screen.png`
- `case3_workflow_employee_confirmed_before.png`
- `case3_workflow_employee_confirmed_after.png`

## Связь с sign-off

Пути к сохраненным файлам нужно переносить в:

- `BUSINESS_SIGNOFF_REPORT_EXPORT.md`
- release notes или внутренний журнал приемки, если он ведется отдельно
