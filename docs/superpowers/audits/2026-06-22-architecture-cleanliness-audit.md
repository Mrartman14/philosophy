<!-- Сгенерировано многоагентным аудитом (Workflow arch-cleanliness-audit, 2026-06-22). -->
<!-- Метод: 22 слайс-финдера + 9 сквозных линз → дедуп → adversarial-верификация по коду → синтез. -->
<!-- Прогон: 94 агента, ~4M токенов. Находки: 75 сырых → 41 канон. → 20 подтв./спорн. (3 major, 18 minor, 6 спорн.), 21 отвергнуто верификацией. -->

# Аудит чистоты архитектуры

Срез frontend-слоя `philosophy` (слайс-архитектура `src/features/*`, инфраструктура `src/utils|api|services`, документация `docs/frontend-conventions.md`). Фокус — консистентность, DRY, распределение ответственностей, conformance к канону, дрейф документации. Корректностные баги вне зоны (их не найдено).

## Резюме

Состояние архитектуры — хорошее. Подтверждена 21 находка: **0 critical, 3 major, 18 minor**. 25 более громких «находок» отвергнуты верификацией — они описывают намеренные, задокументированные паттерны канона (client.ts vs index.ts, опциональная ERRORS-карта, opt-in idempotency, variance-cast в offline-registry и т.п.), а не дефекты.

Главный вывод: **код чище, чем документация**. Самый плотный кластер проблем — дрейф `docs/frontend-conventions.md` (устаревший тип в примерах, неверное описание BANNED, скрытая система Guardrails), который провоцирует нового агента копировать легаси-канал. Второй системный дефект — мёртвый ESLint-паттерн `!(index)`, из-за которого Guardrail 1 (deep-imports) реально не ловит нарушения. Дыр авторизации нет: единый источник истины RBAC — бэк, FE-owner-load повсюду помечен как опциональный defense-in-depth.

## Главные системные проблемы

1. **Мёртвый ESLint-паттерн `!(index)` — Guardrail 1 не ловит deep-imports (major, conformance).** Glob-негация `!(index)` в `DEEP_IMPORT_PATTERN` (`eslint.config.mjs:360-371`) не срабатывает во flat-config import-плагина. В результате реальные нарушения проходят молча: `src/proxy.ts:9` (`@/features/auth/cookie-config`), `src/proxy.test.ts:4`, `src/app/lectures/[id]/page.tsx:15` (`@/features/lectures/cover-url`). Болит потому, что гард создаёт ложное чувство защиты — будущие deep-imports не будут пойманы в CI. Корень — переписать паттерн без extglob-негации (`@/features/*/*` + существующий `@/features/*/*/**`) и добавить CI-фикстуру, доказывающую отлов.

2. **Дрейф `docs/frontend-conventions.md` — документация отстала от кода (системно, minor-кластер).** Эталонный референс, по которому копируют слайсы, содержит несколько устаревших мест: устаревший тип `ApiErrorMessages` вместо целевого `ApiErrorMessageKeys` (строки 123, 133-136, 163), неверное описание `BANNED → ForbiddenError("status")` (строка 166, в коде — `BannedError`), упоминание только Guardrail 4 при существующих 1-8. Болит потому, что новый агент копирует легаси-канал → нелокализуемый off-canon результат (компилируется, но неверен по i18n). Корень — синхронизировать примеры с `src/features/comments/actions.ts:37-54` и `src/utils/api-error.ts`.

3. **Асимметрия owner-aware defense-in-depth между слайсами (minor, не дыра авторизации).** Только `media` и `annotations` грузят сущность и делают owner-RBAC-гейт перед API-вызовом (`loadMediaForGate`/`getAnnotationById` + `requireCapability(me, m => canX(m, entity))`). `canvas`, `documents`, `comments`-actions делают только `requireActive`/общий `canCreateComment`. **Это НЕ дыра**: источник истины RBAC — бэк, FE-owner-load сам помечен «Defense-in-depth» (опционален), а специализированные `canEditComment`/`canDeleteComment` используются в UI (`comment-node.tsx:68,76`). Болит лишь консистентность. Корень — единое явное решение в конвенциях: где defense-in-depth обязателен, где делегируем беку.

4. **Дубли schema-фабрик между слайсами (minor, реально узкий).** Заявленный кластер из 5 пунктов при верификации схлопнулся: реален только сырой UUID v4 regex, продублированный в `src/features/banners/schemas.ts:12-13` и `src/features/trails/schemas.ts:58` — оба легко заменимы на уже используемый ими `z.uuid()`. Остальное (makeBlocksJsonSchema, makeTitleSchema с разными max, UUID-фабрики) — намеренное параметрическое расхождение или уже централизованный helper. Болит минимально; actionable — только дедуп UUID-regex.

## Находки по категориям

### Консистентность

**major — Media upload не использует канонический error-handling и useActionState (расходится с documents).**
`src/features/media/upload-media.ts:37-121`, `src/features/media/actions.ts:20-25`, `src/features/media/ui/media-upload-form.tsx:23-98`, `src/features/documents/ui/document-upload-form.tsx:1-60`.
Проблема: `upload-media.ts:95-116` вручную проверяет HTTP-статусы (401/403/413/400/422) и возвращает кастомный result-тип с хардкод-кодами (`"forbidden"`/`"file_too_large"`/`"invalid_file"`), хотя `actions.ts:20-25` того же слайса использует `ERRORS` + `rethrowApiError`. На UI `media-upload-form.tsx:45` делает прямой `await` и вручную разбирает `result.code`, тогда как канон `documents-upload-form.tsx:17` использует `useActionState` + `<Form action>` + `FormFeedback`. Внутри одного слайса два паттерна; `documents/uploadDocument` доказывает, что raw multipart-fetch совместим с `createFormAction` + `rethrowApiError`. Зона `src/features/media` не заморожена.
Рекомендация: обернуть `uploadMedia` в `createFormAction`, перевести форму на `useActionState` + `<Form action>` по образцу `documents`. Хардкод-413 заменить на централизованный `REQUEST_BODY_TOO_LARGE`/`PAYLOAD_TOO_LARGE` из `DEFAULT_MESSAGES`, а не на entity-override.

**minor — createForm использует inline ForbiddenError вместо requireCapability.**
`src/features/forms/actions.ts:78`.
Проблема: `throw new ForbiddenError(me ? (me.status !== 'active' ? 'status' : 'role') : 'guest')` вместо канонического `requireCapability(me, canCreateForm)` (ср. `comments/actions.ts:59`). Помимо стиля: inline-throw обходит `metrics.increment(M.rbacDenied)` из `requireCapability` — отказ в форме не попадёт в RBAC-denied метрику. Остальные forms-actions используют `requireActive` (канон-одобрено, `permissions.ts:133`), проблемен именно `createForm`.
Рекомендация: заменить на `requireCapability(me, canCreateForm)` — утилита сама выводит status/role/guest-причину и восстанавливает метрику.

**minor — Реестр Tags.ts не защищён от незарегистрированных литералов в unstable_cache.** ⚠️ (предложение по hardening, не нарушение)
`src/api/tags.ts:1-13`, `src/features/comments/api.ts`, `src/features/events/api.ts`.
Проблема: весь наблюдаемый код корректен (`Tags.COMMENT_SCHEMA`, `Tags.EVENTS`), но нет линт-проверки, что каждый `unstable_cache` использует символ из `Tags.ts`. Будущий слайс с литерал-строкой создаст уникальный тег, тихо ломая revalidation.
Рекомендация: добавить `no-restricted-syntax` на строковые литералы в `{ tags: [...] }` (консистентно с G6/G7/G8). Нарушений сейчас нет.

### DRY

**minor — CopyButton дублирован в share-links и tokens.** ⚠️ (порог выноса не достигнут)
`src/features/share-links/ui/copy-button.tsx:18`, `src/features/tokens/ui/copy-button.tsx:17`.
Проблема: идентичный компонент (clipboard+fallback, toast, 2-сек copied-state, prop `{value,label}`), отличие только в i18n-namespace и label-ключе.
Рекомендация: при появлении 3-го потребителя вынести в `@/components/ui/copy-button.tsx` или `@/hooks/use-copy-to-clipboard.ts` с параметризацией i18n. Сейчас — допустимый minor-долг (канон: порог 3+, анти-паттерн «компонент на 2 совпадения»).

**minor — entityLabels-маппинг дублируется в двух UI-компонентах statistics.**
`src/features/statistics/ui/view-stats.tsx:31-40`, `src/features/statistics/ui/production-stats-table.tsx:18-27`.
Проблема: идентичный маппинг entity→label в обоих файлах.
Рекомендация: вынести в общее место внутри слайса. Нюанс: маппинг строится из `t(...)`, поэтому выносить надо фабрику `entityLabels(t)`, а не статическую константу.

**minor — Дублирование UUID-regex между слайсами.** (см. системную проблему #4)
`src/features/banners/schemas.ts:12-13`, `src/features/trails/schemas.ts:58`.
Рекомендация: заменить оба на `z.uuid()` (уже используется в обоих слайсах). Прочие пункты исходного кластера schema-фабрик — намеренное расхождение, не actionable.

### Симметрия

**minor — Owner-aware мутации не делают owner-RBAC-гейт (асимметрия с media/annotations).** (см. системную проблему #3)
`src/features/canvas/actions.ts:68-89,92-106`, `src/features/documents/actions.ts:154-159`, `src/features/comments/actions.ts:90,111` vs `src/features/media/actions.ts:46-50`, `src/features/annotations/actions.ts:104-113`.
Не образует дыры авторизации (RBAC у бэка, FE-owner-load опционален). Для `comments` owner-load в action недоступен (нет single-GET). Рекомендация — единое решение в конвенциях.

### Распределение ответственностей

**minor — Auth обходит канонический rethrowApiError через кастомный AuthError + локальные ERROR_TEXT в UI.**
`src/features/auth/actions.ts:16-30,45-70,91-100`, `src/features/auth/ui/login-form.tsx:31-40`, `src/features/auth/ui/register-form.tsx:15`.
Проблема: кастомный класс `AuthError` с захардкоженными code-строками (`invalid_credentials`, `account_blocked` и т.д.) вместо `rethrowApiError(error, ERRORS)`. Маппинг разбросан: часть в actions (throw AuthError), часть в каждом UI-компоненте (локальные `ERROR_TEXT`). Комментарий `actions.ts:16-18` неверно называет message «enum-ключом» (это code-строка). Не покрыто документированным исключением.
Рекомендация: ⚠️ нетривиально — auth мапит по HTTP-статусу, а не по backend code, поэтому буквальный `rethrowApiError(error, AUTH_ERRORS)` не сработает без коведённых тел ошибок. Минимум: объявить `AUTH_ERRORS: ApiErrorMessageKeys` с ключами каталога, резолвить текст server-side, обновить устаревший комментарий. Если ручной fetch обоснован — задокументировать исключение в конвенциях.

**minor — users/errors.ts выносит rethrowUserApiError и ERRORS в отдельный файл вопреки локальному канону.**
`src/features/users/errors.ts`, `src/features/users/actions.ts:12,32`.
Проблема: `users` объявляет `ERRORS` и обёртку `rethrowUserApiError` (export, `errors.ts:49`) в отдельном файле, тогда как канон (`trails/actions.ts`: приватная local-функция `rethrowTrailApiError`) держит их в `actions.ts`. Лишняя граница ответственности.
Рекомендация: перенести `ERRORS` + обёртку в `actions.ts` приватной local-функцией по образцу trails, убрать export. Нюанс: `errors.ts` несёт документированную `CONFLICT_MESSAGES`-логику — это не пустая обёртка, перенос увеличит actions.ts (как и в trails).

**minor — createLecture/deleteLecture парсят FormData до requireCapability-гейта.**
`src/features/lectures/actions.ts:69-73,128-132`.
Проблема: `parseFormData` вызывается ДО `requireCapability` для capability-only мутаций (без owner-проверки), хотя канон §3.3 — отказ дешевле без парсинга (ср. `comments/actions.ts` createComment: `requireCapability@59`, `parseFormData@64`).
Рекомендация: поменять порядок (me→gate→parse) в обоих действиях. `getMe()@70/@129` уже выше — корректно. Owner-aware действия (`updateLecture`, `setLectureVisibility`) трогать не нужно — они парсят первыми ради id.

**minor — FieldType дублирован в actions.ts вместо централизации в types.ts.**
`src/features/forms/actions.ts:51-52`, `src/features/forms/types.ts:14`.
Проблема: `actions.ts:51` (`type FieldType = components['schemas']['form.FieldType']`) — точный дубль `types.ts:14`. `forms` — единственный слайс с инлайн-сужениями схемы в actions.ts (9 других импортируют из `./types`).
Рекомендация: заменить `FieldType` на импорт из `./types`. ⚠️ `CreateFieldRequest` (`actions.ts:52`) — одноразовый request-body, канон не обязывает выносить; дрейфа нет (тот же ключ схемы).

**minor — Нет гарда против передачи полного me-объекта в client-компоненты.** ⚠️ (предложение по hardening, нарушений нет)
`src/app/lectures/[id]/page.tsx:1-30`, `src/app/admin/comments/page.tsx:1-30`.
Проблема: канон (строка 52) предписывает инжектить server-данные пропами, но нет enforcement против `<ClientComponent me={me} />`. Барьер `import "server-only"` в `me.ts` НЕ закрывает кейс: `Me`/`MaybeMe` — типы (`import type` стирается). Спот-чеки показывают корректное использование, но автоматического гейта нет.
Рекомендация: `no-restricted-syntax` селектор на `JSXAttribute name=me` в `"use client"`-файлах, либо nominal brand на `Me`, ломающий сериализацию пропа.

### Абстракции

В этой категории подтверждённых дефектов нет. Все кандидаты (SemanticMap-прокси, buildFieldsBody, export-urls-обёртки, OfflineDescriptor variance-cast) отвергнуты верификацией как намеренные корректные границы (см. «Снято верификацией»).

### Conformance

**major — Deep-import @/features/auth/cookie-config в proxy.ts не ловится ESLint Guardrail 1.** (корень — в системной проблеме #1)
`src/proxy.ts:9`, `src/features/auth/index.ts:1-8`, `eslint.config.mjs:360-371`.
Проблема: `proxy.ts:9` импортирует `@/features/auth/cookie-config` напрямую, минуя `index.ts`; `cookie-config` не реэкспортится. `pnpm lint` не выдаёт error — мёртвый паттерн `!(index)`.
Рекомендация: 1) реэкспортить cookie-config через **client-safe** вход (`auth/client.ts`), а не bare `index.ts` — `index.ts` реэкспортит server-only actions, импорт через него в middleware затянул бы server-only в бандл; 2) изменить импорт в `proxy.ts`; 3) починить `DEEP_IMPORT_PATTERN` (см. #1) и добавить CI-фикстуру.

**minor — Пустой notifications/client.ts следует удалить по чеклисту.**
`src/features/notifications/client.ts`.
Проблема: `client.ts` реэкспортит только типы + `describeNotification` без cross-feature импортов, имеет 0 импортёров (мёртвый barrel). Потребители берут `describeNotification`/типы напрямую из `notification-content.ts`/`types.ts`. Чеклист `_template/README.md:16`: пустой re-export засоряет дерево.
Рекомендация: удалить. Нюанс: буквальное условие чеклиста («нет "use client"-кода») формально не выполнено (`"use client"` есть в `ui/notification-item.tsx`), но компонент импортит интра-слайсово мимо barrel — удаление безопасно.

**minor — UsageTrackingSchema не покрыта тестами.** ⚠️ (формальное нарушение, ценность теста околонулевая)
`src/features/tokens/schemas.ts:52`, `src/features/tokens/schemas.test.ts`.
Проблема: `UsageTrackingSchema = z.boolean()` экспортирована и используется (`actions.ts:86`), но не имеет теста (чеклист _template: каждая Zod-схема — min 1 success + 1 failure).
Рекомендация: добавить тесты parse(true)/parse('invalid'). Альтернатива в духе канона: inline-инлайнить парс в actions.ts (это встроенный примитив без своей логики — тест проверял бы Zod, не слайс).

### Конвенции против кода (дрейф документации)

**Доки отстали от кода:**

**minor — Документация показывает устаревший тип ApiErrorMessages вместо ApiErrorMessageKeys.** (см. системную проблему #2)
`docs/frontend-conventions.md:123,133-136,163`, `src/utils/api-error.ts:31-46`.
Пример в доках использует `ApiErrorMessages` со значениями-текстами (`{ COMMENT_DELETED: "Комментарий удалён." }`), но все слайсы используют `ApiErrorMessageKeys` со значениями-ключами каталога. Легаси-тип компилируется (не compile-error), поэтому вред — консистентность/i18n, не tsc-блокер. Рекомендация: синхронизировать строки 123/133/163 с `comments/actions.ts:37-54`, сослаться на `frontend-i18n.md`.

**minor — Документация упоминает только Guardrail 4, скрывая остальные 1-8.**
`docs/frontend-conventions.md:28,50,410`, `eslint.config.mjs:360-451`.
`frontend-conventions.md` упоминает гарды без объяснения системы; `eslint.config.mjs` описывает G1-G8. G1-G3 по сути изложены в `docs:28/410` без номеров; G5-G8 живут в фич-канонах. Рекомендация: добавить раздел со списком Guardrails 1-8 + ссылку на `eslint.config.mjs`.

**Фактически неверно в доках:**

**minor — Документация неверно описывает BANNED как ForbiddenError(status).** ⚠️ (severity спорна: автор заявлял major, верификация — minor)
`docs/frontend-conventions.md:165-166`, `src/utils/api-error.ts:131-133`.
Доки утверждают «SUSPENDED/BANNED → ForbiddenError("status")», но в коде `BANNED` бросает `BannedError` (code="banned", форс-логаут), а `ForbiddenError("status")` — только SUSPENDED. Рантайм-бага нет (только текст в скобках на строке 166), но это эталонный источник, по которому копируют слайсы — искажение auth/account-семантики может ввести реализатора в заблуждение. Рекомендация: SUSPENDED → `ForbiddenError("status")`; BANNED → `BannedError` (форс-логаут).

**minor — Комментарий в _template/schemas.ts вводит в заблуждение про client-импорт схем.**
`src/features/_template/schemas.ts:10`.
Комментарий говорит, что схемы можно импортировать в client-форму для preview-валидации, но сам файл имеет `import "server-only"` (строка 2). Это эталон для копирования. Рекомендация: убрать комментарий либо переписать, что preview-валидация требует отдельного client-safe экспорта (паттерн client.ts), не прямого импорта из server-only schemas.ts.

**Остаточный санкционированный долг (не дефект, отмечено для полноты):**

**minor — CONFLICT_MESSAGES использует текст-строки вместо i18n-ключей.**
`src/features/users/errors.ts:25-32`.
`CONFLICT_MESSAGES` на легаси текст-канале, соседний `ERRORS` — на i18n-ключах. Дивергенция структурно вынуждена (под-маппинг по message, который центральный `rethrowApiError` не поддерживает) и задокументирована как отложенный долг (NOTE 19-23). Легаси-канал санкционирован каноном на время миграции. Долгосрочный фикс: async `rethrowUserApiError` + ключи. Не срочно.

## Пробелы покрытия

Зоны, не получившие индивидуального разбора — перепроверить вручную:

1. **`src/proxy.ts` (189 строк, BFF/CSP-nonce/cookie-проксирование)** — упомянут лишь как жертва deep-import. Сама ответственность (проксирование `/api/*`, проброс cookies/headers, nonce-инъекция, обработка ошибок апстрима) не аудирована. Центральный узел BFF-чистоты — перепроверить на утечки заголовков и разделение server-side вызовов.
2. **`src/security/` (csp.ts 107 строк, security-headers.ts) и `src/seo/`** — целые модули без находок при заявленных сквозных инициативах CSP/SEO. Перепроверить на дубли построения заголовков, согласованность origin между `csp`/`site-url`/`seo`, hardcode.
3. **`src/api/client.ts` + `enums.ts` + `types.ts`** — единая точка всех сетевых вызовов без находок по самому клиенту. Не рассмотрены: единообразие инжекта заголовков (auth/idempotency/locale/appearance/tz), обработка не-2xx, дрейф `enums.ts`/`types.ts` vs `schema.ts`.
4. **`src/i18n/`** — модуль с собственными гардами, ноль находок. Перепроверить дубль `persist-locale` vs `persist-timezone` (одинаковый cookie-паттерн — кандидат в DRY), согласованность фасада `@/i18n`, дрейф `format.ts` vs `getFmt` в `utils/timezone`.
5. **`src/utils/*` помимо api-error/permissions** — `create-action.ts` (204 строки, ловит ForbiddenError/ApiError), `revalidate`, `paging`, `blocks-json`, `optimistic-lock`, `api-unwrap`, `export-proxy`/`storage-url` — перепроверить на дубли со слайсовыми хелперами.
6. **Слайсы preferences, search, events, glossary, trails, banners, annotations, tags, statistics целиком** — фигурируют лишь точечно в сквозных находках. Их actions/api/permissions не получили разбора owner-RBAC/parse-order/error-map, который достался «громким» слайсам. Особенно preferences (vapid web-push), search (semantic POST, hit-href), banners.
7. **`src/hooks/`** — `use-query-form-submit` (общий form-submit, пересекается с useActionState-каноном находки media), `use-install-prompt`, `use-register-sw`, SW/instrumentation — перепроверить на двойную инициализацию.
8. **`src/components/` вне button/icon-button** — ast-editor/ast-merge/ast-render/canvas-render (barrel-чувствительные @tiptap), shared-компоненты — перепроверить на дубли рендереров и client/server-границы.

## Снято верификацией

Проверены и отвергнуты 25 находок как ложные/намеренные паттерны канона: client.ts vs index.ts «дрейф 20/22» (index.ts заведомо server-only вход, client.ts нужен лишь внешним "use client"-потребителям); `rethrowApiError` без ERRORS-карты (2-й аргумент опционален по дизайну, шаблон `_template/actions.ts:33`); асимметрия idempotencyHeaders (opt-in per-form, DELETE-by-id не нужен — `docs:275-276`); deep-import loginAction/registerAction (это интра-слайсовый `../actions`, не cross-feature); offline drain межвкладочная гонка (atomic `claimPending` в IndexedDB-транзакции); OfflineIdentityGuard race (gate закрыт в рендере до эффектов); тройная очистка офлайна (одна примитива `wipeOfflineData`, разные политики триггера); реэкспорт permissions из index.ts (задокументировано `docs:48,50,310`); DenyReason owner/guest (задокументирован на определении `permissions.ts:62-71`); auth без permissions/types/api.ts (файлы по потребности, pre-auth поток); export-urls дубли (тонкие type-safe обёртки над централизованным `proxyExportUrls`); buildFieldsBody (single-use local-хелпер, канон разрешает); Button vs IconButton тоны (расхождение задокументировано в JSDoc IconButton); loadLectureForGate 404→Forbidden (намеренная security-маскировка, консистентна с media); SemanticMap-прокси (необходимый server→client мост для `ssr:false`); beacon-адаптер двойная проверка (feature-detect vs env-check, покрыто тестом); hashActor версионирование (соль — deploy-тайм, пересчёт per-request); sampleRate ленивое чтение (задокументировано, конфиг из env); observability TODO Phase 4 (канон не требует ссылок на план); OfflineDescriptor variance-cast (вынужден контравариантностью при strict, тип проверен в месте определения); документация про server-only механизм (корректна — `import "server-only"` транзитивно через api/actions).
