# Дизайн: generic offline foundation (кеш + офлайн-мутации)

**Дата:** 2026-06-14
**Статус:** Draft (на ревью) — v2, переработан из lecture-specific в generic foundation
**Скоуп:** Серия координированных PR. Foundation generic; первые конкретные сущности — lecture (чтение) и annotation (запись).

---

## 1. Цель и скоуп

Построить **переиспользуемую офлайн-инфраструктуру (foundation)**, на которую РАЗНЫЕ сущности проекта «насаживаются» дёшево — и для **кеша (офлайн-чтение)**, и для **мутаций (офлайн-создание с синком)**. Ядро — entity-agnostic; знание о конкретной сущности инкапсулировано в её дескрипторе.

**Первая итерация — конкретно реализуем две сущности** (чтобы валидировать обе стороны абстракции):
- **lecture** — офлайн-чтение (богатый композит: + комменты + аннотации + картинки);
- **annotation** — офлайн-создание (create-only) с foreground-синком.

Каждая следующая сущность (document, glossary, …) добавляется как «дескриптор + view», **без правок ядра**.

### Не входит (явно отложено)

- Видео/аудио офлайн (`media.url` — backend-signed cross-origin blob).
- Офлайн-**создание** комментариев и прочих сущностей (в первой итерации офлайн-write только annotation; ядро готово принять другие).
- **Офлайн-мутации update/delete** — нужна оптимистичная конкуренция (ETag/`If-Match`); включим, когда бэк даст version-токен на JSON (см. §8, §10). create-only — сейчас.
- Офлайн-создание **родительских** сущностей (граф зависимостей) и `anchor` у офлайн-аннотаций.
- Сущности вне офлайн-инварианта: media-blob, canvas-граф, search/audit/user-list (live/волатильные) — исключены явно (см. §3).
- Кеш **списков** (пока только детали-сущности); списочные фетчеры разнородны (см. §11).

---

## 2. Контекст и предпосылки

**Архитектура — server-components-first** (детали — в аудите): чтения через async server components + `createApiClient` (токен из httpOnly-cookie server-side); мутации через server actions; RBAC server-side; `revalidateEntity` — серверный tag-кэш. Клиентского data-слоя нет (`idb` удалён в `0322c44f`).

**PWA-оболочка есть:** SW `src/sw.template.js` → `public/sw.js` (генерится `scripts/generate-sw-assets.mjs`); network-first для `/api/*`, cache-first для статики/картинок (по расширению — `/static/files/{key}` без расширения не покрыт); нет Background Sync; навигация офлайн → `offline.html`. Регистрация — `src/hooks/use-register-sw.ts`. Прод — Node-сервер (`next start`); `deploy.yml` (GitHub Pages `./out`) устарел.

**Изоморфный рендер:** `AstRender` (`src/components/ast-render/*`) — чистый client-safe компонент (вход = `blocks`, `ctx` опционален), уже используется в client-дереве (`form-field-input.tsx`). Картинки — нативный `<img>` (`images.unoptimized:true`). `AnnotationCard`/`List`/`AnchorContext` уже чисты.

**Ревью гомогенности (3 агента) — ключевые выводы:**
- **Однородный кластер** (lecture, comment, annotation, document, glossary, form, submission, trail, event) имеет общую форму офлайн-снимка: *метаданные + AST-`blocks` + content-addressed картинки (`resolveStorageUrl(sha256)`) + дочерние списки (`AttachmentDTO`/`getXFor`) + ревизии*. Фетчеры унифицированы: `getXById(id, token?) → X|null`, `cache()`, 404→null/[].
- **Границы:** ESLint запрещает cross-feature импорты; `src/app/*` — легальный composition root; `features → @/services|@/api|@/utils|@/components` разрешено. Паттерн «реестр дескрипторов через инверсию зависимости» уже трижды есть в проекте (`api/tags.ts`, `PER_ENTITY_PATH`, `RESOURCE_PATH_SEGMENT`).
- **Бэкенд** (`philosophy-api`, Go, stdlib `net/http`): архитектура заточена под обобщение (composing-only пакеты `internal/llmsindex/`, реестры-мапы, готовая ETag-инфра). Lecture-scoped агрегаты (`…/comments`, `…/annotations`, `…/documents`, `…/media`, `…/tags`) уже есть; generic JSON-bundle, ETag на JSON и idempotency — отсутствуют (рычаги в §10).

**Индустриальное ревью (deep-research):** outbox + idempotency — правильный минимальный вес для create-only без конфликтов; CRDT/sync-движки — оверкилл; Репозиторий/ports-and-adapters для чтения; Cache Storage для картинок + IndexedDB для JSON; `navigator.storage.persist()`; httpOnly не блокер (cookie на same-origin едет автоматически); foreground-синк портативнее Background Sync.

---

## 3. Однородность и границы применимости

**В офлайн-инвариант (generic foundation) входят** сущности «метаданные + AST + картинки + дочерние + ревизии». Конкретно сейчас — lecture (read) + annotation (write); готовы к подключению — document, glossary, form, submission, trail, event.

**Явные спец-случаи / исключения:**
- **media** — тяжёлый signed-URL blob: метаданные могут кешироваться, файл — отдельная политика (вне v1).
- **canvas** — граф (не AST), свой сериализатор; **но** уже имеет `ETag`/`If-Match` → эталон для будущих офлайн-апдейтов (уровень 2).
- **search / audit / user-list** — live/append-only/волатильные → офлайн неприменим, исключить.
- **preferences** — singleton, тривиальный отдельный кеш (не bundle).
- **Персонализированный контент** (banner-active, `my_reactions`) — кешировать только в per-user хранилище, чистить при logout.

---

## 4. Принятые решения

| # | Решение | Обоснование |
|---|---|---|
| D1 | Объём v1: текст + картинки (без видео/аудио) | media-blob — отдельная подсистема. |
| D2 | Офлайн-чтение в отдельном client-разделе `/saved` | Не трогает SSR-страницу, изолированно. |
| D3 | Auth: foreground-синк через **same-origin** endpoint, httpOnly не трогаем | Cookie едет на same-origin автоматически. |
| D4 | Синк: foreground (online/visibilitychange/открытие) | Background Sync Chromium-only → enhancement. |
| D5 | Чтение: Репозиторий (ports-and-adapters), серверный + IndexedDB-адаптеры | Подтверждено ревью. |
| D6 | Запись: самописный outbox + idempotency-key | Под create-only без конфликтов — правильный вес. |
| D7 | Путь записи: **единый стабильный route handler** | Server actions opaque/build-hashed; стабильный URL replay-safe + SW-совместим. |
| D8 | IndexedDB: `idb` | Тонкая типизированная обёртка. |
| D9 | Картинки: Cache Storage | `<img src>` прозрачно из кэша. |
| D10 | `navigator.storage.persist()` + UX места | Storage best-effort, вытеснение whole-origin LRU. |
| **D11** | **Generic foundation** (entity-agnostic ядро + per-entity дескрипторы) | Измеренная гомогенность реальна; паттерн родной проекту. |
| **D12** | **Registry через инверсию зависимости** (foundation в `src/services/offline`, дескрипторы из фич, сборка реестра в `app/`) | Единственный легальный по ESLint канал «фича → foundation». |
| **D13** | Конкретно реализуем **lecture (read) + annotation (write)** | Две сущности валидируют обе стороны абстракции; остальные — потом дёшево. |
| **D14** | `assemble`: **фронтовая оркестрация сейчас, бэк-bundle потом** | Не блокируемся на бэке; дескриптор прячет источник → бесшовное переключение. |
| **D15** | Запись: **create-only сейчас**; update/delete — после ETag (рычаг 2) | Уровень 1 generic без боли; уровень 2 нужен version-токен. |

---

## 5. Архитектура — generic foundation + дескрипторы + composition root

```
┌─ src/services/offline/  (SHARED, entity-agnostic, фичи НЕ импортирует) ──────────┐
│  contract/descriptor.ts   тип OfflineDescriptor (плаг)                            │
│  store/*                  IndexedDB (saved-bundles, outbox) + Cache Storage       │
│  repository.ts            контракт чтения (server-адаптер / IndexedDB-адаптер)    │
│  sync/*                   generic outbox-драйвер (foreground), reconcile          │
└───────────────▲───────────────────────────────────────────────▲──────────────────┘
                │ импортирует ТОЛЬКО тип дескриптора              │ получает реестр как ДАННЫЕ
   ┌────────────┴───────────────┐                   ┌────────────┴────────────────────┐
   │ features/lectures/offline.ts│                  │ src/app/_offline/registry.ts      │
   │  export lectureDescriptor   │  ──barrel──>      │  OFFLINE_REGISTRY = {lectures,…}  │
   │ features/annotations/offline│                   │  (composition root, app/-уровень) │
   └─────────────────────────────┘                   └───────────────────────────────────┘
```

Направление зависимостей: `features → @/services/offline` (тип), `app → features(barrel) + @/services/offline`. Foundation физически не импортирует фичи (DI/registry). Полнота реестра застрахована `satisfies Record<OfflineEntity, OfflineDescriptor>` (приём drift-guard из проекта).

---

## 6. Контракт дескриптора (плаг сущности)

```ts
// src/services/offline/contract/descriptor.ts — изоморфный тип
import type { ActionResult } from "@/utils/create-action";

export interface OfflineDescriptor<TSnapshot = unknown, TWritePayload = unknown> {
  /** Стабильный ключ сущности; === Tags.* (@/api/tags). Напр. "lectures". */
  entity: string;
  /** Path-сегмент для ключей IDB / SW-match. Напр. "lectures". */
  pathSegment: string;

  // ── ЧТЕНИЕ ──
  /** server-only: собрать офлайн-снимок (фронтовая оркестрация сейчас, бэк-bundle потом). */
  assemble: (id: string) => Promise<TSnapshot | null>;
  /** Извлечь sha256-ключи всех картинок снимка (для Cache Storage). */
  extractImageKeys: (snapshot: TSnapshot) => string[];

  // ── ЗАПИСЬ (опционально; сейчас только annotation) ──
  /** server-only: создать сущность из payload (RBAC + форвард в API + idempotency-key). */
  write?: (payload: TWritePayload, idempotencyKey: string) => Promise<ActionResult<{ id: string }>>;
}
```

Каждая фича экспортирует свой дескриптор из `index.ts`; `app/_offline/registry.ts` собирает `OFFLINE_REGISTRY`; foundation принимает его параметром.

---

## 7. Чтение: generic bundle + Репозиторий

**Снимок** хранится generic: ключ `${entity}:${id}`, тело — `snapshot: TSnapshot` (форму знает дескриптор/view). Foundation не интерпретирует домен.

**Поток «Сохранить офлайн»** (онлайн, любая сущность):
1. Кнопка → generic server action `saveOffline(entity, id)`.
2. Сервер: `descriptor.assemble(id)` (через существующие `getXById`/`getXFor`, токен из cookie) → `snapshot`. Кросс-фичевые куски (лекция+теги+комменты) собирает composition-root-уровень (или бэк-bundle позже — D14).
3. `extractImageKeys(snapshot)` → список sha256.
4. Клиент пишет `SavedBundleRecord` в IndexedDB (`status:"saving"`), вызывает `persist()`, докачивает картинки в Cache Storage, `status:"complete"`. Частичные сбои отражаются в `status`.

**Репозиторий (ports-and-adapters):** контракт `getSnapshot(entity, id)`; серверный адаптер (онлайн, SSR, токен) и IndexedDB-адаптер (офлайн). View зависит от снимка, не от источника.

---

## 8. Запись: generic outbox + синк (create-only сейчас)

**Outbox — entity-agnostic очередь команд.** Офлайн-создание (annotation) пишет команду в IndexedDB, без сети:

```ts
interface OutboxCommand {
  clientId: string;   // crypto.randomUUID(): temp-id == idempotency-key == reconcile-key
  entity: string;     // "annotation"
  op: "create";       // (update/delete — позже, уровень 2)
  payload: unknown;   // entity-specific (форму знает descriptor.write)
  createdAt: string;
  status: "pending" | "syncing" | "failed" | "done";
  attempts: number;
  lastError?: string;
  serverId?: string;
}
```

**Единый generic route handler** `POST /api/offline/[entity]` (same-origin, app-уровень — может импортировать реестр): принимает `{clientId, op, payload}`, находит `descriptor.write`, исполняет server-side (RBAC + форвард в `philosophy-api` с заголовком `Idempotency-Key: clientId`), возвращает `{id}`. Тот же путь — для онлайн-создания и для дренажа outbox (один путь записи).

**Foreground-драйвер синка** (generic): триггеры `online`/`visibilitychange→visible`/открытие/кнопка. single-drain lock, серийно oldest-first. На каждую `pending`: `syncing` → `fetch("/api/offline/{entity}", {credentials:"same-origin"})`:
- **2xx**: `serverId`, `done`, **reconcile** `clientId→serverId` в снимке;
- **4xx**: `failed` + причина пользователю, без авто-ретрая;
- **сеть/5xx**: остаётся `pending`, backoff, стоп при офлайне.

**Idempotency (жёсткая зависимость бэка):** at-least-once → безопасно только при server-side дедупе по `clientId` (рычаг 3, §10).

**Уровень 2 (update/delete) — отложено (D15):** нужен version-токен (`ETag`/`If-Match`, рычаг 2); canvas — готовый референс-паттерн. Команда расширяется `op:"update"|"delete"` + `version`, route handler шлёт `If-Match`.

---

## 9. Хранилище (generic) и рендер

**IndexedDB `flbz-offline`:**
- `saved-bundles` (keyPath `key` = `${entity}:${id}`): `{ key, entity, id, savedAt, schemaVersion, status, error?, snapshot, imageKeys }`.
- `outbox` (keyPath `clientId`): `OutboxCommand`; индексы `by-status`, `by-entity`.

**Cache Storage `flbz-offline-images`:** blob по URL `/static/files/{key}`; `persist()` при первом сохранении; UX `storage.estimate()` + статус persist.

**Рендер:** view — per-entity (`SavedLectureView` сейчас), переиспользует изоморфные `AstRender`/`AnnotationCard`/`AnnotationList`/`CommentTree`+`groupByParent`; для комментов — тонкие read-only-двойники (`CommentNodeView`, якорь без фетча, сводка реакций). Офлайн-create аннотации — адаптированная форма пишет в outbox; merge кэш+pending с бейджем «не синхронизировано».

---

## 10. Бэкенд: три рычага (foundation на стороне API)

Подробный бриф — в [2026-06-14-offline-backend-asks.md](2026-06-14-offline-backend-asks.md). Кратко (ранжировано):

1. **Generic bundle endpoint** `GET /api/{entity}/{id}/bundle` — один вызов вместо N; снимает проблему cross-feature-сборки на фронте. Ложится в их composing-only паттерн (`internal/llmsindex/`). *(value высокий)*
2. **ETag/`If-None-Match` на JSON GET + bundle** (+ `updated_at` на media/tag/sharelink) — дешёвая проверка протухания снимка И version-токен для офлайн-апдейтов (уровень 2). Инфра ETag уже написана. *(value высокий, effort низкий для bundle)*
3. **Idempotency-Key middleware** — безопасные ретраи офлайн-записи; generic для всех write-ручек. Чистое место в глобальной цепочке. *(value высокий для write)*

Все три — переиспользуемая foundation и на бэке. Порядок внедрения: bundle → ETag → idempotency. Фронт не блокируется (D14: стартуем на фронтовой оркестрации + single-drain; рычаги подключаем по мере готовности).

---

## 11. Декомпозиция на PR

| PR | Тип | Содержимое |
|---|---|---|
| **F1** | foundation | `src/sw.template.js` (cache `/static/files/*` + app-shell `/saved*`). NB: `idb` добавляется в F3-плане персистентности, НЕ здесь — чтобы два PR не трогали одну строку `package.json` |
| **F2** | prerequisite | вынос чистых хелперов рендера в shared; рефактор `CommentNode` → контейнер/view |
| **F3** | infra (generic) | `src/services/offline/`: contract/descriptor, store (saved-bundles + outbox + images + persist), repository-контракт, generic sync-драйвер |
| **F4** | infra | `app/_offline/registry.ts` (composition root) + generic `saveOffline` action + generic route handler `POST /api/offline/[entity]` |
| **Слайс L** | feature | lecture-дескриптор (assemble+extractImageKeys) + раздел `/saved` + `SavedLectureView` (read) |
| **Слайс A** | feature | annotation-дескриптор (write) + офлайн-create-форма + merge pending + reconcile |

Порядок: F1–F4 → L → A. Перед PR: `pnpm lint && pnpm test && pnpm build` зелёные. **Не трогать** `public/sw.js`-артефакт (только шаблон), `.env.development.local`; `git add` — по имени.

**Причёсывание (по ревью границ):** списочные фетчеры (annotations — позиционные offset/limit) приводить к единому filter-object **только если** возьмёмся за кеш списков (вне v1).

---

## 12. Риски и анти-паттерны

- **Over-abstraction** — главный риск. Митигация (D13): валидировать ядро на **двух** сущностях (lecture read + annotation write), прежде чем объявлять foundation готовой; не писать per-entity код для прочих сущностей заранее.
- **Cross-feature сборка снимка** (лекция↔теги/комменты) — упирается в ESLint; собирать в `app/` либо ждать бэк-bundle (рычаг 1, который это устраняет).
- **Реплей server action по сохранённому запросу** — opaque/build-hashed; дренаж зовёт стабильный route handler свежим вызовом (D7).
- **Двойная отправка** — single-drain lock + server-side idempotency (рычаг 3).
- **Утечка между юзерами** — чистить `flbz-offline*` при logout; персонализированный контент кешировать осознанно.
- **Передача функций через server→client** (render-prop слоты) — переделать на данные.
- **Молчаливое усечение комментов** — сохранять все страницы, при лимите — предупреждение пользователю.

---

## 13. Тестирование

- Unit (vitest + fake-indexeddb): store (saved-bundles, outbox), sync-редьюсер (статусы/backoff/single-drain), reconcile temp→server, `extractImageKeys`, склейка пагинации.
- Контракт Репозитория: один набор тестов против server- и IndexedDB-адаптеров.
- Дескрипторы: drift-guard (`satisfies`) + per-entity assemble/write.
- Изоморфность view: рендер из фикстуры-снимка.
- Ручная: DevTools Offline → save → офлайн чтение → офлайн-создать аннотацию → сеть → синк/reconcile.

---

## 14. Ссылки

- Аудиты (5 агентов): PWA/SW, data/API, lectures, annotations, comments; + проверки ассеты/AstRender и read-only рендер.
- Ревью обобщения (3 агента): ландшафт сущностей (гомогенность), границы/композиция (registry), бэкенд-рычаги.
- Индустриальное ревью (deep-research): MDN, web.dev (storage/persistent/offline-data), Workbox, TanStack Query, Ink & Switch local-first, morling.dev idempotency.
- Конвенции: `docs/frontend-conventions.md`, `src/features/_template/`; бэкенд `docs/conventions/{package-structure,optimistic-locking}.md`.
