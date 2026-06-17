# Дизайн: фундамент observability (логирование, error-handling, метрики)

**Дата:** 2026-06-17
**Контекст:** во фронте `philosophy/` (Next.js 16.1.4, App Router, RSC + Server Actions, React 19.2.3, рантайм только Node) **нет никакой observability-инфраструктуры**: ноль логгера, ~7 ad-hoc `console.*`, зрелый, но «немой» error-конвейер (`createAction`/`rethrowApiError` выбрасывают исходный `Error` после извлечения `.message`), error-boundaries игнорируют `error`+`error.digest`, метрик нет вообще (нет `instrumentation.ts`, нет middleware на `openapi-fetch`, `DrainResult` офлайн-очереди выбрасывается через `void`). Цель — выстроить **максимально чистую** архитектуру логирования, error-handling и сбора метрик; объём работы вторичен, приоритет — качество границ.

**Деплой-таргет (разрешён, был неоднозначен):** прод — самохостинг через **Docker `next start`** (живой Node-сервер, порт 3000). Доказательства: README §Деплой; `next.config.ts` без `output:"export"`; Dockerfile `next build → next start`; коммит `0109283f` «remove dead GitHub-Pages deploy workflow (app is SSR, not static export)»; `out/` в `.gitignore` (0 файлов в гите); `basePath` не прокинут в `next.config` → прод в корне origin. `.env.production` с `github.io` — вестигиальная легаси, используется только в `share-url.ts`. **Следствие:** полная серверная observability возможна (`instrumentation.ts`, `register()`, `onRequestError`, server-логи в stdout, OTel Node SDK как будущий адаптер).

## Зафиксированные решения (вход в дизайн)

| Развилка | Решение |
|---|---|
| Бэкенд-приёмник (sink) | **Vendor-neutral фасад**, конкретный sink выбираем позже (сейчас `console`/`noop`, реальный — будущий адаптер) |
| Объём v1 | **Полный**: сервер + клиент + RUM (web-vitals) |
| Приватность | **Анонимно**: только хэш актора; сырые `id`/`username`/`email` не покидают процесс; тела и значения полей всегда редактируются |
| `actorRole` в телеметрии (микро-A) | **Оставляем** (по флагу, дефолт on): не PII, low-cardinality, операционно ценен |
| Имя экшена (микро-B) | **Явный типизированный `name`/`meta`-параметр** в `createAction`/`createFormAction` (codemod по сайтам); без имени метрики экшенов бесполезны |

## Цели

- **Vendor-neutral по построению:** feature-код не знает про observability; смена реального бэкенда — один адаптер, ноль правок в фичах.
- **Инструментирование в швах, не в фичах:** один хук в `createAction` покрывает 79 экшенов в 19 слайсах; фич-файлы не меняются.
- **Восстановить таксономию ошибок**, которую сегодня схлопывает в `code: undefined` (role-403 / status-403 / 5xx / optimistic-lock / idempotency / network различимы).
- **End-to-end корреляция:** FE-`requestId` уходит на бэкенд (`X-Request-Id`), `error.digest` связывает клиентский boundary с серверной записью.
- **Приватность как инвариант:** единственная точка редакции перед любым sink; PII структурно не выразима в `Attributes`.
- **Дешёвые регрессии:** `memory-adapter` + colocated тесты на каждый шов и на редакцию.

## Рассмотренные альтернативы

- **Подход 1 — свой тонкий фасад (ports & adapters), OTel-shaped семантика, без SDK. ВЫБРАН.** Совпадает со всеми зафиксированными решениями (vendor-neutral, sink-позже, анонимный хэш); feature-код декуплен полностью; один foundation-PR; крошечный бандл; из OTel берём только семантику имён полей, чтобы OTel стал будущим drop-in адаптером.
- **Подход 2 — OpenTelemetry как становой хребет (SDK сейчас).** Стандарт, distributed tracing и propagation из коробки, но коммитит в модель OTel немедленно, тяжёлый OTel-web на клиенте (бьёт по RUM-бандлу), logs-API в OTel JS дозревает, и чтобы что-то увидеть — нужен Collector (противоречит «sink позже»). **Становится будущим адаптером за нашим фасадом.**
- **Подход 3 — Sentry-first единый SDK.** Минимум кода, батарейки включены, но **противоречит выбранному vendor-neutral фасаду** (связывает feature-код и приватность с моделью вендора), вес клиентского бандла. **Отклонён; возможен как будущий адаптер.**

## Архитектура: ports & adapters

Гексагональный сплит: **потребители** (швы) зависят от трёх эргономичных consumer-портов; **бэкенды** реализуют один provider-порт (`ObservabilitySink`); **фасад** мостит и обогащает (контекст → редакция → sampling → активный sink).

### Раскладка модуля

Дом — `src/services/observability/` (зеркалит `src/services/offline/`), с client-safe барьером по образцу `@/features/*/client` и правила G4.

```text
src/services/observability/
  index.ts                 # СЕРВЕРНЫЙ барьер: re-export log/errors/metrics + initServerObservability()
  client.ts                # КЛИЕНТСКИЙ барьер: log/errors/metrics + initClientObservability() (без server-only)
  core/
    types.ts               # Attributes, Level, ErrorClass, LogRecord, ErrorRecord, MetricRecord, ContextSnapshot
    ports.ts               # Logger, ErrorReporter, Metrics (consumer) + ObservabilitySink (provider)
    facade.ts              # изоморфный: строит record → редакция → sampling → активный sink
    registry.ts            # держит активный sink + context-provider (ставятся в init)
    redact.ts              # анонимизация: actorHash, allowlist/denylist атрибутов, дроп тел
    taxonomy.ts            # классификация неизвестного error → ErrorClass (+ backendCode, fingerprint)
  context/
    server.ts              # import 'server-only': ContextProvider на React cache() (+ опц. ALS-фолбэк)
    client.ts              # клиентский singleton ContextProvider (sessionId)
  adapters/
    console-adapter.ts     # dev: pretty; prod: NDJSON в stdout (server)
    noop-adapter.ts
    memory-adapter.ts      # для тестов (реэкспорт в src/test/)
    beacon-adapter.ts      # клиент: батч + navigator.sendBeacon → /api/telemetry
  config.ts                # env → выбор адаптера, sampling, salt, enable-флаги
```

**Принцип чистоты:** инструментирование живёт в швах (utils / api / instrumentation / boundaries), а не в 79 фич-файлах. **Feature-код менять не требуется.**

### Границы импортов и server/client

- Фасад (`log/errors/metrics`) **изоморфен** — без `server-only`, без `react-dom/client`, без статического `node:async_hooks`.
- ALS и `next/headers` живут **только** в `context/server.ts` (`import 'server-only'`); серверные адаптеры — `import 'server-only'`. Клиентский барьер `client.ts` не реэкспортит server-only модули (G4).
- Активный sink и context-provider кладутся в `registry` в момент init (серверный — в `instrumentation.ts`; клиентский — в `instrumentation-client.ts`). Фасад статически не импортит ни ALS, ни адаптеры → клиентский бандл чист.
- Фичи импортят observability через барьеры `@/services/observability` (server) / `@/services/observability/client` — санкционированный shared-дом, ESLint-гарды G1–G4 сохраняются.

## Контекст и корреляция

- **Сервер:** `getServerContext()` — `React cache()`-мемоизация на запрос (тот же приём, что `getMe`). На первом обращении строит `{ runtime:'server', requestId: crypto.randomUUID(), route: из headers(), release }`. `actorHash`/`actorRole` дописываются там, где `me` уже в руках (`getAuthState`, `requireCapability`) — **логирующий слой сам бэкенд не дёргает**. ALS — опциональная эскалация, если появится не-RSC серверный путь; в v1 не требуется.
- **Клиент:** singleton `{ runtime:'client', sessionId: crypto.randomUUID() (на загрузку страницы), route: location.pathname }`, ставится в `instrumentation-client.ts`. Актор-хэш клиенту не передаётся (живёт на `sessionId`).
- **Корреляция end-to-end:** `requestId` уходит наружу заголовком `X-Request-Id` на каждом вызове к Go-бэкенду (middleware `openapi-fetch` + общий `fetch`-враппер). `error.digest` из Next связывает клиентский boundary с серверной записью.

> **Открытый вопрос к бэкенду:** принимает ли Go-сервис входящий `X-Request-Id`/`traceparent` и эхо-ит ли его в своих логах (audit-UI показывает `request_id`). Если да — корреляция двусторонняя; если нет — остаёмся на односторонних FE-id. Не блокирует v1.

## Контракты портов

```ts
// --- общие типы (core/types.ts) ---
type Attributes = Record<string, string | number | boolean | null>; // плоско, low-cardinality, под редакцию
type Level = 'debug' | 'info' | 'warn' | 'error';

type ErrorClass =
  | 'forbidden.role' | 'forbidden.status' | 'forbidden.owner' | 'forbidden.guest'
  | 'validation' | 'banned'
  | 'conflict.version'      // optimistic lock 412/428 (VERSION_MISMATCH / IF_MATCH_REQUIRED)
  | 'conflict.idempotency' // IDEMPOTENCY_KEY_*
  | 'rate_limited' | 'not_found'
  | 'backend.5xx'          // серверная ошибка бэкенда
  | 'network'              // fetch throw / timeout / DNS
  | 'unexpected';          // действительно неизвестное

interface ContextSnapshot {
  env: 'development' | 'production' | 'test';
  runtime: 'server' | 'client' | 'sw';
  release?: string;        // git sha из билда
  requestId?: string;      // сервер, на запрос
  sessionId?: string;      // клиент, на загрузку страницы
  route?: string;          // templated path (сервер) / location.pathname (клиент)
  actorHash?: string;      // псевдоним, где me известен
  actorRole?: string;      // low-cardinality, по флагу (микро-A)
}

interface LogRecord    { level: Level; message: string; attributes: Attributes; context: ContextSnapshot; timestamp: number; }
interface ErrorRecord  { errorClass: ErrorClass; message: string; backendCode?: string; fingerprint?: string;
                         handled: boolean; cause?: { name: string; message: string; stack?: string };
                         attributes: Attributes; context: ContextSnapshot; timestamp: number; }
interface MetricRecord { name: string; kind: 'counter' | 'histogram'; value: number; unit?: 'ms' | 'count';
                         attributes: Attributes; context: ContextSnapshot; timestamp: number; }

// --- consumer-facing (это видят швы) ---
interface Logger          { debug(m: string, a?: Attributes): void; info(...): void; warn(...): void; error(...): void; }
interface ErrorReporter   { capture(error: unknown, opts?: {
                              errorClass?: ErrorClass; backendCode?: string; handled?: boolean; attributes?: Attributes }): void; }
interface Metrics         { increment(name: string, attrs?: Attributes, value?: number): void;
                            histogram(name: string, value: number, attrs?: Attributes): void;
                            startTimer(name: string, attrs?: Attributes): (extra?: Attributes) => void; }

// --- provider-facing (это реализует адаптер бэкенда) ---
interface ObservabilitySink { name: string; log(r: LogRecord): void; captureError(r: ErrorRecord): void;
                              recordMetric(r: MetricRecord): void; flush?(): Promise<void>; }
```

Сообщения (`message`) — статичные, low-cardinality; динамика идёт в `attributes`. `message` как ключ группировки, не строка интерполяции.

## Редакция / анонимизация — единственная точка приватности

Перед любым sink фасад прогоняет каждый record через `redact.ts`:

- **Актор:** `actorHash = HMAC-SHA256(id, OBSERVABILITY_ACTOR_SALT)` усечённый. **Сырой `user.id`/`username`/`email` не покидает процесс никогда.** Хэш считается на сервере.
- **Тела запросов — никогда не логируются.** `fieldErrors` → максимум множество **имён** полей, без значений.
- **Allowlist/denylist атрибутов:** ключи по паттернам (`*token*`, `authorization`, `password`, `email`, `username`, `*secret*`, `cookie`) вырезаются. Тип `Attributes` структурно запрещает вложенные объекты (только плоские примитивы).
- **Stack-трейсы** прикрепляются только на сервере; в клиентском beacon — усечённо/без локальных путей.
- Один проход, одно место — прямой юнит-тест «PII не утекает ни в log/error/metric».

## Wiring швов (централизованно, фичи не трогаем)

| Шов (файл) | Что эмитит / правка |
|---|---|
| `createAction`/`createFormAction` — `src/utils/create-action.ts` | + параметр `name`/`meta`. `startTimer('action.duration',{action})`; `action.completed{outcome:success\|<errorClass>}`; `errors.capture` по классиф. На `isNextInternalError` → re-throw, **НЕ** capture (control-flow, не ошибка). На `BannedError` → capture(`banned`)+metric, затем существующий redirect. 1 правка → 79 сайтов. |
| `rethrowApiError` — `src/utils/api-error.ts` | `backend.error{code}` по **сырому** `apperror.Code` ДО схлопывания; unmapped-код (fallback `:103`) → `errors.capture(unexpected, backendCode)` — детект новых backend-кодов. |
| `openapi-fetch` клиент — `src/api/client.ts` | `.use({onRequest,onResponse,onError})` в **обоих** фабриках: `X-Request-Id` наружу; `histogram('api.request.duration',{method,route:templated,status})`; `onError` → `api.request.error{class:'network'}` + capture. |
| Общий `fetch`-враппер (новый) | Накрывает **~10 raw-`fetch`**: `me.ts`, `auth/actions.ts` (login/register/logout), `annotations/api.ts`+`actions.ts`, `documents/actions.ts`, `media/upload-media.ts`, `ast-editor/upload/upload-image.ts`, `export-proxy.ts`, `_offline/transport.ts`, `offline/store/images.ts`. Те же тайминг/статус/ошибка + `X-Request-Id`. Multipart — без чтения тела. |
| `getAuthState` — `src/utils/me.ts` | `auth.resolve{result:guest\|active\|suspended\|banned}`; 5xx/malformed → `capture(backend.5xx\|unexpected, handled:false)` (сегодня немой инцидент). Считает `actorHash`/`actorRole` в контекст — единый источник идентичности. |
| `requireCapability`/`requireActive` — `src/utils/permissions.ts` | `rbac.denied{reason}` (guest/role/status/owner). (Имя capability скрыто в замыкании `canX` — в v1 reason-only; capability-label — позже.) |
| `revalidateEntity` — `src/utils/revalidate.ts` | `mutation.commit{entity}` — объём записей по сущностям. |
| `instrumentation.ts` (новый, корень) | `register()` бутстрапит серверный sink + context-provider (`initServerObservability`); `onRequestError(err,req,ctx)` → `capture(handled:false,{route,renderSource})` — непойманные RSC/route-ошибки. |
| Error-boundaries — `route-error.tsx`, `global-error.tsx`, 7 сегментных, `admin/error.tsx` | общий хук `useReportBoundaryError(error)` → `capture(handled:false,{digest:error.digest})`. Наконец используем брошенные `error`+`digest`. |
| `instrumentation-client.ts` (новый, корень) | `initClientObservability`: client context + beacon-adapter; `window.onerror` + `unhandledrejection` → `capture(handled:false)`; web-vitals через встроенный Next `useReportWebVitals` (без новой зависимости) → `histogram('web_vitals.<name>',{rating})`. |
| `/api/telemetry` (новый route handler) | Node-эндпоинт: батч от клиента, Zod-валидация, rate-limit по сессии, **повторная серверная редакция**, кап размера → разлив в **тот же серверный sink**. Возвращает 204. |
| Offline outbox — `src/services/offline/sync/drain.ts`, `use-offline-sync.ts` | вместо `void` — `DrainResult` → `offline.drain.{attempted,done,failed,deferred,skipped}`, `offline.queue.depth`, per-command `attempts` + poison/head-of-line (`drain.ts:90-101`). SW-lifecycle → beacon (context `runtime:'sw'`). (Write-drain сейчас DORMANT — слайс A на паузе; шов заводим, он пока холостой.) |
| ~7 ad-hoc `console.*` | заменяем на `log.*` через фасад; `no-console` ESLint-гард (исключение — `console-adapter` + `scripts/`). |

### Поток данных

```text
Сервер: шов → facade (context + redact + sample) → серверный sink → stdout NDJSON (сейчас) / OTLP (позже)
Клиент: шов/boundary/web-vital → facade → beacon-adapter → sendBeacon('/api/telemetry')
                                                              → route handler (redact #2) → тот же серверный sink
```

Всё клиентское сходится на серверном sink → **одна точка смены реального бэкенда**; клиентский бандл — только `sendBeacon`.

## Конфиг / env (документируем в `.env.example`)

| Переменная | Назначение |
|---|---|
| `OBSERVABILITY_ENABLED` | мастер-флаг (prod: on; test: off/noop) |
| `OBSERVABILITY_ADAPTER` | `console` \| `noop` (будущие `otlp` \| `sentry`) — серверный sink |
| `OBSERVABILITY_SAMPLE_RATE` | сэмплирование логов/метрик (дефолт 1.0; debug сэмплим) |
| `OBSERVABILITY_ACTOR_SALT` | серверный секрет для хэша актора |
| `NEXT_PUBLIC_OBSERVABILITY_CLIENT` | `on` \| `off` — клиентский beacon |
| `OBSERVABILITY_INGEST_PATH` | дефолт `/api/telemetry` |
| `NEXT_PUBLIC_RELEASE` | git sha из билда (поле `release`) |

## Тесты

- `memory-adapter` (пишет record в массив) → каждый шов проверяем на ожидаемый record (action.duration + корректный errorClass; backend.error с сырым кодом; тайминг middleware; boundary-хук с digest; offline drain-метрики).
- Чистые юниты: `redact` (PII не утекает), `taxonomy` (классы ошибок), context-snapshot.
- Всё colocated `*.test.ts`, существующие `vi.spyOn`-паттерны; `server-only` уже застаблен (`vitest.config.ts:29-37`). `memory-adapter` — в `src/test/`.
- Core тривиально перекрывает пороги покрытия (statements 41 / branches 30 / funcs 40 / lines 42).
- Quality gate: `pnpm lint && pnpm test && pnpm build` зелёные.

## Governance и фазирование

**Один координированный foundation-PR** по замороженным зонам CLAUDE.md (`src/utils/{create-action,api-error,me,permissions,revalidate}`, `src/api/client.ts`, `eslint.config.mjs`, `.env.example`, новые `instrumentation*.ts`, `src/services/observability/`, `/api/telemetry`). Владелец репо санкционировал foundation-изменения. ESLint: `no-console` (исключения — `console-adapter`, `scripts/`); G1–G4 сохраняются.

Раскатываем фазами (каждая — отдельный ревьюабельный диф; правила параллельных агентов: добавлять только свои файлы по имени, без деструктивного git/push):

- **Ф0 — core.** types, ports, facade, registry, context, redact, taxonomy, config, адаптеры console/noop/memory + тесты. Швы не тронуты → **ноль изменений поведения**, чистое добавление.
- **Ф1 — серверные error-швы.** createAction (+`name`/codemod), api-error, me, permissions — ловим и классифицируем ошибки.
- **Ф2 — серверные метрики.** openapi middleware, общий fetch-враппер, revalidate + `instrumentation.ts`/`onRequestError`.
- **Ф3 — клиент.** `instrumentation-client.ts`, boundary-хук, web-vitals, window.onerror + `/api/telemetry` + beacon-adapter.
- **Ф4 — offline/SW + гигиена.** offline drain/SW швы, замена ad-hoc `console`, `no-console` lint.
- **Будущее (вне scope v1):** реальный backend-адаптер (OTLP/Sentry) после выбора sink; двусторонняя backend-корреляция; capability-label в `rbac.denied`.

## Риски и открытые вопросы

- **Имя экшена.** Анонимные замыкания → `name`/`meta` нужен явный; codemod по ~79 сайтам (Ф1). Фолбэк `fn.name` для непокрытых.
- **Raw-fetch coverage.** Если общий враппер пропустит surface — он «темнеет»; Ф2 закрывает перечисленные ~10, новые raw-`fetch` ловит `no-console`-подобный гард (опц. ESLint-правило «fetch только через враппер» — кандидат на будущее).
- **Backend-корреляция** зависит от Go-сервиса (см. вопрос выше); v1 не блокирует.
- **`actorRole`** — по флагу; если политика ужесточится до «только хэш» — выключается одним флагом.
- **SW-телеметрия** минимальна (install/activate/fetch-fail); глубокая офлайн-буферизация beacon — drop-oldest + счётчик, без связки с IndexedDB-foundation (избегаем сцепления).
