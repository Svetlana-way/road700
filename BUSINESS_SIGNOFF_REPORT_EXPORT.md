# Business Sign-off: Report and Export

## Назначение

Шаблон для формального подтверждения, что итоговый отчёт по заказ-наряду и экспорт ремонта соответствуют ожиданиям заказчика.

Документ используется после технического прохождения:

- `scripts/predeploy-usecase-check.sh`
- `RELEASE_CHECKLIST.md`
- `UAT_CHECKLIST_ЗАКАЗЧИК.md`

## 1. Идентификация проверки

- Дата проверки: `2026-04-04`
- Проверяющий:
- Контур:
  - `local` подготовленный sign-off sandbox
  - `stage`
  - `production`
- Версия / commit: `report-export-signoff`
- Технический run: `signoff_artifacts/2026-04-04_report-export-signoff/`
- Технический baseline: `signoff_artifacts/2026-04-04_report-export-signoff/regression/summary.md` = `complete`

### Сводка прохождения

- Проверены все 3 обязательных кейса:
  - [x] технический пакет собран
  - [ ] reviewer подтвердил
- Экранный отчёт согласован:
  - [ ] да
  - [ ] нет
- PDF/XLSX экспорт согласован:
  - [ ] да
  - [ ] нет
- Есть блокирующие замечания:
  - [ ] да
  - [ ] нет

Технический комментарий:

- `./scripts/check-signoff-run.sh 2026-04-04_report-export-signoff` проходит успешно
- screen/PDF/XLSX артефакты по 3 кейсам уже собраны
- итоговое бизнес-решение в этом блоке ещё не проставлено

## 2. Порядок прохождения

Для каждого кейса пройти одинаковую последовательность:

1. Открыть ремонт на экране и зафиксировать текущий workflow-stage.
2. Проверить экранный итоговый отчёт по разделам из `UAT_CHECKLIST_ЗАКАЗЧИК.md`.
3. Скачать PDF и XLSX экспорт ремонта.
4. Сравнить экран, PDF и XLSX по workflow-этапу, executive summary, warnings и смысловому итогу.
5. Сохранить артефакты: скриншоты, PDF, XLSX.
   Рекомендуемый путь: `signoff_artifacts/YYYY-MM-DD_<short-release-or-commit>/`
   Для быстрого старта можно копировать `signoff_artifacts/_template/`.
   Либо создать папку командой `./scripts/create-signoff-run.sh <short-release-or-commit>`.
   До ручного sign-off желательно собрать технический baseline через `./scripts/collect-signoff-baseline.sh <run-folder-name>`.
   После сбора файлов можно проверить комплектность через `./scripts/check-signoff-run.sh <run-folder-name>`.
6. Зафиксировать замечания как `блокирующие` или `неблокирующие`.
7. В конце заполнить итоговое решение по релизу.

### Шаблон фиксации замечания

Для каждого замечания фиксировать:

- кейс:
- шаг:
- источник:
  - `экран`
  - `PDF`
  - `XLSX`
  - `экран vs экспорт`
- ожидаемый результат:
- фактический результат:
- severity:
  - `блокирующее`
  - `неблокирующее`
- ссылка на артефакт:

### Где хранить артефакты

Использовать папку:

- `signoff_artifacts/YYYY-MM-DD_<short-release-or-commit>/`

Текущий подготовленный run:

- `signoff_artifacts/2026-04-04_report-export-signoff/`

Правила:

- скриншоты складывать в `screens/`
- PDF складывать в `pdf/`
- XLSX складывать в `xlsx/`
- regression logs складывать в `regression/`
- краткие замечания дублировать в `notes.md`, если они не помещаются в этот документ

### Технический baseline перед ручной приемкой

Перед заполнением этого документа желательно убедиться, что проходят как минимум следующие regression-тесты:

- `backend/tests/test_review_and_services.py::test_repair_export_includes_workflow_stage_and_final_report_sections`
- `backend/tests/test_review_and_services.py::test_employee_workflow_runs_end_to_end_between_employee_and_admin`
- `backend/tests/test_review_and_services.py::test_upload_to_repair_reopens_employee_confirmed_repair_for_review`
- `backend/tests/test_review_and_services.py::test_reprocess_reopens_employee_confirmed_repair_for_review`
- `backend/tests/test_review_and_services.py::test_review_field_update_resets_employee_confirmed_repair_back_to_in_review`

### Проверяемые кейсы

Рекомендуемый минимальный набор:

- Эталонный стабильный кейс:
  - заказ-наряд `ЛТ250012276`
  - файл `Заказ-наряд №ЛТ250012276 от 25.12.2025.pdf`
  - ожидание: сумма `84 032 руб`, читаемый executive summary, явный workflow-stage, корректный PDF/XLSX экспорт
- Стресс-кейс по OCR:
  - документ `вв044416.pdf`
  - сервис `AXB`
  - ожидание: отчёт и экспорт явно показывают неполный/спорный разбор без потери warnings
- Workflow-кейс:
  - любой реальный заказ-наряд, который проходит `in_review -> employee_confirmed -> confirmed`
    или `in_review -> employee_confirmed -> in_review`
  - ожидание: экран и экспорт не расходятся по workflow-этапу до и после решения администратора

### Стартовый пакет для текущего этапа

#### Кейс 1. Эталонный

- Номер заказ-наряда: `ЛТ250012276`
- Исходный файл: `Заказ-наряд №ЛТ250012276 от 25.12.2025.pdf`
- Сервис: `ЛидерТрак`
- Техническая опора:
  - `backend/tests/test_review_and_services.py::test_repair_export_includes_workflow_stage_and_final_report_sections`
- Проверять по разделам UAT:
  - `## 6. Итоговый отчет по заказ-наряду`
  - `## 7. Проверка на эталонном кейсе`
  - `## 10. Экспорт`
- Ожидаемые опорные данные:
  - дата: `2025-12-25`
  - госномер: `879КВА716`
  - VIN: `X9PRG20A4MW137776`
  - пробег: `953917`
  - сумма: `84 032 руб`
- Особые ожидания:
  - в отчёте виден сюжет по вибрации
  - есть короткий управленческий вывод
  - спорные/аналоговые позиции не теряются между экраном и экспортом
- Что дополнительно проверить буквально:
  - сумма на экране и в экспорте читается как `84 032 руб`
  - executive summary не выглядит пустым или общими фразами
  - PDF/XLSX не теряют спорные/аналоговые позиции относительно экрана

#### Кейс 2. Проблемный OCR

- Номер заказ-наряда: `0000021658`
- Исходный файл: `вв044416.pdf`
- Сервис: `AXB`
- Техническая опора:
  - `OCR_QUALITY_REPORT.md`
  - `AXB_LABOR_NORM_COVERAGE_REPORT.md`
- Проверять по разделам UAT:
  - `## 5. Предупреждения и несоответствия`
  - `## 6. Итоговый отчет по заказ-наряду`
  - `## 10. Экспорт`
- Ожидаемые опорные сигналы:
  - документ не выглядит как полностью чистый OCR-case
  - warnings явно показывают неполный или спорный разбор
  - отчёт не маскирует расхождение между распознанными работами и итогом документа
- Известный контекст:
  - дата: `2025-07-02`
  - госномер: `BB044416`
  - VIN: `WSM00000003313941`
  - пробег: `1480125`
  - итог по документу: `45 474.14`
  - распознанные работы: `33105.6`
  - итог работ по документу: `43023.6`
  - покрытие нормо-часов: `0/7`
- Что дополнительно проверить буквально:
  - отчёт не скрывает, что кейс проблемный
  - warnings по нормо-часам и OCR-шуму видны и на экране, и в экспорте
  - экспорт не выглядит “чистым” при том, что coverage по нормо-часам `0/7`

#### Кейс 3. Workflow через employee confirmation

- Номер заказ-наряда: `заполнить`
- Исходный файл: `заполнить`
- Техническая опора:
  - `backend/tests/test_review_and_services.py::test_employee_workflow_runs_end_to_end_between_employee_and_admin`
  - `backend/tests/test_review_and_services.py::test_upload_to_repair_reopens_employee_confirmed_repair_for_review`
  - `backend/tests/test_review_and_services.py::test_reprocess_reopens_employee_confirmed_repair_for_review`
  - `backend/tests/test_review_and_services.py::test_review_field_update_resets_employee_confirmed_repair_back_to_in_review`
- Проверять по разделам UAT:
  - `## 8. Ручная корректировка`
  - `## 9. Сквозной сценарий сотрудника и администратора`
  - `## 10. Экспорт`
- Сценарий:
  - открыть кейс в `in_review`
  - довести до `employee_confirmed`
  - затем либо подтвердить администратором, либо вернуть в `in_review`
- Ожидаемые опорные сигналы:
  - экранный отчёт показывает фактический workflow-stage без внутренних технических терминов
  - PDF/XLSX экспорт показывает тот же workflow-stage
  - после admin decision экран и экспорт синхронно отражают новый этап
  - при возврате в review предупреждения и итог не выглядят как финально подтверждённые
- Ожидаемые export markers из regression-тестов:
  - в XLSX есть лист `Итоговый отчет`
  - в XLSX сводка содержит строку `Этап workflow`
  - для кейса в `employee_confirmed` значение читается как `Ожидает финального подтверждения администратора`
  - в XLSX есть executive sections `1. Финансы`, `2. Что фактически сделано`, `8. Рекомендация`
  - в PDF есть разделы `Короткий отчёт для руководителя`, `1. Финансы`, `7. Итог`

Для каждого кейса заполнить:

- Номер заказ-наряда:
- Исходный файл:
- Роль проверяющего:
  - `сотрудник`
  - `администратор`
- Статус до проверки:
- Статус после проверки:

### Рабочий лист заполнения

#### Заполнение: Кейс 1. Эталонный `ЛТ250012276`

- Роль проверяющего:
- Статус до проверки: `in_review`
- Статус после проверки: `in_review`
- Артефакты:
  - скриншот экрана: `signoff_artifacts/2026-04-04_report-export-signoff/screens/case1_lt250012276_screen.png`
  - PDF экспорт: `signoff_artifacts/2026-04-04_report-export-signoff/pdf/case1_lt250012276_export.pdf`
  - XLSX экспорт: `signoff_artifacts/2026-04-04_report-export-signoff/xlsx/case1_lt250012276_export.xlsx`
- Экранный отчёт:
  - `согласовано`
  - `согласовано с замечаниями`
  - `не согласовано`
- PDF/XLSX экспорт:
  - `согласовано`
  - `согласовано с замечаниями`
  - `не согласовано`
- Блокирующие замечания:
- Неблокирующие замечания:
- Комментарий:

#### Заполнение: Кейс 2. OCR `AXB / вв044416.pdf`

- Номер заказ-наряда: `0000021658`
- Роль проверяющего:
- Статус до проверки: `in_review`
- Статус после проверки: `in_review`
- Артефакты:
  - скриншот экрана: `signoff_artifacts/2026-04-04_report-export-signoff/screens/case2_axb_0000021658_screen.png`
  - PDF экспорт: `signoff_artifacts/2026-04-04_report-export-signoff/pdf/case2_axb_0000021658_export.pdf`
  - XLSX экспорт: `signoff_artifacts/2026-04-04_report-export-signoff/xlsx/case2_axb_0000021658_export.xlsx`
- Экранный отчёт:
  - `согласовано`
  - `согласовано с замечаниями`
  - `не согласовано`
- PDF/XLSX экспорт:
  - `согласовано`
  - `согласовано с замечаниями`
  - `не согласовано`
- Блокирующие замечания:
- Неблокирующие замечания:
- Комментарий:

#### Заполнение: Кейс 3. Workflow через `employee_confirmed`

- Номер заказ-наряда: `ЛТ250012276`
- Исходный файл: `Заказ-наряд №ЛТ250012276 от 25.12.2025.pdf`
- Проверенный маршрут:
  - `in_review -> employee_confirmed -> confirmed`
  - `in_review -> employee_confirmed -> in_review`
- Роль проверяющего:
- Статус до проверки: `employee_confirmed`
- Статус после проверки: `confirmed`
- Артефакты:
  - скриншот экрана до решения администратора: `signoff_artifacts/2026-04-04_report-export-signoff/screens/case3_workflow_employee_confirmed_before.png`
  - скриншот экрана после решения администратора: `signoff_artifacts/2026-04-04_report-export-signoff/screens/case3_workflow_employee_confirmed_after.png`
  - PDF экспорт:
    - `signoff_artifacts/2026-04-04_report-export-signoff/pdf/case3_workflow_export_before.pdf`
    - `signoff_artifacts/2026-04-04_report-export-signoff/pdf/case3_workflow_export_after.pdf`
  - XLSX экспорт:
    - `signoff_artifacts/2026-04-04_report-export-signoff/xlsx/case3_workflow_export_before.xlsx`
    - `signoff_artifacts/2026-04-04_report-export-signoff/xlsx/case3_workflow_export_after.xlsx`
- Экранный отчёт:
  - `согласовано`
  - `согласовано с замечаниями`
  - `не согласовано`
- PDF/XLSX экспорт:
  - `согласовано`
  - `согласовано с замечаниями`
  - `не согласовано`
- Блокирующие замечания:
- Неблокирующие замечания:
- Комментарий:

## 3. Проверка экранного отчёта

Подтвердить по каждому кейсу:

- executive summary читается без знания внутренних статусов
- этап workflow показан явно и соответствует фактическому состоянию ремонта
- warnings и несоответствия не потеряны и не дублируются
- финансовые выводы не противоречат документу
- блоки по сервису, технике, нормо-часам и суммам выглядят логично

Результат:

- `согласовано`
- `согласовано с замечаниями`
- `не согласовано`

Комментарий:

## 4. Проверка PDF/XLSX экспорта

Подтвердить по каждому кейсу:

- PDF открывается без ошибок
- XLSX открывается без ошибок
- PDF и XLSX содержат тот же workflow-этап, что и экран
- PDF и XLSX содержат тот же смысловой итог, что и экран
- executive sections, warnings и итоговый статус проверки не потеряны

Результат:

- `согласовано`
- `согласовано с замечаниями`
- `не согласовано`

Комментарий:

## 5. Итог по кейсу

- Общий результат:
  - `принято`
  - `принято с замечаниями`
  - `не принято`
- Блокирующие замечания:
- Неблокирующие замечания:
- Нужен ли повторный прогон:
  - `да`
  - `нет`

## 6. Итоговое решение по релизу

- Report/export business sign-off:
  - `подтвержден`
  - `подтвержден с оговорками`
  - `не подтвержден`
- Кто подтвердил:
- Дата:
- Комментарий:
- Ссылки на приложенные артефакты:
  - скриншоты: `signoff_artifacts/2026-04-04_report-export-signoff/screens/`
  - PDF/XLSX: `signoff_artifacts/2026-04-04_report-export-signoff/pdf/`, `signoff_artifacts/2026-04-04_report-export-signoff/xlsx/`
  - дополнительные материалы: `signoff_artifacts/2026-04-04_report-export-signoff/regression/summary.md`, `signoff_artifacts/2026-04-04_report-export-signoff/notes.md`

## 7. Связанные документы

- [RELEASE_CHECKLIST.md](/Users/svetlanasamojlova/курсор/road700/RELEASE_CHECKLIST.md)
- [UAT_CHECKLIST_ЗАКАЗЧИК.md](/Users/svetlanasamojlova/курсор/road700/UAT_CHECKLIST_%D0%97%D0%90%D0%9A%D0%90%D0%97%D0%A7%D0%98%D0%9A.md)
- [Gap analysis и roadmap по use case сотрудника.md](/Users/svetlanasamojlova/курсор/road700/Gap%20analysis%20%D0%B8%20roadmap%20%D0%BF%D0%BE%20use%20case%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0.md)
- [PR24_CLOSEOUT.md](/Users/svetlanasamojlova/курсор/road700/PR24_CLOSEOUT.md)
