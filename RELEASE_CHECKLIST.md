# Release Checklist

## Назначение

Документ фиксирует минимальный release-gate перед production deploy.

Он дополняет:

- `scripts/predeploy-usecase-check.sh`
- `UAT_CHECKLIST_ЗАКАЗЧИК.md`
- `README.md`

## 1. Автоматические проверки перед релизом

Обязательный минимум:

- `python3 -m compileall backend/app`
- `cd backend && DATABASE_URL=sqlite:///local.db INITIAL_ADMIN_EMAIL=admin@example.com INITIAL_ADMIN_LOGIN=admin INITIAL_ADMIN_PASSWORD=change-me ./.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`
- `cd frontend && npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
- `cd frontend && npm run build`
- `bash ./scripts/predeploy-usecase-check.sh`

Ожидаемый результат:

- все команды завершаются с кодом `0`
- `scripts/predeploy-usecase-check.sh` печатает `Pre-deploy use case check passed.`
- backend regression suite завершается строкой `Ran 322 tests ... OK` или актуальным эквивалентом после расширения набора тестов

Текущее известное исключение:

- локальный `scripts/predeploy-usecase-check.sh` может печатать строку вида `[FAILED] ... test-order.pdf: ocr failure`
- это не считается release blocker само по себе, если скрипт завершился успешно и не появилось новых неожиданных падений

## 2. Обязательная ручная проверка

Перед production deploy подтвердить вручную:

- сотрудник может загрузить заказ-наряд и документ уходит в OCR, а не теряется
- предупреждения по машине, сервису, нормо-часам и суммам видны в карточке ремонта
- ручное назначение сервиса снимает сервисное warning без дублирования
- итоговый отчёт по заказ-наряду содержит executive sections, несоответствия и итоговый статус проверки
- PDF/XLSX экспорт ремонта показывает тот же workflow-этап и смысловой итог, что и экран
- employee flow проходит до `employee_confirmed`, а admin либо подтверждает ремонт, либо возвращает его в `in_review`

Рекомендуемый минимальный набор sign-off кейсов для report/export:

- эталонный кейс `ЛТ250012276`
- один проблемный OCR-кейс уровня `AXB/вв044416.pdf`
- один реальный workflow-кейс с переходом через `employee_confirmed`

## 3. OCR Runtime Gate

Для production deploy дополнительно подтвердить:

- контейнер `app` поднимается с доступными `tesseract-ocr`, `tesseract-ocr-rus` и `pdftoppm`
- контейнер `worker` стартует без ошибок OCR runtime
- `scripts/smoke-test-ocr-runtime.sh` завершается успешно
- `/api/health` показывает рабочие `database`, `storage`, `ocr_backend` и `pdf_renderer`

## 4. Артефакты приемки

Перед релизом сохранить:

- дату и commit/revision релиза
- результат `scripts/predeploy-usecase-check.sh`
- результат `scripts/smoke-test-ocr-runtime.sh`
- короткую запись по ручной проверке employee flow и report/export
- заполненный `BUSINESS_SIGNOFF_REPORT_EXPORT.md`, если релиз включает изменения итогового отчёта или экспорта
- ссылки на скриншоты и PDF/XLSX артефакты, если выполнялся report/export sign-off
- технический baseline в `signoff_artifacts/.../regression/`, если выполнялся report/export sign-off
- сохраненные артефакты в `signoff_artifacts/YYYY-MM-DD_<short-release-or-commit>/`
- при наличии report/export sign-off папка артефактов проходит `./scripts/check-signoff-run.sh <run-folder-name>`
- список известных остаточных рисков, если релиз идет не с полностью чистым backlog

## 5. Что считается blocker

Релиз блокируется, если:

- падает backend test suite, frontend typecheck или frontend build
- `scripts/predeploy-usecase-check.sh` не проходит
- OCR runtime smoke не проходит на сервере
- employee flow имеет тупик между `in_review`, `employee_confirmed` и admin decision
- PDF/XLSX экспорт ремонта расходится по workflow-этапу или итоговому смыслу с экраном

## 6. Связанные документы

- [README.md](/Users/svetlanasamojlova/курсор/road700/README.md)
- [UAT_CHECKLIST_ЗАКАЗЧИК.md](/Users/svetlanasamojlova/курсор/road700/UAT_CHECKLIST_%D0%97%D0%90%D0%9A%D0%90%D0%97%D0%A7%D0%98%D0%9A.md)
- [Gap analysis и roadmap по use case сотрудника.md](/Users/svetlanasamojlova/курсор/road700/Gap%20analysis%20%D0%B8%20roadmap%20%D0%BF%D0%BE%20use%20case%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0.md)
- [BUSINESS_SIGNOFF_REPORT_EXPORT.md](/Users/svetlanasamojlova/курсор/road700/BUSINESS_SIGNOFF_REPORT_EXPORT.md)
- [PR24_CLOSEOUT.md](/Users/svetlanasamojlova/курсор/road700/PR24_CLOSEOUT.md)
- [signoff_artifacts/README.md](/Users/svetlanasamojlova/курсор/road700/signoff_artifacts/README.md)
- [scripts/predeploy-usecase-check.sh](/Users/svetlanasamojlova/курсор/road700/scripts/predeploy-usecase-check.sh)
