<!-- Добор-аудит (Workflow arch-audit-coverage-gaps, 2026-06-22). Read-only, по непокрытым зонам. -->
<!-- Прогон: 55 агентов, ~1.7M токенов. Находки: 33 сырых → 30 канон. → 10+ подтв., 20 снято верификацией. -->
<!-- Дополняет: 2026-06-22-architecture-cleanliness-audit.md -->

# Добор-аудит: пробелы покрытия

## Резюме

Добор закрывает зоны, не охваченные предыдущими волнами ревью: middleware/BFF (`proxy.ts`), security/SEO (`csp`, `seo`, `cookie-config`), api-client (`@/api/client`), i18n-фасад, общая инфраструктура `utils`/`hooks` и shared-`components`, а также «тихие» слайсы (annotations, share-links). Все 11 находок прочитаны и подтверждены на живом коде (Read + grep), цитаты дословны.

Картина однородная: **корни почти всех находок — фронтовые** (DRY-дубли, дрейф конвенций, косвенность), бэкенд-флаг ни по одной не требуется. Доминирует один системный антипаттерн — **разрозненное копирование констант и политик вместо переиспользования уже существующей единой точки истины**: дефолт `API_URL` (8 копий при наличии `export` в `@/api/client`), cookie-политика (4 копии), имена cookie (литералы в обход `cookie-config`), дефолты dev-хостов (3001 vs 3000).

Приоритет на починку (systemic + major):
1. `api-url-default-duplicated-8-files` — 7 лишних копий дефолта API_URL.
2. `cookie-write-pattern-duplicated` — 4 копии security-релевантной cookie-политики.
3. `hardcoded-tailwind-alert-colors` — ~49 хардкодов amber/red вместо семантических токенов (сквозной sweep).
4. `raw-error-instead-of-rethrow-api-error` — 8 точек сырого `throw` мимо `rethrowApiError`, включая внутрифайловую несогласованность в `lectures/actions.ts`.
5. `forced-logout-hardcoded-cookie-names` — латентный дрейф-риск имён cookie на security-пути.

Вторичный кластер (minor) — мелкие косвенности и несведённые дефолты, чинятся попутно вместе с major-родителями.

## Находки по зонам

### proxy / BFF

**[major] API_URL дефолт продублирован в 8 файлах** — `api-url-default-duplicated-8-files` · *systemic*
Локации: `src/api/client.ts:8` (единственный `export`), `src/proxy.ts:12`, `src/features/auth/actions.ts:14`, `src/features/annotations/api.ts:22`, `src/features/annotations/actions.ts:41`, `src/features/documents/actions.ts:42`, `src/utils/me.ts:32`, `src/components/ast-editor/upload/upload-image.ts:8`.
Проблема: `const API_URL = process.env.API_URL ?? "http://localhost:8080"` независимо определён в 8 файлах. Единая точка истины уже существует и помечена `export` (`api/client.ts:8`), но остальные 7 её игнорируют. Нарушает DRY, усложняет глобальное переконфигурирование дефолта.
Рекомендация: канонический фикс — заменить 7 локальных const на `import { API_URL } from "@/api/client"`. Два слайса (`annotations/api.ts`, `annotations/actions.ts`) уже импортируют из `@/api/client`, для них импорт бесплатен. Для `proxy.ts` (middleware/edge-слой) проверить, что импорт из `client.ts` не тянет `openapi-fetch`/observability в edge-бандл; при риске — вынести голую константу в лёгкий модуль `src/api/base-url.ts` и реэкспортить из `client.ts`, чтобы и middleware, и слайсы тянули один источник без побочной нагрузки. Raw-fetch-сайты импортируют строку; openapi-сайты продолжают использовать `createApiClient`.

### security / SEO

**[major] Хардкод Tailwind alert/warning-цветов вместо семантических токенов** — `hardcoded-tailwind-alert-colors` · *systemic*
Локации (примеры): `src/components/permission/status-banner.tsx:23` (`bg-amber-50 border-b border-amber-300 text-amber-900`), `src/components/attachments/attachments-panel.tsx:148` (`text-red-600`), `src/components/ast-merge/ast-merge-view.tsx:307` (`text-red-600`), `src/components/app/network-indicator.tsx:46` (`text-amber-600`), `src/components/ast-editor/toolbar/buttons/link-popover.tsx:111` (`text-red-500`).
Проблема: компоненты используют захардкоженные Tailwind-классы цвета вместо семантических CSS-токенов. Per `frontend-conventions.md §6` значения цветов должны ссылаться только на семантические переменные; в проекте есть `--color-warning-bg/-fg`, danger-токены и др. Масштаб шире пяти локаций — grep даёт **~49 совпадений** хардкоженных amber/red по `src/`, `text-red-600` повторяется в 20+ слайсовых error-параграфах форм.
Рекомендация: чинить сквозным sweep'ом (`text-red-*` → `text-(--color-danger)`/`text-(--color-error-fg)`, `amber-*` → warning-токены), а не точечно по 5 файлам. Источник токенов — `src/styles/tokens.generated.css`. Если нужного токена нет — это пробел дизайн-фундамента, отдельный foundation-update PR (UI-kit/токены — frozen-зона).

**[major] Имена cookie захардкожены в forced-logout вместо импорта из cookie-config** — `forced-logout-hardcoded-cookie-names`
Локации: `src/app/auth/forced-logout/route.ts:15` (`const TOKEN_COOKIE = "token"`), `:19` (`const REFRESH_COOKIE = "refresh_token"`).
Проблема: имена cookie заданы литералами вместо импорта из `@/features/auth/cookie-config`. Комментарий `route.ts:11-14` обосновывает дубль тем, что «route в `app/` не может deep-import'ить внутренности фичи (ESLint-гард), а barrel `@/features/auth` тянет server-only». Это обоснование **неверно**: `proxy.ts:5` уже импортирует `REFRESH_COOKIE` из client-safe фасада `@/features/auth/client`, и гард это разрешает. Сегодня литералы совпадают с `cookie-config` (`"token"`/`"refresh_token"`), живого бага нет — это латентный дрейф-риск на security-пути (форс-логаут обязан чистить refresh, иначе забаненный клиент переполучит access).
Рекомендация: заменить литералы на `import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/features/auth/client"` (как уже делает `proxy.ts:5`) и убрать устаревший комментарий `route.ts:11-14`.

**⚠ [minor] Рассогласование дефолта `NEXT_PUBLIC_BASE_URL`: 3001 vs 3000** — `base-url-dev-default-mismatch`
Локации: `src/seo/site-url.ts:6` (`DEFAULT_BASE = "http://localhost:3001"`), `src/features/share-links/share-url.ts:30` (`?? "http://localhost:3000"`), `.env.development:1` (`NEXT_PUBLIC_BASE_URL=http://localhost:3000`).
Проблема: одна переменная имеет два разных дефолта. При несконфигурированном окружении canonical/OG-URL (SEO) и share-ссылки одного ресурса окажутся на разных хостах, нарушая инвариант единого base-URL. Сам источник истины dev-порта рассогласован: комментарий `site-url.ts:5` и dev-стек утверждают 3001, `.env.development` фиксирует 3000.
Рекомендация: зафиксировать реальный dev-порт (3001 по dev-стеку), выровнять `share-url.ts` и `.env.development` на него. Заодно почистить мёртвый github.io-комментарий в `share-url.ts`. В проде дефолт замещается реальным origin через `NEXT_PUBLIC_BASE_URL` — критичность чисто dev-консистентности.
*Помечено ⚠: severity на нижней границе minor (dev-only эффект), но порт-рассинхрон реален.*

**⚠ [minor] Нет единого фасада дефолтных хостов/портов для dev** — `no-dev-defaults-config-facade`
Локации: `src/seo/site-url.ts:6` (3001), `src/features/share-links/share-url.ts:30` (3000), `src/proxy.ts:12` (8080).
Проблема: дефолтные хосты/порты разбросаны без единого источника, что затрудняет глобальную смену dev-setup.
Рекомендация: **не** заводить новый `@/config/defaults.ts` — это не-каноничный remedy и дублирует находки выше. Корень адресуется существующими точками: `API_URL` уже экспортируется из `api/client.ts:8` (импортировать оттуда), base-URL свести через находку `base-url-dev-default-mismatch`. Отдельного фасада канон не требует.
*Помечено ⚠: спорная — фактура верна, но рекомендация поглощается двумя соседними находками; ценность как самостоятельной находки низкая.*

### api-client / error-handling

**[major] Сырой `throw new Error` вместо `rethrowApiError` (lectures + ast-editor pickers)** — `raw-error-instead-of-rethrow-api-error` · *systemic*
Локации: `src/features/lectures/actions.ts:295,321`; `src/components/ast-editor/pickers/actions.ts:21,28,35,49,57,71`.
Проблема: в `searchDocumentsForAttach`/`searchMediaForAttach` (lectures) и в шести picker-actions ошибки обрабатываются как `throw new Error((error as ApiError).error ?? t("..."))` вместо канонического `rethrowApiError(error, ERRORS)` (`frontend-conventions.md §3.3`). Это обходит единую систему маппинга кодов ошибок на клиентские ключи; при изменении структуры ошибок бэка точки ломаются молча. Особенно показательна **внутрифайловая несогласованность в `lectures/actions.ts`**: 11 точек используют канон (`:85,105,123,139,164,183,214,249,271,363`), а `:295` и `:321` — сырой throw. Эталонный `rethrowApiError` делает 6 ветвей обработки, которые сырой throw полностью теряет.
Рекомендация:
- `lectures/actions.ts:295,321` — заменить 2 throw на `rethrowApiError(error, ERRORS)` (карта `ERRORS` уже есть в файле, добавить недостающие коды `searchDocumentsFailed`/`searchMediaFailed`).
- `pickers/actions.ts` — импортировать `rethrowApiError`, объявить `ERRORS`-карту, убрать локальный `interface ApiError`. Зона `src/components/ast-editor/` — не слайс, но правило единой точки `rethrowApiError` универсально для всех server actions; либо привести к канону, либо явно задокументировать ослабленную error-policy для компонент-уровневых хелперов.

### i18n

Пробелов не выявлено. По проверенным точкам i18n-фасад (`@/i18n`, `@/i18n/client`, `@/i18n/persist-*`) следует своему контракту: server-only index, отдельные client-safe входы, server-action persist-модули. Несколько кандидатных находок (deep-import `persist-*`, асимметрия locale/timezone-персистентности, двухрежимный `getFmt`) сняты верификацией как намеренный дизайн (см. ниже).

### utils

**⚠ [minor] Запись timezone-cookie раздроблена между TimezoneProvider и TimezoneSettings** — `cookie-write-fragmented-provider-vs-settings`
Локации: `src/components/timezone/timezone-provider.tsx:14-37` (writeCookie при гидрации, `system`→resolved), `src/app/me/settings/timezone-settings.tsx:39-54` (inline `document.cookie` тем же форматом, `:48`).
Проблема: ответственность за cookie-I/O timezone размазана между двумя компонентами с разной абстракцией (обёрнутая функция vs inline), риск дрейфа формата атрибут-строки. `serializeTzCookie` уже общий — дрейфа значения нет, остаётся унифицировать только строку cookie-атрибутов.
Рекомендация: вынести `writeTzCookie(c: TzCookie)` в client-safe модуль `@/utils/timezone` (без server-only) и звать из обоих мест. Координировать с находкой `cookie-write-pattern-duplicated` (общий `writeCookie`). Не блокер.
*Помечено ⚠: подкейс системного дубля cookie-политики; самостоятельно — minor.*

### hooks

Пробелов не выявлено. Проверенные хуки (`useInstallPrompt`, `useIdempotencyKey`, `useRegisterSW`, `useQueryFormSubmit`) следуют React-идиомам и каноническим паттернам §3.4/§3.5; кандидатные находки сняты (см. ниже).

### components (shared)

**[major] Идентичный паттерн записи cookie продублирован в 4 client-местах** — `cookie-write-pattern-duplicated` · *systemic*
Локации: `src/components/timezone/timezone-provider.tsx:15`, `src/app/me/settings/timezone-settings.tsx:48`, `src/app/me/settings/locale-settings.tsx:23`, `src/components/appearance/appearance-provider.tsx:22`.
Проблема: строка `document.cookie = \`${NAME}=${encodeURIComponent(...)}; path=/; max-age=31536000; samesite=lax; secure\`` дублируется один-в-один в 4 файлах (grep `max-age=31536000; samesite=lax` → ровно 4). Security-релевантная cookie-политика (max-age/samesite/secure) копируется; при смене политики придётся править 4 точки → риск дрейфа.
Рекомендация: вынести запись в общий хелпер `@/utils/cookies.ts` с `writeCookie(name, value)`, инкапсулирующим политику. Переиспользовать во всех 4 местах. Прецедент `authCookieOptions` усиливает обоснованность общего writer'а. Корень фронтовый.

**⚠ [minor] ast-render импортирует `resolveStorageUrl` через реэкспорт ast-editor** — `storage-url-import-indirection-ast-render`
Локации: `src/components/ast-render/nodes/image.tsx:4` (`from "@/components/ast-editor/upload/storage-url"`), `src/components/ast-editor/upload/storage-url.ts:3` (лишь реэкспортит `@/utils/storage-url`).
Проблема: `ast-render` тянет `resolveStorageUrl` через реэкспорт `ast-editor`, связывая два независимых компонент-семейства и добавляя слой косвенности; реэкспорт служит только внутренней стабильности импортов ast-editor (это задокументировано комментарием `storage-url.ts:1-2`).
Рекомендация: в `image.tsx:4` импортировать напрямую из `@/utils/storage-url` (семантика та же). Реэкспорт оставить как есть — он легитимен для внутренних файлов ast-editor.
*Помечено ⚠: косметическая косвенность, не баг.*

### тихие слайсы

**⚠ [minor] Annotations-permissions принимают полный тип `Annotation` вместо `Pick`** — `annotations-permissions-full-type-vs-pick`
Локации: `src/features/annotations/permissions.ts:22,30,42`; эталон `src/features/comments/permissions.ts:22` (`Pick<Comment, 'user_id'|'is_deleted'>`).
Проблема: `canEditAnnotation`/`canDeleteAnnotation`/`canAdminDeleteAnnotation` принимают полный `Annotation`, тогда как канон comments сужает тип через `Pick`. Owner-чеки (`:23,34` — `annotation.owner_id === me.id`) фактически нуждаются только в `owner_id`, но расходятся с каноном по точности типа. `canAdminDeleteAnnotation` законно нуждается в `visibility`.
Рекомендация: для `canEditAnnotation`/`canDeleteAnnotation` использовать `Pick<Annotation, 'owner_id'>` в стиле comments; `canAdminDeleteAnnotation` оставить с полным типом (нужен visibility).
*Помечено ⚠: точечный конвенциональный дрейф типа, не функциональный дефект.*

## Снято верификацией

Отклонены как ложные/обоснованный дизайн (прочитан код): инвалидация кеша в `notifications/actions.ts` (намеренно — React `cache()`, нет тегов, тест-инвариант); экспорт actions из `preferences/index.ts` (`../actions` — предписанный intra-slice паттерн, не обход G1); ручной `Authorization` в `getAnnotationsFor` (off-schema пер-сущностный роут, `instrumentedFetch` — разрешённое исключение); смешение admin-гейта и refresh в `proxy()` (proxy делает только аутентификацию, nonce обязан стампиться в middleware по контракту Next 16); deep-import `normalizeBlocks` в ast-merge (намеренная tiptap-free анти-протечка барреля); повторный `initServerObservability` в route-хендлерах (идемпотентный ensure-вызов, тест-инвариант); реестр `Tags` в 3 слайсах (инвалидация живёт в `actions.ts` через `revalidateEntity`, у каждого тега ненулевые потребители); асимметрия locale/timezone-персистентности (`Accept-Language` резолвит locale server-side, IANA-зона — нет); несимметричный storage-origin csp vs storage-url (эквивалентно, `originFromUrl("")→null`); асимметрия имён cookie `token`/`refresh_token` (стабильные внешние идентификаторы, нет конвенции); двухрежимный `getFmt` (намеренный контракт: tz-аргумент = дефолт, `opts.timeZone` приоритетен); deep-import `persist-*` из `@/i18n` (G1 scoped только на `@/features/`, server-only↔client реэкспорт невозможен); `export-proxy.ts` в `src/utils` (src/utils = общая Next-coupled инфра, не только чистые утилиты); два паттерна сабмита форм (явно разведены §3.4 мутации vs §3.5 фильтр-по-URL); `useInstallPrompt`/`useIdempotencyKey`/`useRegisterSW` null-render и rotate-дисциплина (корректны по жизненному циклу, терминальные done-состояния); асимметрия `instrumentation.ts`/`instrumentation-client.ts` (correct-by-contract Next entrypoints); `readIdempotencyKey`/`idempotencyHeaders` не в barrel (`src/utils` барреля не имеет by design — deep-import канон); `status-banner.tsx` без `'use server'` (async RSC server-only по умолчанию, директива была бы ошибкой).
