# Jira Tickets: Master Backlog `T00-T38`

Файл синхронизирован с [МАСТЕР ПЛАН ПО ИСПРАВЛЕНИЮ ПРОЕКТА](/Users/svetlanasamojlova/курсор/road700/МАСТЕР%20ПЛАН%20ПО%20ИСПРАВЛЕНИЮ%20ПРОЕКТА.md).

Формат каждого тикета:
- Summary
- Issue Type
- Priority
- Problem
- Goal
- Scope
- Out of Scope
- Files/Modules
- Acceptance Criteria
- Tests
- Dependencies
- Risks

---

## T00. Собрать regression-набор по найденным багам

- Summary: Собрать regression-набор по найденным критичным багам и зафиксировать текущие инварианты в тестах
- Issue Type: Task
- Priority: P0
- Problem: Подтвержденные баги по архиву, review queue, repair/document связям и import/OCR могут повторно появляться при следующих изменениях, потому что часть сценариев не закреплена автоматическими тестами.
- Goal: Получить минимальный, но надежный regression-набор, который воспроизводит выявленные дефекты и страхует дальнейшие фиксы.
- Scope: Добавить backend regression tests на archive guards, review queue eligibility, `PATCH /repairs/{id}` и сохранность `checks`, primary/source document invariants, archived vehicle/labor norms restrictions, OCR/import edge cases; при необходимости добавить smoke tests на frontend-критичные flows.
- Out of Scope: Полная переработка всей тестовой инфраструктуры; performance/load testing; массовое расширение E2E beyond critical cases.
- Files/Modules: `backend/tests`; repair/document/review/import/audit related services and API tests; critical frontend smoke flows if needed.
- Acceptance Criteria: Для каждого подтвержденного критичного дефекта есть тест, который падает до исправления и проходит после; regression-набор стабильно выполняется локально и в CI; тесты отражают реальные доменные инварианты, а не случайную текущую реализацию.
- Tests: Новый regression suite; selective API/integration tests; smoke tests на ключевые archive/review flows.
- Dependencies: Нет
- Risks: Если тесты будут писаться поверх текущих ошибок как "ожидаемого поведения", они закрепят неверную доменную модель.

## T01. Добавить backend guards для архивных `repair/document/vehicle`

- Summary: Добавить backend guards, запрещающие рабочие операции для архивных `repair`, `document` и `vehicle`
- Issue Type: Bug
- Priority: P0
- Problem: Архивные сущности продолжают участвовать в рабочих backend-сценариях, хотя архив должен быть read-only и исключенным из операционного контура.
- Goal: Зафиксировать единый backend-инвариант: архивная сущность доступна для чтения и истории, но не для рабочих изменений.
- Scope: Добавить общие guards в API/service layer; закрыть write/update/link/assignment и иные operational actions для архивных `repair`, `document`, `vehicle`; унифицировать ответы ошибок.
- Out of Scope: Frontend read-only UX; явные archive/restore endpoints; lifecycle для labor norm catalogs и services.
- Files/Modules: `backend/app/api/repairs.py`; `backend/app/api/documents.py`; `backend/app/api/vehicles.py`; related services/models/schemas.
- Acceptance Criteria: Любая рабочая операция над архивным `repair`, `document` или `vehicle` отклоняется на backend; прямой API вызов не позволяет обойти ограничение; ответы ошибок единообразны.
- Tests: API tests на archived entity guards; regression tests на прямые write/link actions against archived entities.
- Dependencies: `T00`
- Risks: Если guards будут размазаны по endpoint-ам без общего слоя, останутся непокрытые write-paths.

## T02. Закрыть review action для не-queue документов

- Summary: Ограничить review actions только реальными элементами review queue
- Issue Type: Bug
- Priority: P0
- Problem: Review action можно вызвать для документа вне реальной очереди review, что ломает доменную логику согласования и допускает невалидные переходы.
- Goal: Разрешать review action только для документов, которые действительно находятся в review queue и удовлетворяют правилам review.
- Scope: Проверить eligibility на backend; связать review action с реальным queue item и допустимым статусом; унифицировать ошибки; исключить обход через прямой API вызов.
- Out of Scope: Оптимизация review queue; redesign review UI; изменение общей review policy beyond current invariant.
- Files/Modules: `backend/app/api/review.py`; `backend/app/schemas/review.py`; `backend/app/models/review_rule.py`; document/review services.
- Acceptance Criteria: Review action невозможен для документов вне queue; статусные переходы review выполняются только по допустимому сценарию; прямой вызов API не обходит queue eligibility.
- Tests: API tests на valid/invalid review actions; regression tests on out-of-queue review attempts.
- Dependencies: `T00`
- Risks: Ошибка в eligibility-логике может начать отклонять валидные queue items.

## T03. Исправить `PATCH /repairs/{id}` чтобы не стирал `checks`

- Summary: Исправить `PATCH /repairs/{id}`, чтобы частичное обновление не затирало `checks`
- Issue Type: Bug
- Priority: P0
- Problem: Общий patch/update ремонта приводит к потере ранее сохраненных `checks`, даже если пользователь не обновлял их в текущем запросе.
- Goal: Гарантировать корректную partial update semantics без потери независимых полей и связанных данных.
- Scope: Пересмотреть merge/update логику для ремонта; отделить update `checks` от остальных полей; выровнять schemas/patch handling; защитить сценарии частичного обновления.
- Out of Scope: Полная переработка repair payload; redesign UI редактирования ремонта; state machine fix при check updates.
- Files/Modules: `backend/app/api/repairs.py`; `backend/app/schemas/repair.py`; `backend/app/models/repair.py`; related repair services.
- Acceptance Criteria: Частичный `PATCH` без поля `checks` не меняет существующие `checks`; явное обновление `checks` продолжает работать; старые сценарии обновления ремонта не ломаются.
- Tests: API tests on partial patch; regression tests on preserving existing checks; negative tests on malformed patch payloads.
- Dependencies: `T00`
- Risks: Неверный merge-алгоритм может начать сохранять устаревшие данные там, где ожидалось явное очищение поля.

## T04. Запретить `upload/process/link/set-primary/compare` на архивных сущностях

- Summary: Закрыть все рабочие document/repair actions для архивных сущностей
- Issue Type: Bug
- Priority: P0
- Problem: Даже при наличии частичных archive checks отдельные действия вроде `upload`, `process`, `link`, `set-primary`, `compare` остаются доступны для архивных сущностей.
- Goal: Полностью исключить рабочие document/repair actions из архивного контура.
- Scope: Выделить полный список архивозапрещенных действий; закрыть их на backend; проверить обработку смешанных сценариев "активный repair + архивный document" и наоборот; унифицировать response contract.
- Out of Scope: Frontend read-only presentation; archive/restore endpoint redesign; починка primary/source invariants.
- Files/Modules: `backend/app/api/documents.py`; `backend/app/api/repairs.py`; `backend/app/services/document_processing.py`; import/linking related services.
- Acceptance Criteria: `upload/process/link/set-primary/compare` недоступны для архивных сущностей; ограничения работают независимо от UI; смешанные невалидные сценарии корректно отклоняются.
- Tests: API tests on archived document/repair actions; regression tests on mixed active/archived relation scenarios.
- Dependencies: `T00`, `T01`
- Risks: Если список закрываемых действий будет неполным, архив останется проницаемым через менее очевидные endpoints.

## T05. Исправить state machine ремонта при `check updates`

- Summary: Исправить state machine ремонта при обновлении проверок
- Issue Type: Bug
- Priority: P0
- Problem: Обновление `checks` переводит ремонт в неконсистентное состояние или обходит ожидаемые переходы state machine.
- Goal: Зафиксировать корректные переходы статусов ремонта при изменениях в блоке `checks`.
- Scope: Описать допустимые transitions; обновить сервисную логику repair status changes; синхронизировать поведение с review/report flows; унифицировать ошибки для недопустимых переходов.
- Out of Scope: Полный redesign state machine ремонта; UI-рефакторинг repair details; primary/source relation fixes.
- Files/Modules: `backend/app/models/repair.py`; `backend/app/schemas/repair.py`; `backend/app/api/repairs.py`; related repair services.
- Acceptance Criteria: Обновление `checks` не приводит к запрещенным или неявным status transitions; допустимые переходы фиксированы и покрыты тестами; downstream сценарии ремонта продолжают работать.
- Tests: Model/service tests on state transitions; regression tests for check update paths.
- Dependencies: `T03`
- Risks: При фиксе статусов можно затронуть смежные сценарии review/reporting, которые неявно завязаны на текущее поведение.

## T06. Выделить явные archive/restore endpoints для `repair`

- Summary: Вынести archive/restore ремонта в отдельные явные backend endpoints
- Issue Type: Bug
- Priority: P0
- Problem: Архивация ремонта реализована неявно или смешана с обычным update flow, из-за чего архивная семантика размыта и плохо контролируется.
- Goal: Сделать archive/restore ремонта отдельной явной операцией с понятным контрактом.
- Scope: Добавить отдельные endpoints archive/restore; убрать скрытую архивацию через generic patch; определить post-conditions и audit hooks; выровнять response schema.
- Out of Scope: Frontend migration на новые endpoints; archive/restore documents; read-only UI для архива.
- Files/Modules: `backend/app/api/repairs.py`; `backend/app/schemas/repair.py`; repair service layer; audit hooks if needed.
- Acceptance Criteria: Архивирование и восстановление ремонта выполняются только через отдельные endpoints; generic patch больше не меняет archive state; контракт явный и тестируемый.
- Tests: API tests on repair archive/restore; regression tests on blocking old patch-based archive behavior.
- Dependencies: `T01`, `T04`
- Risks: Неполный отрыв archive semantics от generic update может оставить два конкурирующих способа менять состояние ремонта.

## T07. Выделить явные archive/restore endpoints для `document`

- Summary: Вынести archive/restore документа в отдельные явные backend endpoints
- Issue Type: Bug
- Priority: P0
- Problem: Архивация документа использует неочевидный контракт и конфликтует с операциями линковки, primary/source и review.
- Goal: Сделать архивирование документа отдельной контролируемой операцией с четким жизненным циклом.
- Scope: Добавить отдельные endpoints archive/restore; запретить изменение archive state через generic update; зафиксировать допустимые предусловия и постусловия; подготовить основу для frontend migration.
- Out of Scope: Frontend migration на новые endpoints; primary/source relation fix; read-only UI.
- Files/Modules: `backend/app/api/documents.py`; `backend/app/schemas/document.py`; `backend/app/models/document.py`; document service layer.
- Acceptance Criteria: Архивирование и восстановление документа выполняются только через явные endpoints; generic update больше не меняет archive state; контракт согласован с review/link flows.
- Tests: API tests on document archive/restore; regression tests on old archive behavior paths.
- Dependencies: `T01`, `T04`
- Risks: Документ участвует в большем числе связей, поэтому archive/restore может неожиданно затронуть review и repair linkage.

## T08. Починить инварианты `primary/source document`

- Summary: Зафиксировать и восстановить инварианты `primary document` и `source document`
- Issue Type: Bug
- Priority: P0
- Problem: Связи `primary/source document` допускают противоречивые состояния, потерю консистентности или циклические комбинации.
- Goal: Сделать поведение `primary/source document` однозначным и запретить недопустимые комбинации связей.
- Scope: Определить ownership и cardinality связей; закрыть конфликтующие операции `set-primary/link/unlink/archive`; выровнять ORM, API и service logic; предусмотреть миграцию/нормализацию существующих данных при необходимости.
- Out of Scope: Полная нормализация всей relation model `document-repair`; frontend UX polishing; OCR workflow redesign.
- Files/Modules: `backend/app/models/document.py`; `backend/app/models/repair.py`; `backend/app/api/documents.py`; `backend/app/api/repairs.py`; related schemas/services.
- Acceptance Criteria: Недопустимые комбинации `primary/source` больше не создаются; текущие данные можно привести к валидному состоянию; API и ORM одинаково трактуют связи.
- Tests: Model/service tests on primary/source invariants; API tests on set-primary/link/unlink/archive interactions.
- Dependencies: `T06`, `T07`
- Risks: Ошибка в доменной формализации может зафиксировать неверную модель связи и затронуть исторические данные.

## T09. Перевести frontend archive flows на новые endpoints

- Summary: Перевести frontend archive flows на отдельные repair/document archive/restore endpoints
- Issue Type: Bug
- Priority: P0
- Problem: Frontend использует старую архивную семантику и generic update flows, которые больше не соответствуют целевому backend contract.
- Goal: Сделать frontend-контур архивации полностью совместимым с новыми backend endpoints и инвариантами.
- Scope: Обновить API calls для archive/restore repair/document; убрать старые patch-based flows; скорректировать optimistic updates, notifications и error handling; проверить deep-link и list/detail сценарии.
- Out of Scope: Read-only UX для архива; полная очистка frontend API layer; redesign archive screens.
- Files/Modules: frontend repair/document actions; shared API client/types; detail/list screens for repairs and documents.
- Acceptance Criteria: Frontend архивирует и восстанавливает repair/document только через новые endpoints; старые архивные вызовы не используются; ошибки и статусы корректно отображаются пользователю.
- Tests: Frontend integration tests on archive/restore flows; smoke tests on repair/document detail screens.
- Dependencies: `T06`, `T07`, `T08`
- Risks: Если оставить старые client-side fallbacks, часть экранов продолжит дергать deprecated flows.

## T10. Привести UI ремонта/документов к read-only архиву

- Summary: Привести карточки ремонта и документов к корректному read-only поведению для архивных сущностей
- Issue Type: Bug
- Priority: P1
- Problem: После перевода архивирования на отдельные backend-contracts UI все еще может показывать редактирование, загрузку, линковку, смену primary/source и другие рабочие действия для архивных ремонтов и документов. Это противоречит логике архива и вводит пользователя в заблуждение.
- Goal: Сделать поведение UI консистентным с backend-инвариантом: архивная сущность доступна для просмотра, но не для рабочих изменений.
- Scope: Добавить единый признак read-only для архивных `repair` и `document`; скрыть или дизейблить кнопки `upload/process/link/set-primary/compare/edit/delete`; показать явный статус архива в карточке и списках; добавить понятные тексты ошибок/подсказок; проверить deep-link сценарии, чтобы архивная карточка не открывалась в рабочем режиме.
- Out of Scope: Изменение backend endpoint contracts; реализация backend guards; переработка общей дизайн-системы.
- Files/Modules: frontend repair details; frontend document details; preview/action panels; shared repair/document UI state; archive-related action handlers.
- Acceptance Criteria: Архивный ремонт открывается только в режиме просмотра; архивный документ открывается только в режиме просмотра; кнопки рабочих операций отсутствуют или недоступны; пользователь видит явный статус архива; прямой переход по URL не позволяет обойти read-only режим; UI не делает вызовы рабочих endpoint-ов для архивных сущностей.
- Tests: Unit/integration tests для conditional rendering и action guards; smoke E2E на архивный repair; smoke E2E на архивный document; ручная проверка сценариев deep-link.
- Dependencies: `T06`, `T07`, `T08`, `T09`
- Risks: Если ограничиться только скрытием кнопок без единого read-only state, останутся обходные сценарии через прямые ссылки и старые формы.

## T11. Ввести идемпотентность OCR jobs

- Summary: Сделать создание OCR jobs идемпотентным и исключить дубли задач на один и тот же документ
- Issue Type: Bug
- Priority: P0
- Problem: Повторные запросы на OCR/processing могут создавать несколько активных jobs для одного документа или одного и того же входного файла. Это ведет к дублям обработки, гонкам статусов, лишней нагрузке и неоднозначным итоговым данным.
- Goal: Обеспечить не более одной актуальной OCR job на один логический объект обработки в заданный момент времени.
- Scope: Определить ключ идемпотентности; добавить deduplication на API/service уровне; зафиксировать поведение при повторном запросе; закрыть race conditions конкурентных запросов; при необходимости добавить уникальные ограничения/индексы и migration; выровнять статусы активной/завершенной/ошибочной job.
- Out of Scope: Полная переработка очереди; транзакционный rework всех import workflows; оптимизация OCR quality.
- Files/Modules: document processing jobs; OCR/import services; imports/documents API; jobs models and migrations; worker queue integration.
- Acceptance Criteria: Повторный запрос для одного и того же документа не создает вторую активную OCR job; конкурентные запросы не приводят к дублям; клиент получает предсказуемый ответ при повторном вызове; в БД нет двух активных jobs на один и тот же логический ключ; retry безопасен.
- Tests: Concurrency tests; API tests на повторный вызов; tests на unique/index constraints; regression tests на повторную постановку в очередь.
- Dependencies: Нет жестких, но желательно выполнить до `T12`
- Risks: Неправильно выбранный idempotency key может начать склеивать разные пользовательские операции.

## T12. Сделать транзакционные workflow `upload/process/import`

- Summary: Перестроить upload/process/import workflow так, чтобы операции были атомарными и не оставляли полусостояния
- Issue Type: Bug
- Priority: P0
- Problem: Текущие цепочки загрузки, записи файла, создания DB-сущностей и постановки jobs в очередь выполняются не как единая операция. При ошибках возникают orphan files, dangling DB records, пустые jobs и несогласованные статусы.
- Goal: Добиться предсказуемого атомарного поведения: либо workflow успешно зафиксирован целиком, либо система корректно откатывается/компенсирует шаги.
- Scope: Пересмотреть порядок шагов `upload/process/import`; определить транзакционные границы; добавить compensation/cleanup для файлов и записей; унифицировать обработку ошибок; выровнять статусную модель; запретить сохранение промежуточных невалидных состояний; обновить контракты ошибок.
- Out of Scope: Миграция на внешнюю orchestration platform; redesign OCR matching logic; оптимизация производительности.
- Files/Modules: imports API; documents API; import jobs service; document processing service; file storage integration; models/schemas of jobs/imports/documents.
- Acceptance Criteria: Ошибка на любом шаге не оставляет битых связей и orphan artifacts; DB и файловое хранилище согласованы; статус сущности после сбоя однозначен; повторный запуск после сбоя проходит корректно; пользователь получает единый формат ошибки.
- Tests: Failure-injection tests для file write/DB enqueue; integration tests на rollback/cleanup; regression tests на повторный импорт после падения; manual smoke на загрузку и OCR.
- Dependencies: `T11`
- Risks: Ошибки в compensation logic могут маскировать первичную причину сбоя или удалять валидные артефакты.

## T13. Подключить общую upload-validation к `labor-norms/import`

- Summary: Перевести импорт нормо-часов на общий механизм валидации загружаемых файлов
- Issue Type: Bug
- Priority: P1
- Problem: Импорт нормо-часов использует отдельную или неполную валидацию файлов, из-за чего допускаются расхождения по размеру, расширению, MIME, структуре ошибок и правилам отклонения.
- Goal: Добиться одного источника правды для upload validation во всех сценариях импорта.
- Scope: Выделить/доработать общий validation layer; подключить его к `labor-norms/import`; унифицировать формат ошибок; проверить ограничения по расширениям, MIME, размеру и пустым файлам; убрать локальные дублирующие проверки.
- Out of Scope: Валидация содержания бизнес-данных внутри файла; переработка UI импорта; OCR/import transaction rework.
- Files/Modules: labor norms import API; shared upload validation; imports schemas; frontend import error handling if contract changes.
- Acceptance Criteria: Импорт нормо-часов использует тот же validation pipeline, что и другие upload flows; невалидные файлы отклоняются одинаково; формат ошибок единый; дублированные локальные проверки удалены или сведены к минимуму.
- Tests: API tests на MIME/extension/size/empty file; regression tests для valid import; contract tests на error payload.
- Dependencies: Желательно после `T12`, но может делаться отдельно
- Risks: Слишком жесткая унификация может случайно заблокировать допустимые legacy-файлы импорта.

## T14. Исключить архивную технику из operational lists/search

- Summary: Исключить архивные транспортные средства из рабочих списков и поиска по умолчанию
- Issue Type: Bug
- Priority: P1
- Problem: Архивная техника продолжает попадать в operational list/search, из-за чего пользователь может выбрать неактуальный объект в рабочих сценариях.
- Goal: По умолчанию рабочие списки и поиск должны возвращать только активную технику; архив должен попадать только в явных архивных или административных сценариях.
- Scope: Исправить backend default filtering; синхронизировать frontend filters и search requests; убрать архив из autocomplete/select/search по умолчанию; сохранить возможность явного просмотра архива там, где это нужно по роли.
- Out of Scope: Перенос исторических отчетов на новую модель; изменение сущности vehicle archive lifecycle.
- Files/Modules: vehicles API; vehicle search/list queries; frontend vehicle selectors; operational pages consuming vehicle lookup.
- Acceptance Criteria: В рабочих списках архивная техника не отображается по умолчанию; поиск не возвращает архивную технику без явного archive filter; autocomplete не подсказывает архивные машины; административный просмотр архива остается возможным по согласованному сценарию.
- Tests: API tests на default filters; frontend integration tests для search/select; regression tests на archive filter behavior.
- Dependencies: Логически связан с `T01`
- Risks: Если фильтрация будет реализована только на frontend, архив продолжит просачиваться в интеграционные и API-based сценарии.

## T15. Убрать архивную технику из назначения сотруднику

- Summary: Запретить назначение архивной техники сотруднику и убрать ее из соответствующих форм выбора
- Issue Type: Bug
- Priority: P1
- Problem: Сотруднику можно назначить архивную технику, что нарушает доменную логику и порождает неконсистентные рабочие состояния.
- Goal: Исключить возможность новых назначений на архивную технику на всех уровнях системы.
- Scope: Добавить backend validation при назначении; убрать архивную технику из dropdown/autocomplete/selectors; обработать сценарий, когда техника была архивирована уже после существующего назначения; определить корректное сообщение пользователю.
- Out of Scope: Массовая миграция исторических назначений; изменение HR/workforce бизнес-процесса.
- Files/Modules: employee assignment flows; vehicles API; employee-related forms; assignment validation on backend.
- Acceptance Criteria: Новое назначение архивной техники невозможно; UI не предлагает архивную технику для выбора; backend блокирует прямой API вызов с архивным vehicle; существующие исторические назначения не ломают просмотр и отчеты.
- Tests: API validation tests; frontend tests на selectors; regression test на assignment after archive.
- Dependencies: `T14`
- Risks: Нужно аккуратно разделить новые назначения и исторические данные, чтобы не сломать просмотр прошлого состояния.

## T16. Запретить рабочие операции с архивным каталогом нормо-часов

- Summary: Сделать архивный каталог нормо-часов полностью нерабочим для изменений и операционных действий
- Issue Type: Bug
- Priority: P1
- Problem: Архивный каталог нормо-часов может участвовать в рабочих операциях: редактировании, импорте, активации, изменении scope/items и других действиях, хотя должен быть read-only.
- Goal: Зафиксировать backend-инвариант: архивный каталог доступен только для просмотра и истории.
- Scope: Добавить guards на write/update/import/activate/deactivate/scopes/items; запретить любые операции, меняющие состояние архивного каталога; выровнять ответы API; задокументировать допустимые и недопустимые transitions.
- Out of Scope: Исключение архивных каталогов из matching; UI cleanup списков и форм; аудит каталога.
- Files/Modules: labor norms API; labor norm catalog model; labor norm item/scopes operations; import endpoints for labor norms.
- Acceptance Criteria: Любая рабочая операция над архивным каталогом отклоняется; API возвращает единый предсказуемый ответ; архивный каталог остается доступен для чтения и истории; активный каталог продолжает работать без регрессий.
- Tests: API tests на все write operations against archived catalog; regression tests на normal active catalog flow; negative tests на import/edit/activate.
- Dependencies: Нет жестких
- Risks: Если не покрыть все endpoints, часть write-path останется открытой через менее очевидные операции.

## T17. Убрать архивный каталог нормо-часов из operational matching

- Summary: Исключить архивные каталоги нормо-часов из OCR/repair matching и других рабочих механизмов подбора
- Issue Type: Bug
- Priority: P1
- Problem: Matching логика может использовать архивные каталоги как источник нормо-часов, из-за чего в рабочий процесс попадают неактуальные или запрещенные данные.
- Goal: Все рабочие механизмы подбора должны использовать только активные каталоги в допустимом scope.
- Scope: Исправить backend queries/services matching; исключить архивные каталоги и их items/scopes из selection logic; выровнять кэширование/предзагрузку; определить поведение при отсутствии активного каталога.
- Out of Scope: Общая оптимизация качества matching; UI изменения форм выбора каталога; аудит.
- Files/Modules: labor norms matching service; OCR-related matching flows; repair calculation flows; labor norm catalog queries.
- Acceptance Criteria: Matching не использует архивные каталоги; архивный каталог не может стать источником рекомендаций/подстановки; при отсутствии активного каталога система ведет себя предсказуемо и явно; результаты matching для активных каталогов не деградируют.
- Tests: Unit tests на query/filter logic; integration tests на OCR/repair matching; regression tests с mixed active/archived catalogs.
- Dependencies: `T16`
- Risks: Ошибка в фильтрах может незаметно поменять business output matching и повлиять на точность рекомендаций.

## T18. Скрыть архивные каталоги из рабочих UI-форм нормо-часов

- Summary: Убрать архивные каталоги нормо-часов из рабочих форм, селекторов и пользовательских сценариев
- Issue Type: Bug
- Priority: P1
- Problem: Даже после backend-ограничений UI может продолжать показывать архивные каталоги в формах выбора, что создает ложное ощущение доступности и увеличивает число ошибок пользователя.
- Goal: Рабочий UI должен по умолчанию оперировать только активными каталогами; архив виден только в специальных архивных/административных экранах.
- Scope: Обновить data loaders/selectors; убрать архивные каталоги из dropdowns, autocomplete и форм привязки; добавить явные обозначения в архивных списках; синхронизировать frontend filter state с backend.
- Out of Scope: Изменение backend contract; переработка всех экранов каталога; внедрение новых archive dashboards.
- Files/Modules: labor norms frontend forms; catalog selectors; import/matching-related UI; shared frontend types for labor norms.
- Acceptance Criteria: Рабочие формы не показывают архивные каталоги; пользователь не может случайно выбрать архивный каталог в рабочем сценарии; архивные каталоги остаются доступны в явных архивных экранах, если такие предусмотрены.
- Tests: Frontend integration tests для selectors/forms; smoke tests на рабочие сценарии нормо-часов; regression tests на archive/admin views.
- Dependencies: `T16`, частично `T17`
- Risks: Если фронтенд и бэкенд-фильтры разъедутся, появятся трудноуловимые баги с "пропадающими" или "лишними" каталогами.

## T19. Формализовать жизненный цикл сервисов и архивного сервиса

- Summary: Зафиксировать явную lifecycle-модель для сервисов и архивного сервиса, чтобы убрать неявные и противоречивые переходы состояний
- Issue Type: Task
- Priority: P1
- Problem: Поведение сущности `service` и ее архивирования неформализовано: возможны неочевидные статусы, слабые инварианты, разное понимание "активного/архивного" сервиса в backend, UI и смежных сценариях.
- Goal: Ввести явную lifecycle-модель сервиса с понятными статусами, разрешенными переходами и ограничениями операций.
- Scope: Описать и внедрить допустимые состояния и переходы; выровнять model/schema/API; определить ограничения на операции с архивным сервисом; убрать неявные ветки логики; добавить регрессионные тесты; при необходимости подготовить migration текущих данных к новой модели.
- Out of Scope: Добавление audit coverage; изменение employee workflow; redesign service UI.
- Files/Modules: services API; service model/schema; service-related frontend screens; archive/restore business rules.
- Acceptance Criteria: Состояния сервиса и допустимые переходы явно описаны и отражены в коде; архивный сервис не участвует в запрещенных операциях; backend и frontend одинаково трактуют статус сервиса; существующие записи мигрированы без потери логики; покрыты ключевые переходы и ошибки.
- Tests: Model/service tests на state transitions; API tests на archive/restore and invalid transitions; regression tests для existing service flows.
- Dependencies: Нет жестких, но логично завершить до `T20`
- Risks: Плохая формализация lifecycle может закрепить неверную бизнес-логику, поэтому нужно сверять решение с фактическими сценариями проекта.

## T20. Добавить аудит на `services`

- Summary: Добавить полное audit-покрытие для операций с сервисами
- Issue Type: Task
- Priority: P1
- Problem: Изменения по сущности `service` выполняются без достаточного аудита, из-за чего невозможно надежно восстановить, кто и когда создал, изменил, архивировал или восстановил сервис.
- Goal: Обеспечить прозрачную и полную трассируемость ключевых операций над сервисами.
- Scope: Добавить audit events для create/update/archive/restore/status changes; унифицировать payload аудита; зафиксировать actor, timestamp, target entity, old/new values; проверить чтение этих событий в audit API/UI.
- Out of Scope: Переработка всей audit-системы; изменение retention policy; переработка employee visibility.
- Files/Modules: backend services API; service model/service layer; audit model/schema/API; frontend history/audit views if event contract changes.
- Acceptance Criteria: Все ключевые операции над `service` создают audit event; event содержит достаточный набор данных для расследования; отсутствуют "тихие" изменения без следа в аудите; чтение аудита по сервису работает корректно.
- Tests: API/service tests на генерацию audit events; regression tests на archive/restore/update; contract tests на audit payload.
- Dependencies: `T19`
- Risks: Чрезмерно подробный payload может раскрывать лишние поля или создавать шум в аудите.

## T21. Добавить аудит на `labor-norm catalogs/items/import`

- Summary: Покрыть аудитом каталоги нормо-часов, элементы каталога и импорт нормо-часов
- Issue Type: Task
- Priority: P1
- Problem: Существенные изменения в каталогах нормо-часов и import flow происходят без полного аудита, что мешает разбирать инциденты, откаты и причины изменения расчетной базы.
- Goal: Сделать изменения нормо-часов и связанных импортов полностью трассируемыми.
- Scope: Добавить audit events для create/update/archive/restore catalog; create/update/delete items; import start/success/failure; связать события импорта с измененными сущностями; унифицировать формат payload.
- Out of Scope: Аудит OCR quality; полная переработка import engine; изменение UI beyond displaying existing events.
- Files/Modules: labor norms API/services; imports API/services; labor norm catalog/item models; audit model/schema/API.
- Acceptance Criteria: Изменения каталогов и элементов фиксируются в аудите; запуск и итог импорта фиксируются в аудите; можно проследить связь между импортом и изменением каталога; события читаются через существующий audit flow.
- Tests: API tests на catalog/item actions; tests на import success/failure audit; regression tests на archive/restore catalog.
- Dependencies: Нет жестких, но логично после `T16-T18`
- Risks: При пакетных изменениях импорт может создавать слишком много мелких audit events и ухудшать читаемость лога.

## T22. Пересмотреть audit-visibility для сотрудника

- Summary: Ограничить employee audit visibility до разрешенного уровня и убрать избыточный доступ
- Issue Type: Bug
- Priority: P1
- Problem: Сотрудник видит слишком широкий аудит или может получать audit-данные, не относящиеся к его зоне ответственности. Это создает риск утечки внутренних действий и нарушает ожидаемую модель доступа.
- Goal: Привести видимость audit logs в соответствие с ролями и фактическими бизнес-ограничениями.
- Scope: Уточнить policy доступа к audit; ограничить employee-level выборки; разделить self/history, team-level и admin-level просмотр; проверить backend filters и frontend entry points; обновить error/empty-state поведение.
- Out of Scope: Полная RBAC-перестройка приложения; изменение структуры audit events; внешняя SIEM-интеграция.
- Files/Modules: audit API; auth/permissions layer; employee-facing history/audit screens; audit schemas and filters.
- Acceptance Criteria: Сотрудник не видит чужие или лишние audit-события; администратор/разрешенные роли сохраняют необходимый доступ; прямой API вызов также ограничен; UI не показывает недоступные события и не раскрывает лишние метаданные.
- Tests: Permission tests на audit endpoints; frontend tests на employee/admin views; negative tests на cross-entity access.
- Dependencies: Желательно после `T20`, `T21`
- Risks: Слишком агрессивное ограничение может скрыть события, которые действительно нужны для операционного разбора.

## T23. Зафиксировать честный backup contract

- Summary: Привести backup/restore contract к реальному поведению системы и убрать ложные ожидания
- Issue Type: Bug
- Priority: P1
- Problem: Документированный или UI-подразумеваемый backup contract не совпадает с фактическим составом бэкапа и результатом восстановления. Пользователь может считать, что система восстанавливает больше данных или состояний, чем на самом деле.
- Goal: Сформулировать и внедрить честный backup contract: что именно входит в backup, что восстанавливается, какие ограничения и постусловия гарантируются.
- Scope: Проанализировать фактический состав backup/restore; обновить backend contract и metadata; скорректировать API response/messages; при необходимости переименовать режимы и статусы; выровнять документацию и системные тексты.
- Out of Scope: Полная замена backup engine; внедрение point-in-time recovery; изменение внешней инфраструктуры хранения backup.
- Files/Modules: backups API/service; backup schemas; restore status handling; docs/help texts if stored in repo; frontend texts if contract exposure changes.
- Acceptance Criteria: Contract явно описывает состав backup и ограничения restore; API и UI больше не обещают недоступное поведение; пользователь может понять, какие данные гарантированно восстановятся; тесты подтверждают контракт.
- Tests: API tests на backup metadata; restore flow tests; regression tests на contract responses.
- Dependencies: Нет жестких
- Risks: Если зафиксировать контракт без учета фактической эксплуатации, можно узаконить неудобное или неполное поведение.

## T24. Исправить post-restore поведение frontend

- Summary: Привести поведение frontend после restore в соответствие с реальным результатом восстановления
- Issue Type: Bug
- Priority: P1
- Problem: После restore frontend может оставаться в устаревшем состоянии, показывать невалидные данные, продолжать работать с просроченными сущностями или неправильно информировать пользователя об успешности восстановления.
- Goal: Сделать post-restore UX предсказуемым и безопасным: интерфейс должен корректно переинициализироваться после восстановления.
- Scope: Определить обязательные post-restore действия; сбросить несогласованные client states/caches; корректно обработать текущую сессию, навигацию и уведомления; выровнять success/failure UX; проверить поведение открытых экранов после restore.
- Out of Scope: Изменение самого backup engine; redesign restore UI; внедрение глобальной offline/online state machine.
- Files/Modules: frontend restore flow; global app state/query cache; auth/session handling after restore; backup-related screens.
- Acceptance Criteria: После restore UI не показывает устаревшие данные; необходимые экраны корректно перезагружаются или закрываются; пользователь получает точное сообщение о результате; система не продолжает работу в неконсистентном client state.
- Tests: Frontend integration tests на restore flow; smoke test на восстановление и последующую навигацию; regression tests на stale cache/session behavior.
- Dependencies: `T23`
- Risks: Если не учесть все источники client state, останутся трудноуловимые ошибки после частичного восстановления.

## T25. Усилить auth: revoke active JWT

- Summary: Отзывать активные JWT после смены, сброса или восстановления пароля
- Issue Type: Bug
- Priority: P0
- Problem: После password change/reset/recovery старые активные JWT продолжают работать. Это создает прямой риск безопасности: скомпрометированные сессии не инвалидируются.
- Goal: Гарантировать, что после смены учетных данных старые токены теряют валидность.
- Scope: Выбрать механизм invalidation (`token version`, `session generation` или `blacklist`); внедрить проверку на каждом auth-required request; покрыть password change, reset, recovery и аналогичные sensitive flows; выровнять logout-all-sessions semantics.
- Out of Scope: Полная замена auth architecture; MFA; внешний identity provider.
- Files/Modules: auth/session layer; JWT validation; user model fields affecting token validity; password reset/change services; auth API.
- Acceptance Criteria: После смены/сброса/восстановления пароля ранее выданные JWT больше не принимаются; новые токены продолжают работать штатно; чувствительные auth flows покрыты единым правилом invalidation; регрессий по обычной авторизации нет.
- Tests: Security tests на token invalidation; API tests на password change/reset/recovery; regression tests на обычный login/refresh flow.
- Dependencies: Нет жестких
- Risks: Неполная интеграция invalidation в middleware может оставить часть endpoints доступными по старым токенам.

## T26. Добавить rate limit на login/reset

- Summary: Ввести rate limiting для login и password reset endpoints
- Issue Type: Bug
- Priority: P1
- Problem: Эндпоинты логина и запроса сброса пароля недостаточно защищены от brute-force и abuse, что повышает риск подбора пароля, enumeration и перегрузки сервисов.
- Goal: Ограничить частоту обращений к чувствительным auth endpoint-ам без деградации нормального пользовательского сценария.
- Scope: Добавить rate limiting для login/reset request; определить ключи ограничения (`IP`, `user/email`, комбинированный вариант); унифицировать response contract и retry messaging; учесть trusted proxy/network setup; логировать срабатывания.
- Out of Scope: CAPTCHA; MFA; глобальный WAF/infra rate limiting.
- Files/Modules: auth API; password reset request flow; middleware/rate limiting layer; audit/logging if used.
- Acceptance Criteria: Повторные попытки логина и reset request ограничиваются по заданным правилам; пользователь получает корректный ответ без утечки чувствительной информации; система устойчива к базовым abuse-сценариям; лимиты не ломают стандартное использование.
- Tests: API tests на threshold and cooldown; negative tests на brute-force patterns; regression tests на normal login/reset.
- Dependencies: Нет жестких, можно параллельно с `T25`
- Risks: Слишком жесткие лимиты создадут ложные блокировки для реальных пользователей, слишком мягкие не дадут эффекта.

## T27. Исправить reset-link generation

- Summary: Исправить генерацию ссылок восстановления пароля и сделать ее стабильной во всех окружениях
- Issue Type: Bug
- Priority: P1
- Problem: Генерация reset link работает неконсистентно: возможны неправильный base URL, ошибка в маршруте, несоответствие frontend/backend контрактов или некорректные ссылки в письмах.
- Goal: Обеспечить корректную, безопасную и предсказуемую генерацию reset links.
- Scope: Проверить origin/base URL resolution; выровнять path/query token format; синхронизировать backend email template и frontend reset page; учесть environment-specific config; исключить генерацию битых или небезопасных ссылок.
- Out of Scope: Полный redesign email templates; внедрение branded email platform; MFA recovery.
- Files/Modules: password reset token service; email delivery templates/services; frontend reset password route/page; auth config.
- Acceptance Criteria: Ссылка восстановления корректно открывает нужную frontend страницу; токен валидно передается и обрабатывается; ссылки работают в поддерживаемых окружениях; некорректные/просроченные ссылки отрабатываются предсказуемо.
- Tests: Service tests на reset link generation; integration test email-to-frontend flow; frontend tests на reset page with token; regression tests на invalid/expired token.
- Dependencies: Желательно рядом с `T25`, `T26`
- Risks: Ошибка в environment config может снова проявиться только после деплоя, поэтому нужна проверка на нескольких конфигурациях.

## T28. Выровнять ORM и миграции для imports/jobs/conflicts

- Summary: Устранить schema drift между ORM-моделями, миграциями и фактической схемой для imports/jobs/conflicts
- Issue Type: Technical Debt
- Priority: P1
- Problem: Модели ORM, alembic migrations и фактические таблицы import/jobs/conflicts разъехались. Это создает риск падений на проде, нестабильных миграций, расхождения test/prod поведения и скрытых ошибок на чтении/записи.
- Goal: Свести схему к одному согласованному источнику правды и сделать миграции воспроизводимыми.
- Scope: Провести инвентаризацию текущей схемы; сверить ORM, migrations и runtime expectations; исправить названия полей/constraints/indexes/status fields; добавить или поправить миграции; задокументировать ожидаемое состояние схемы.
- Out of Scope: Полный redesign import domain; переписывание всей очереди jobs; изменение unrelated tables.
- Files/Modules: imports models/schemas; document processing job models; alembic migrations for imports/jobs/conflicts; related services and tests.
- Acceptance Criteria: ORM соответствует фактической схеме; чистый подъем БД через migrations дает рабочую схему; test/prod schema behavior совпадает по ключевым ограничениям; import/jobs/conflicts работают без ad-hoc обходов.
- Tests: Migration tests from clean DB; upgrade tests from existing DB snapshot if available; integration tests for import/job/conflict flows; regression tests on ORM persistence.
- Dependencies: Желательно до или вместе с `T12`
- Risks: Исправления schema drift могут затронуть существующие данные, поэтому нужен аккуратный migration path и проверка обратной совместимости.

## T29. Разобрать цикл `document-repair` связей

- Summary: Нормализовать relation model между `document`, `repair` и `source/primary` связями
- Issue Type: Technical Debt
- Priority: P1
- Problem: Связи между документом, ремонтом и понятиями `source document` / `primary document` устроены неоднозначно и допускают циклы, дубли логики и слабые инварианты. Из-за этого поведение системы трудно предсказать и поддерживать.
- Goal: Сформировать однозначную relation model без циклических и противоречивых состояний.
- Scope: Описать целевую модель связей; определить ownership и cardinality; убрать циклические или двусмысленные relation paths; выровнять ORM, schemas, API и сервисную логику; при необходимости подготовить migration существующих данных; пересмотреть naming и доменные инварианты.
- Out of Scope: Полный redesign repair/document UI; OCR workflow changes beyond relation consistency; историческая очистка всех спорных данных вручную.
- Files/Modules: document model/schema/API; repair model/schema/API; import/document-processing services; alembic migrations; frontend types if contract changes.
- Acceptance Criteria: Модель связи `document-repair-source-primary` явно описана и реализована; нельзя создать недопустимый цикл или противоречивую комбинацию связей; API и ORM трактуют связи одинаково; существующие рабочие сценарии продолжают работать после миграции.
- Tests: Model tests on relation invariants; API tests on create/update/link/unlink/set-primary flows; migration tests for legacy data; regression tests on repair/document screens.
- Dependencies: `T08`, частично `T28`
- Risks: Ошибки в нормализации relation model могут затронуть исторические данные и существующие UI-сценарии, поэтому потребуется аккуратная миграция и регрессионное покрытие.

## T30. Добавить недостающие индексы под реальные query-patterns

- Summary: Добавить недостающие индексы БД под реальные query-patterns критичных экранов и backend-операций
- Issue Type: Technical Debt
- Priority: P2
- Problem: Часть часто используемых выборок по review queue, audit, search, imports и dashboards работает без оптимальных индексов, что создает лишнюю нагрузку и деградацию времени ответа.
- Goal: Снизить стоимость частых запросов и убрать очевидные DB bottlenecks без изменения бизнес-логики.
- Scope: Собрать фактические query patterns; определить недостающие индексы; добавить миграции; проверить влияние на insert/update cost; синхронизировать ORM expectations с новой схемой.
- Out of Scope: Полный performance tuning всего приложения; переписывание запросов на другой storage engine; кэширование поверх плохих запросов без анализа.
- Files/Modules: alembic migrations; imports/jobs/audit/review related models; search/list query code in backend services and API.
- Acceptance Criteria: Для подтвержденных тяжёлых query paths добавлены осмысленные индексы; планы запросов улучшаются; ключевые операции чтения работают быстрее без регрессий по записи; индексы задокументированы в миграциях.
- Tests: Migration tests; explain/analyze verification on critical queries; regression tests on affected list/search endpoints.
- Dependencies: Желательно после `T28`, аналитически можно готовить заранее
- Risks: Лишние или неверно выбранные индексы могут ухудшить write performance и усложнить поддержку схемы.

## T31. Свести frontend API types в единый слой

- Summary: Вынести frontend API types и DTO mappings в единый shared contract layer
- Issue Type: Technical Debt
- Priority: P2
- Problem: Типы API и DTO размазаны по разным frontend-модулям, частично дублируются и могут расходиться между экранами.
- Goal: Получить единый источник истины для frontend API contracts и снизить риск несовместимых локальных типов.
- Scope: Выделить shared DTO/API layer; свести дублирующиеся типы; централизовать mapping server payload -> UI model там, где это оправдано; убрать локальные расхождения в repair/document/import/labor norm flows.
- Out of Scope: Полный rewrite frontend data layer; автоматическая генерация типов из OpenAPI; массовый UI-рефакторинг.
- Files/Modules: `frontend/src/shared`; frontend API client modules; repair/document/import/labor norm related types and helpers.
- Acceptance Criteria: Ключевые API types определены централизованно; локальные дубли сведены или удалены; изменение contract не требует правок в нескольких несвязанных местах; типы на критичных экранах согласованы.
- Tests: Typecheck; frontend unit/integration tests on typed data mappers; regression checks on affected screens.
- Dependencies: Логично после стабилизации frontend API из `T09` и `T18`
- Risks: Слишком агрессивная унификация может смешать transport DTO и UI view-model, ухудшив читаемость кода.

## T32. Разгрузить `App.tsx` и orchestration hooks

- Summary: Декомпозировать `App.tsx` и перегруженные orchestration hooks
- Issue Type: Technical Debt
- Priority: P2
- Problem: `App.tsx` и связанные orchestration hooks перегружены сквозной логикой и имеют слишком много обязанностей, что затрудняет изменение загрузки данных, инициализации и глобального состояния.
- Goal: Упростить точку входа приложения и разделить orchestration по понятным зонам ответственности.
- Scope: Выделить крупные блоки orchestration в отдельные hooks/modules; сократить ответственность `App.tsx`; разграничить bootstrap, routing, auth/session, feature toggles и глобальные side effects.
- Out of Scope: Полный rewrite app shell; смена state management approach; redesign routing architecture без необходимости.
- Files/Modules: `frontend/src/App.tsx`; `frontend/src/hooks`; global app bootstrap/orchestration modules.
- Acceptance Criteria: `App.tsx` заметно упрощен; orchestration hooks имеют более узкую ответственность; новые разработчики могут локализовать bootstrap logic без чтения всего приложения; поведение приложения не меняется функционально.
- Tests: Frontend integration smoke; typecheck/build; targeted tests on extracted hooks.
- Dependencies: Желательно после `T31`
- Risks: При декомпозиции легко сломать порядок инициализации и скрытые зависимости между эффектами.

## T33. Погасить `tsc --noUnusedLocals --noUnusedParameters`

- Summary: Устранить неиспользуемые локальные переменные и параметры до чистого `tsc --noUnusedLocals --noUnusedParameters`
- Issue Type: Technical Debt
- Priority: P2
- Problem: Во frontend-коде накопились неиспользуемые переменные, параметры и локальные конструкции, которые засоряют код и затрудняют поиск реально важной логики.
- Goal: Привести TypeScript-код к чистому состоянию без `unused` warnings/errors.
- Scope: Удалить или переименовать неиспользуемые locals/params; очистить stale helpers и сигнатуры; не менять бизнес-логику; при необходимости минимально переписать код ради читаемости и типовой чистоты.
- Out of Scope: Большой рефакторинг структуры приложения; удаление спорного legacy-кода без подтверждения; функциональные изменения.
- Files/Modules: frontend TypeScript modules; shared helpers; hooks; components affected by `tsc` diagnostics.
- Acceptance Criteria: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` проходит без ошибок; cleanup не меняет пользовательское поведение; код становится проще для дальнейшего сопровождения.
- Tests: `tsc --noEmit --noUnusedLocals --noUnusedParameters`; frontend build; targeted smoke tests on touched screens.
- Dependencies: Нет жестких, но удобно после `T31-T32`
- Risks: Непродуманный cleanup может удалить seemingly unused код, который на деле нужен для side effects или интерфейсных контрактов.

## T34. Оптимизировать `review queue`

- Summary: Оптимизировать `review queue` на backend и frontend для уменьшения задержек и лишней нагрузки
- Issue Type: Technical Debt
- Priority: P2
- Problem: Экран и API `review queue` тяжёлые: есть лишние запросы, неэффективные выборки и дорогие вычисления, что ухудшает отзывчивость рабочего сценария review.
- Goal: Снизить latency и стоимость загрузки review queue без изменения ее бизнес-семантики.
- Scope: Найти узкие места в query patterns, serialization и frontend data fetching; сократить избыточные join/select/prefetch; оптимизировать пагинацию, фильтры и обновление списка; проверить related indexes.
- Out of Scope: Изменение review policy; redesign review UX; перенос queue на отдельный сервис.
- Files/Modules: review API/services; queue-related queries/models; frontend review queue screen and data loaders.
- Acceptance Criteria: Review queue открывается и обновляется быстрее на типовых выборках; нет лишних повторных запросов; бизнес-правила review не меняются; улучшения подтверждены замерами до/после.
- Tests: Performance smoke on review queue; API regression tests; frontend integration tests on queue loading/filtering.
- Dependencies: `T02`, частично `T30`
- Risks: Оптимизация без достаточных замеров может перенести нагрузку в другое место и не дать реального выигрыша.

## T35. Оптимизировать `audit/search/dashboard/services`

- Summary: Оптимизировать тяжелые экраны и API `audit`, `search`, `dashboard` и часть `services`
- Issue Type: Technical Debt
- Priority: P2
- Problem: Несколько ключевых экранов и backend-выборок работают заметно тяжелее нужного из-за дорогих запросов, избыточного объема данных и неудачной стратегии загрузки.
- Goal: Снизить нагрузку на тяжёлые экраны и улучшить отзывчивость типовых рабочих сценариев.
- Scope: Проанализировать фактические bottlenecks в `audit`, `search`, `dashboard`, `services`; уменьшить объем response payload; улучшить pagination/filtering; проверить индексы и serialization hotspots; сократить ненужные повторные вычисления на frontend.
- Out of Scope: Полный redesign аналитических экранов; смена BI/reporting подхода; инфраструктурный кэш вне границ приложения.
- Files/Modules: audit/search/dashboard/services APIs and queries; corresponding frontend screens and loaders.
- Acceptance Criteria: На подтвержденных тяжелых экранах сокращается время загрузки и/или число запросов; payload становится легче; пользовательский сценарий не теряет нужных данных; улучшение подтверждено замерами.
- Tests: Performance smoke on target screens; regression tests on search/filter behavior; frontend integration tests for loading states and data rendering.
- Dependencies: Частично `T20-T22`, `T30`
- Risks: Слишком агрессивное урезание payload может скрыть данные, на которые уже опирается UI.

## T36. Сократить frontend full bootstrap reloads

- Summary: Снизить число полных frontend bootstrap reloads после мутаций и служебных операций
- Issue Type: Technical Debt
- Priority: P2
- Problem: Приложение слишком часто делает полный bootstrap reload после мутаций, из-за чего растет задержка, теряется локальный UI state и увеличивается нагрузка на API.
- Goal: Перейти к более адресному обновлению клиентского состояния там, где полный reload не нужен.
- Scope: Найти сценарии с избыточным full bootstrap reload; заменить их на targeted refetch/invalidation; сохранить корректность глобального состояния; проверить auth/restore/archive/import sensitive paths отдельно.
- Out of Scope: Полная замена state management solution; rewrite bootstrap architecture с нуля; оптимизация, требующая изменения бизнес-логики.
- Files/Modules: global app bootstrap/state modules; mutation handlers across critical frontend features; query cache/invalidation logic.
- Acceptance Criteria: После типовых мутаций приложение чаще использует локальное обновление или targeted refetch вместо полного bootstrap; UX становится быстрее; согласованность данных сохраняется.
- Tests: Frontend integration tests on mutation flows; smoke tests on archive/review/import actions; manual verification of stale-state edge cases.
- Dependencies: `T31`, `T32`
- Risks: Недостаточный refetch/invalidation может оставить UI в stale state, который раньше случайно лечился полным reload.

## T37. Закрыть gap по финальному employee workflow

- Summary: Довести финальный employee workflow до целевого сквозного сценария по ТЗ и логике проекта
- Issue Type: Bug
- Priority: P1
- Problem: Технический каркас employee workflow уже собран, но финальный пользовательский сценарий всё ещё требует полного UAT и формального подтверждения, что warning/review/history/report/export этапы складываются в единый предсказуемый поток на целевых кейсах заказчика.
- Goal: Получить целостный end-to-end employee workflow без логических разрывов и ручных обходов.
- Scope: Подтвердить полный employee use case на целевых сценариях; заполнить `BUSINESS_SIGNOFF_REPORT_EXPORT.md` по обязательным кейсам report/export; добрать оставшиеся расхождения в warning/review/status/history/report/export; убрать тупиковые и противоречивые переходы, если они найдутся по итогам UAT; синхронизировать backend rules, frontend UX и финальную приемочную логику.
- Out of Scope: Полный redesign employee UI; новая функциональность вне текущего ТЗ; расширение ролевой модели beyond current scope.
- Files/Modules: employee-facing frontend flows; review/history/report/export related backend/frontend modules; permissions and audit visibility where relevant.
- Acceptance Criteria: Сквозной employee workflow выполняется от начала до финального результата без ручных обходов; пользователь видит корректные статусы и доступные действия на каждом шаге; финальный report/export соответствует ожидаемому сценарию; UAT по employee use case проходит; `BUSINESS_SIGNOFF_REPORT_EXPORT.md` заполнен по обязательным кейсам; остаточные риски по целевым кейсам явно зафиксированы.
- Tests: Targeted integration/regression tests for employee flow; role-based access tests; manual UAT on end-to-end employee scenario.
- Dependencies: `T22`, ключевые доменные фиксы `T01-T29`
- Risks: Без четкого описания целевого сценария можно локально улучшить отдельные шаги, но не собрать целостный use case.

## T38. Обновить README, UAT checklist и техдокументацию

- Summary: Синхронизировать README, UAT checklist, roadmap и техническую документацию с фактическим состоянием проекта после исправлений
- Issue Type: Task
- Priority: P2
- Problem: Основные документы уже частично обновлены, но без постоянной синхронизации backlog, README, UAT, release-checklist и sign-off templates снова расходятся с реальным поведением системы и усложняют приемку.
- Goal: Сделать документацию актуальной и пригодной как для разработки, так и для финальной приемки.
- Scope: Обновить README; синхронизировать UAT checklist; поправить roadmap/master documentation references; поддерживать актуальными `RELEASE_CHECKLIST.md` и `BUSINESS_SIGNOFF_REPORT_EXPORT.md`; зафиксировать актуальные доменные инварианты, ограничения и критические сценарии; убрать устаревшие описания.
- Out of Scope: Полный пользовательский help center; маркетинговая документация; подробная инфраструктурная документация вне рамок проекта.
- Files/Modules: `README`; `UAT_CHECKLIST_ЗАКАЗЧИК.md`; `RELEASE_CHECKLIST.md`; `BUSINESS_SIGNOFF_REPORT_EXPORT.md`; `МАСТЕР ПЛАН ПО ИСПРАВЛЕНИЮ ПРОЕКТА.md`; related project docs/checklists.
- Acceptance Criteria: README, UAT checklist, release-checklist и sign-off template отражают фактическое поведение системы; ключевые инварианты и ограничения описаны без противоречий; backlog и документация не расходятся между собой; документы пригодны для разработки, релизного gate и приемки.
- Tests: Документация напрямую не тестируется; верификация через review against implemented behavior and UAT scenarios.
- Dependencies: `T37`, финализация основного backlog
- Risks: Если обновить документы до завершения ключевых фиксов, они быстро устареют и снова разойдутся с кодом.
