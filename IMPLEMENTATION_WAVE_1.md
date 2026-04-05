# IMPLEMENTATION WAVE 1

Документ для практического запуска первой волны исправлений.

Состав `Wave 1`:
- `T00-T09`
- `T11-T12`
- `T25`

Цель:
- сначала стабилизировать доменные инварианты;
- затем убрать гонки и неатомарность OCR/import;
- отдельно закрыть критичный security-risk по активным JWT;
- не распараллеливать изменения так, чтобы они конфликтовали по одной и той же логике.

---

## 1. Состав волны

| Задача | Название | Приоритет | Оценка |
|---|---|---:|---:|
| `T00` | Собрать regression-набор по найденным багам | `P0` | 2 дн |
| `T01` | Добавить backend guards для архивных `repair/document/vehicle` | `P0` | 2 дн |
| `T02` | Закрыть review action для не-queue документов | `P0` | 1 дн |
| `T03` | Исправить `PATCH /repairs/{id}` чтобы не стирал `checks` | `P0` | 1 дн |
| `T04` | Запретить `upload/process/link/set-primary/compare` на архивных сущностях | `P0` | 2 дн |
| `T05` | Исправить state machine ремонта при `check updates` | `P0` | 1.5 дн |
| `T06` | Выделить явные archive/restore endpoints для `repair` | `P0` | 2 дн |
| `T07` | Выделить явные archive/restore endpoints для `document` | `P0` | 2 дн |
| `T08` | Починить инварианты `primary/source document` | `P0` | 2.5 дн |
| `T09` | Перевести frontend archive flows на новые endpoints | `P0` | 2 дн |
| `T11` | Ввести идемпотентность OCR jobs | `P0` | 3 дн |
| `T12` | Сделать транзакционные workflow `upload/process/import` | `P0` | 4 дн |
| `T25` | Усилить auth: revoke active JWT | `P0` | 2.5 дн |

---

## 2. Логика порядка

Порядок внутри волны не случайный.

- `T00` идет первым, потому что без regression foundation следующие фиксы будут слабо защищены.
- `T01-T09` идут до `T11-T12`, потому что архив и relation-инварианты ломают саму доменную основу.
- `T11-T12` идут после стабилизации archive/document flows, чтобы не чинить async-цепочки поверх плавающих доменных правил.
- `T25` можно делать отдельным PR, но не стоит откладывать далеко, потому что это прямой security gap.

Критическая цепочка:

`T00 -> T01 -> T04 -> T06 -> T07 -> T08 -> T09 -> T11 -> T12`

Отдельная параллельная ветка:

`T25`

---

## 3. Рекомендуемая нарезка по PR

### PR1. Regression Foundation

Состав:
- `T00`

Цель:
- сначала зафиксировать воспроизводимость уже найденных дефектов.

Что должно войти:
- regression tests по архиву;
- regression tests по review queue;
- regression tests по `PATCH /repairs/{id}`;
- regression tests по `primary/source` конфликтам;
- regression tests по OCR/import edge-cases, где баг уже подтвержден;
- regression tests по auth-инвалидации JWT, если можно сразу воспроизвести текущий gap.

Что не должно войти:
- функциональные исправления;
- рефакторинг моделей и API;
- cleanup unrelated tests.

Definition of Done:
- тесты воспроизводят найденные баги;
- набор стабилен и понятен;
- тесты сгруппированы по доменным блокам.

### PR2. Archive Backend Guards

Состав:
- `T01`
- `T02`
- `T03`
- `T04`
- `T05`

Цель:
- закрыть backend-дыру по архиву, review и repair patch/state machine.

Что должно войти:
- единые guards для архивных сущностей;
- review action eligibility check только для queue items;
- safe partial update для ремонта;
- блокировка operational actions для archive;
- корректная state machine ремонта при `check updates`.

Что не должно войти:
- новые archive/restore endpoints;
- frontend migration;
- relation graph redesign beyond immediate invariants.

Definition of Done:
- backend API больше не дает обойти архивные ограничения;
- review action не выполняется вне queue;
- `checks` не теряются;
- status transitions ремонта предсказуемы.

### PR3. Archive Contracts

Состав:
- `T06`
- `T07`

Цель:
- вынести archive/restore в явные backend contracts.

Что должно войти:
- отдельные endpoints archive/restore для `repair`;
- отдельные endpoints archive/restore для `document`;
- удаление скрытой archive semantics из generic update там, где она еще есть;
- минимально необходимое выравнивание response contract.

Что не должно войти:
- UI migration;
- read-only UX;
- audit expansion beyond required contract support.

Definition of Done:
- архив меняется только через отдельные endpoints;
- старые пути архивирования больше не считаются валидными;
- контракты тестируемы и задокументированы на уровне кода.

### PR4. Relation Invariants + Frontend Archive Migration

Состав:
- `T08`
- `T09`

Цель:
- собрать backend и frontend archive semantics в единый рабочий поток.

Что должно войти:
- фиксация `primary/source document` инвариантов;
- корректное поведение `set-primary/link/unlink/archive`;
- перевод frontend archive flows на новые endpoints;
- выравнивание ошибок и пользовательских статусов в archive flows.

Что не должно войти:
- большой frontend cleanup;
- read-only polish beyond needed archive flow correctness;
- OCR/import changes.

Definition of Done:
- document/repair relation invariants соблюдаются;
- frontend больше не использует старые archive flows;
- archive/restore сценарии проходят end-to-end.

### PR5. OCR / Import Stability

Состав:
- `T11`
- `T12`

Цель:
- убрать дубли jobs и полусостояния в async/import workflows.

Что должно войти:
- идемпотентность OCR jobs;
- deduplication и race protection;
- транзакционные границы `upload/process/import`;
- cleanup/compensation для file/DB/queue failures;
- выравнивание error handling для этих цепочек.

Что не должно войти:
- labor norms P1/P2 cleanup;
- большой schema refactor beyond required scope;
- unrelated performance work.

Definition of Done:
- повторный запуск не создает дублей;
- сбой не оставляет битых полусостояний;
- workflow либо завершается целиком, либо откатывается/компенсируется.

### PR6. Auth Hardening

Состав:
- `T25`

Цель:
- закрыть security gap по сохранению активных JWT после изменения пароля.

Что должно войти:
- выбранный механизм invalidation;
- покрытие password change/reset/recovery;
- проверка токена на защищенных endpoint-ах;
- регрессионные тесты на старые и новые токены.

Что не должно войти:
- rate limiting;
- reset-link generation;
- дополнительная auth-функциональность вне текущего риска.

Definition of Done:
- старые JWT перестают работать после sensitive auth changes;
- новые токены валидны;
- нет регрессий по обычной авторизации.

---

## 4. Что можно делать параллельно

Допустимо параллельно:
- подготовка `T25`, пока идет доменная цепочка `T01-T09`;
- аналитика и технический дизайн `T11-T12`, пока еще идут `T06-T09`;
- подготовка smoke datasets и test fixtures в фоновом режиме.

Нельзя параллельно без жесткой координации:
- `T01-T09` несколькими PR в один и тот же слой `documents/repairs/archive`;
- `T08` и любые независимые изменения relation graph;
- `T11-T12` параллельно со schema changes вне их прямой области.

---

## 5. Точки контроля перед каждым PR

Перед началом каждого PR должно быть подтверждено:
- какие инварианты он меняет;
- какие regression tests уже есть;
- какие новые тесты нужно добавить;
- какие файлы и модули считаются зоной изменения;
- какие сценарии ручной проверки обязательны;
- какие старые пользовательские изменения в репозитории не трогаем.

---

## 6. Quality Gate по PR

### Общий минимум

- все новые баги и инварианты покрыты тестами;
- нет silent contract changes без явного описания;
- не затронуты несвязанные пользовательские изменения;
- backend и frontend изменения заходят синхронно, если меняется контракт;
- есть короткий список ручной проверки.

### По backend PR

- targeted backend tests проходят;
- добавлены negative tests на запрещенные действия;
- если меняется статусная логика, есть tests на transitions;
- если меняется БД, миграция поднимается на чистой схеме.

### По frontend PR

- `build` проходит;
- `tsc` проходит;
- проверены archive/detail/list сценарии при изменении contracts;
- нет старых client-side fallbacks на deprecated endpoints.

### По auth PR

- старые токены реально отклоняются;
- новые токены не ломают обычный login flow;
- проверены change/reset/recovery сценарии.

---

## 7. Минимальные тесты по задачам

### T00

- regression tests на каждый подтвержденный P0 дефект

### T01-T05

- archived `repair/document/vehicle` write-block tests
- review action outside queue negative tests
- partial `PATCH repair` preserving `checks`
- repair status transition tests
- negative tests на `upload/process/link/set-primary/compare` against archived entities

### T06-T09

- archive/restore API tests for `repair`
- archive/restore API tests for `document`
- relation invariants tests for `primary/source`
- frontend integration tests на archive flows
- end-to-end smoke на archive repair/document flow

### T11-T12

- concurrency tests на повторный OCR request
- unique/duplicate prevention tests
- failure injection tests на file write / DB / enqueue
- retry after failure tests
- orphan artifact cleanup tests

### T25

- active JWT invalidation after password change
- active JWT invalidation after password reset
- active JWT invalidation after recovery flow
- normal login/refresh regression tests

---

## 8. Минимальная ручная проверка

После каждого из ключевых PR нужна короткая ручная проверка.

### После PR2

- нельзя изменить архивный `repair`
- нельзя изменить архивный `document`
- нельзя выполнить review action вне queue
- `PATCH repair` не теряет `checks`

### После PR3

- archive/restore `repair` работает только через новые endpoints
- archive/restore `document` работает только через новые endpoints
- старые archive paths не считаются валидными

### После PR4

- frontend корректно архивирует и восстанавливает `repair/document`
- frontend не использует старый contract
- `primary/source` связи не ломаются после archive/link/unlink

### После PR5

- повторный OCR/process request не создает дубль
- сбой в workflow не оставляет мусор или битые записи
- retry выполняется предсказуемо

### После PR6

- после смены или сброса пароля старый токен больше не работает
- новый вход в систему работает штатно

---

## 9. Основные риски волны

### Риск 1. Фикс без закрепления инварианта

Последствие:
- баг уходит локально и возвращается на следующем PR.

Защита:
- сначала `T00`, затем код.

### Риск 2. Разъезд backend и frontend contracts

Последствие:
- backend уже исправлен, frontend еще живет на старой семантике.

Защита:
- разделять PR3 и PR4, но не растягивать между ними большой интервал.

### Риск 3. Слишком широкий PR

Последствие:
- тяжело ревьюить, тяжело откатывать, тяжело локализовать регрессию.

Защита:
- держать PR в рамках указанной нарезки.

### Риск 4. Незаметное повреждение исторических данных

Последствие:
- после фикса relation/archive поведение на legacy-данных становится хуже.

Защита:
- negative tests и отдельная проверка исторических edge-case записей.

### Риск 5. Async fixes без schema discipline

Последствие:
- `T11-T12` исправляют сервисный слой, но БД и миграции остаются в серой зоне.

Защита:
- не расширять скоуп волны, но явно зафиксировать schema assumptions и при необходимости подготовить follow-up в `T28`.

---

## 10. Условие завершения Wave 1

`Wave 1` считается завершенной, если:
- все задачи `T00-T09`, `T11-T12`, `T25` закрыты;
- regression suite покрывает найденные P0 дефекты;
- archive/restore semantics зафиксированы и работают end-to-end;
- `primary/source` инварианты не допускают известных противоречий;
- OCR/import workflow не оставляет подтвержденных дублей и полусостояний;
- старые JWT недействительны после sensitive auth changes;
- известные остаточные риски документированы.

---

## 11. Следующая волна после Wave 1

Логичный следующий блок:
- `T10`
- `T13-T24`
- `T26-T29`

То есть:
- read-only UX;
- labor norms and operational scope;
- audit visibility;
- backup/restore clarity;
- auth hardening continuation;
- ORM/migration consistency.

---

## 12. Связанные документы

- [МАСТЕР ПЛАН ПО ИСПРАВЛЕНИЮ ПРОЕКТА.md](/Users/svetlanasamojlova/курсор/road700/МАСТЕР%20ПЛАН%20ПО%20ИСПРАВЛЕНИЮ%20ПРОЕКТА.md)
- [JIRA_TICKETS_MASTER_BACKLOG.md](/Users/svetlanasamojlova/курсор/road700/JIRA_TICKETS_MASTER_BACKLOG.md)
- [JIRA_IMPORT_MASTER_BACKLOG.tsv](/Users/svetlanasamojlova/курсор/road700/JIRA_IMPORT_MASTER_BACKLOG.tsv)
- [START_DECISION_DOC.md](/Users/svetlanasamojlova/курсор/road700/START_DECISION_DOC.md)
