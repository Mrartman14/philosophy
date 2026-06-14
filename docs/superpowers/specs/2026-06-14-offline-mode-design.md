# Дизайн: офлайн-режим (ручное сохранение лекций + офлайн-аннотации)

**Дата:** 2026-06-14
**Статус:** Draft (на ревью)
**Скоуп:** Серия координированных PR (3 foundation + 2 слайса), не одна фича-ветка.

---

## 1. Цель и скоуп

Дать пользователю:

1. **Вручную сохранять конкретную лекцию** (её данные + комментарии + аннотации + картинки) для офлайн-**чтения** в отдельном разделе «Сохранённые».
2. **В офлайне создавать аннотации** (create-only), которые автоматически синхронизируются на сервер при появлении сети (foreground-синк).

### Не входит (явно отложено)

- Видео/аудио офлайн (`media.url` — backend-signed cross-origin URL; отдельная тяжёлая подсистема).
- Офлайн-**создание** комментариев (комментарии офлайн строго read-only).
- Офлайн-создание **родительских** сущностей (document/comment/media/glossary). Аннотацию офлайн можно создать только к родителю, который уже существует на сервере (он по определению есть в сохранённом bundle) → граф зависимостей не нужен.
- `anchor` у офлайн-созданных аннотаций (совпадает с текущим состоянием формы — `annotation-create-form.tsx` в MVP anchor не ставит).
- Офлайн-редактирование/удаление аннотаций (только создание).
- True Background Sync при закрытой вкладке (Chromium-only, ~78%; оставлено как progressive enhancement, см. §10).
- Конкурентное редактирование одной сущности → CRDT/OT/sync-движки не применяются (см. §11).

---

## 2. Контекст и предпосылки (из аудита кодовой базы)

**Архитектура — server-components-first:**

- Все чтения — async server components через `createApiClient` (`src/api/client.ts`), токен (JWT) берётся server-side из **httpOnly-cookie** `token` (`next/headers`).
- Все мутации — server actions (`createAction`/`createFormAction`, `src/utils/create-action.ts`).
- RBAC server-side: `getMe()` (`src/utils/me.ts`), `requireCapability`/`canX` (`src/utils/permissions.ts`, `src/features/*/permissions.ts`).
- Инвалидация — `revalidateEntity` (`src/utils/revalidate.ts`) → серверный tag-кэш Next.
- **Клиентского data-слоя нет** (нет React Query/SWR/Zustand/IndexedDB). Пакет `idb` удалён как unused (`0322c44f`).

**PWA-оболочка уже есть:**

- SW: `src/sw.template.js` → генерится в `public/sw.js` скриптом `scripts/generate-sw-assets.mjs` на `pnpm build` (правим **шаблон**, не артефакт). Стратегии: `/api/*` network-first, `/_next/static` cache-first, картинки `.jpg|png|webp` cache-first LRU(100). **Нет** Background Sync; навигация офлайн падает на `offline.html`; `/static/files/{key}` без расширения под image-matcher **не попадает**.
- Регистрация/update: `src/hooks/use-register-sw.ts` ← `src/components/app/update-prompt.tsx` (root layout). Манифест валиден. Push end-to-end есть. Офлайн-индикатор `network-indicator.tsx` (`navigator.onLine`).

**Деплой:** прод — Node-сервер (`next start`); `next.config.ts` без `output:"export"`, используются `authInterrupts`/`forbidden()`/server actions. `deploy.yml` (GitHub Pages, `./out`) — устаревший нерабочий workflow (отдельная мелкая чистка вне скоупа). → server actions и server-side cookie-auth в проде доступны.

**Ключевые факты для рендера (из аудита):**

- `AstRender` (`src/components/ast-render/*`) — **чистый изоморфный** компонент (нет `"use client"`/`"server-only"`/сети/`getMe`), уже используется внутри client-компонента `src/features/forms/ui/form-field-input.tsx`. Вход = массив `blocks`, `ctx` опционален и нигде не передаётся. `next/image` не используется (`images.unoptimized:true`), везде нативный `<img>`.
- `AnnotationCard` / `AnnotationList` / `AnnotationAnchorContext` (`src/features/annotations/ui/*`) — **уже чистые** (без `getMe`/сети), переиспользуемы 1:1.
- `CommentSection`/`CommentNode` — server (вызывают `getMe()`); `CommentTree`+`groupByParent` — чистая логика. Нужен рефактор контейнер/view (см. §8).
- Картинки `/static/files/{sha256}` — публичные, content-addressed, **same-origin** (env-базы `NEXT_PUBLIC_STORAGE_URL`/`NEXT_PUBLIC_API_URL` не заданы → URL относительный), без auth/CORS.

**Индустриальное ревью (deep-research, 23/25 фактов подтверждено состязательно)** — сводка в §11; источники в §13.

---

## 3. Принятые решения

| # | Решение | Обоснование |
|---|---|---|
| D1 | Объём v1: **текст + картинки** | Видео/аудио — отдельная подсистема (signed cross-origin), отложено. |
| D2 | Офлайн-чтение: **отдельный client-раздел `/saved`** | Не трогает SSR-страницу, изолированно, безопаснее. |
| D3 | Auth: **foreground-синк через same-origin endpoint**, httpOnly не трогаем | `fetch` шлёт httpOnly-cookie на same-origin автоматически (MDN); прокси/токен-в-JS не нужны. |
| D4 | Синк: **foreground** (online/visibilitychange/открытие) | Background Sync Chromium-only; foreground портативен везде. |
| D5 | Чтение: **паттерн Репозиторий (ports-and-adapters)** | Один контракт, серверный + IndexedDB-адаптеры. Подтверждено ревью. |
| D6 | Запись: **самописный outbox + idempotency-key** | Под create-only без конфликтов — правильный минимальный вес; движки/CRDT оверкилл. |
| D7 | Путь записи: **единый стабильный route handler** (`app/api/...`) | Server actions — opaque/build-hashed, плохая цель реплея; стабильный URL replay-safe + future-proof для Background Sync. |
| D8 | IndexedDB-доступ: **вернуть `idb`** | Тонкая типизированная обёртка, безопаснее ручных IDB-транзакций. |
| D9 | Картинки: **Cache Storage** (не IndexedDB-blob) | URL-addressable → `<img src>` отдаётся прозрачно, рендер не трогаем. |
| D10 | **`navigator.storage.persist()`** + UX места | По умолчанию storage best-effort, вытеснение whole-origin LRU. |

---

## 4. Общая архитектура — три изолированных слоя

```
┌─ Слой UI (src/app/saved/**, src/features/offline/ui/*) ──────────┐
│  client-роут «Сохранённые»; изоморфные *View; офлайн-create-форма │
└───────────────────────────┬──────────────────────────────────────┘
                            │ зависит от контракта
┌─ Слой синхронизации (src/services/offline/sync/*) ────────────────┐
│  outbox-очередь; foreground-драйвер дренажа; reconcile temp→server │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌─ Слой персистентности (src/services/offline/store/*) ─────────────┐
│  IndexedDB (idb) + Cache Storage обёртки; persist()/estimate()     │
└────────────────────────────────────────────────────────────────────┘

Контракт чтения (порт):  LectureRepository
  ├─ ServerLectureRepository  (server-only, createApiClient)   ← онлайн
  └─ OfflineLectureRepository (client, IndexedDB)              ← офлайн
```

Каждый слой имеет один ясный смысл, общается через типизированный контракт и тестируется независимо.

---

## 5. Чтение: паттерн Репозиторий

Единый TS-контракт, два адаптера (нельзя один объект: server-only vs client-only импорты не смешиваются):

```ts
// src/services/offline/contract.ts — общий тип, без рантайм-зависимостей
export interface OfflineLectureBundle {
  lectureId: string;
  savedAt: string;            // ISO, проставляется на клиенте
  schemaVersion: number;
  lecture: LectureMeta;       // title, date, description, cover_image_key, ...
  tags: Tag[];
  comments: RootSubtree[];    // ВСЕ страницы (склейка по offset до total)
  annotations: Annotation[];  // с сервера на момент сохранения
  imageKeys: string[];        // sha256-ключи всех картинок (cover + image-ноды)
}
```

- **Онлайн** (`/lectures/[id]`): остаётся server-компонентом — фетчит через существующие `api.ts`, считает права, передаёт во `*View` сериализуемыми пропсами. **SSR и индексация сохраняются** (`"use client"` сам по себе SSR не отключает).
- **Офлайн** (`/saved/[id]`): client-контейнер читает `OfflineLectureBundle` из IndexedDB и кормит те же `*View`.

View зависят только от данных-пропсов, не от источника → «двойников» нет, единый источник правды.

---

## 6. Модель хранения

**IndexedDB БД `flbz-offline`** (версионируется; миграции через `idb` `upgrade`):

- Store `saved-lectures` (key = `lectureId`): `{ ...OfflineLectureBundle, status: "saving"|"complete"|"error", error? }`. `status` делает частичное сохранение видимым.
- Store `outbox` (key = `clientId` — UUID): см. §9.

**Cache Storage `flbz-offline-images`**: blob-ответы по URL `/static/files/{key}`. Так `<img src="/static/files/{key}">` отдаётся из кэша прозрачно (рендер не трогаем). SW добавляет ветку cache-first для `/static/files/*` (§7).

**Durability:** при первом сохранении вызвать `navigator.storage.persist()`. Грант эвристический (может вернуть `false`) → не падать, а показать статус. Вытеснение — whole-origin LRU, all-or-nothing (IndexedDB и Cache Storage уходят вместе), поэтому выбор слоя на квоту не влияет — единственный рычаг durability это `persist()`. Показывать `navigator.storage.estimate()` (использовано/доступно) и статус persist в разделе «Сохранённые».

---

## 7. Поток «Сохранить лекцию» (онлайн)

1. Кнопка «Сохранить офлайн» на `/lectures/[id]`.
2. Client → server action `getOfflineBundle(lectureId)`: сервер (с httpOnly-токеном, через существующие `api.ts`-фетчеры) собирает мету + теги + **все страницы** комментариев (цикл `offset` до `total`) + аннотации; извлекает `imageKeys` из всех `blocks` (`type:"image"` → `storage_key`) + `cover_image_key`. Возвращает `OfflineLectureBundle`.
3. Client пишет bundle в `saved-lectures` со `status:"saving"`, вызывает `persist()`.
4. Client докачивает картинки: `fetch("/static/files/{key}")` → `cache.put` в `flbz-offline-images` (same-origin, cookie не нужна, ассеты публичные). Прогресс в UI.
5. `status:"complete"`. Частичные сбои (картинка не скачалась) — не фейлят весь bundle, помечаются.

---

## 8. Рендер офлайн (контейнер/view)

**Переиспользуется без изменений:** `AstRender` + весь подграф; `AnnotationCard`/`AnnotationList`/`AnnotationAnchorContext`; `CommentTree`+`groupByParent`; `CommentTypeBadge`. Чистые функции на вынос в shared (foundation): `groupByParent`, `axisCount/axisLabel`, `formatDate`, лейбл типа коммента.

**Рефактор (foundation, фича comments):** `CommentNode` (server, `getMe`) → `CommentNodeContainer` (server: считает права-булевы) + `CommentNodeView` (`"use client"`, чистый рендер из пропсов). Online-страница кормит контейнер, offline — те же view из IndexedDB. Сериализуемость: слот-actions у `AnnotationList` (render-prop) → переделать на данные/children (через границу server→client функции не передаются).

**Новые офлайн read-only компоненты (минимум):** `SavedLectureView`, `SavedCommentsView` (дерево из bundle, мутирующие контролы скрыты), `SavedAnnotationsView` (+ merge pending из outbox с бейджем «не синхронизировано»), `OfflineCommentAnchorContext` (только `anchor.exact`, без `getBlock`-фетча), `CommentReactionsSummary` (сводка без кнопок).

**Границы (ESLint запрещает cross-feature импорты):** офлайн-код не импортирует из `features/comments|annotations`; переиспользует только shared (`src/components/ast-render/*` + вынесенные хелперы). Что нужно шарить — выносится в shared отдельным foundation-PR.

---

## 9. Запись: outbox + idempotency + reconcile

**Запись в очередь (офлайн-создание):** форма пишет в `outbox`, не зовёт сеть:

```ts
interface OutboxEntry {
  clientId: string;        // crypto.randomUUID() — temp-id == idempotency-key == reconcile-key
  type: "annotation.create";
  payload: {               // = annotation.CreateRequest + адресация родителя
    parent_entity_type: "document" | "comment" | "glossary" | "media";
    parent_entity_id: string;   // существует на сервере (из bundle)
    blocks: AstBlock[];
    visibility: "private" | "public";
    // anchor: вне скоупа v1
  };
  createdAt: string;
  status: "pending" | "syncing" | "failed" | "done";
  attempts: number;
  lastError?: string;
  serverId?: string;       // заполняется при reconcile
}
```

Аннотация сразу видна в офлайн-виде (merge `saved-lectures.annotations` + `outbox`-записи с тем же родителем, бейдж «не синхронизировано»).

**Единый route handler (D7):** `POST /api/offline/annotations` (same-origin) — принимает `payload` + `clientId`. Внутри: `getMe()` → `requireCapability(canCreateAnnotation)` → форвард в `philosophy-api` `POST /api/{seg}/{id}/annotations` с `Authorization: Bearer` (токен из httpOnly-cookie, едет автоматически) + **idempotency-key = `clientId`**. Тот же handler используется и для онлайн-создания (optimistic UI), и для дренажа outbox → один путь записи.

**Foreground-драйвер синка:** триггеры — `online`, `visibilitychange→visible`, монтирование `/saved`, кнопка «синхронизировать».

- **single-drain lock** (один проход за раз, серийно, oldest-first) — против двойной отправки в рамках сессии.
- per-entry: `syncing` → `fetch("/api/offline/annotations", {method:"POST", credentials:"same-origin", body})`:
  - **2xx**: сохранить `serverId`, `done`, **reconcile** `clientId → serverId` в `saved-lectures.annotations` (заменить pending на серверную), убрать бейдж.
  - **4xx** (forbidden/validation): `failed` + причина пользователю (branded-текст), **без авто-ретрая**.
  - **сеть/5xx**: остаётся `pending`, `attempts++`, экспоненциальный backoff, стоп при потере сети.

**Idempotency (жёсткая зависимость от бэка):** ретраи семантически at-least-once (ответ мог потеряться после коммита на сервере). Безопасно лечится только server-side дедупликацией по `clientId`. Без поддержки на бэке — релиз с задокументированным редким риском дублей; single-drain его лишь снижает. См. §12.

---

## 10. Service Worker (foundation-PR, `src/sw.template.js`)

- Ветка cache-first для `url.pathname.startsWith("/static/files/")` (сейчас не покрыты — нет расширения) → офлайн-картинки.
- App-shell для `/saved*`: отдавать кэшированную оболочку при офлайн-навигации (сейчас → `offline.html`), чтобы раздел открывался офлайн.
- Background Sync **не добавляем** в v1 (progressive enhancement позже: при наличии — фоновый дренаж того же `/api/offline/annotations`; требует доступа к токену в SW — но cookie на same-origin едет автоматически, так что препятствий нет, только browser-support).
- Помнить: `public/sw.js` регенерится `generate-sw-assets.mjs` на build — менять только шаблон.

---

## 11. Альтернативы и почему отклонены (из ревью)

- **CRDT (Yjs/Automerge), sync-движки (Replicache/Zero/ElectricSQL/PowerSync), RxDB/WatermelonDB/Dexie-sync** — решают конкурентный мерж и bidirectional sync, которых у нас нет (create-only, без конкурентного редактирования, без офлайн-родителей). Необоснованный вес + связка с бэком. *(Ink & Switch; Neon comparison.)*
- **Workbox BackgroundSyncPlugin / native Background Sync** — Chromium-only (~78%, нет Safari/Firefox), ретраит только сетевые сбои (не 4xx/5xx), и реплеит **HTTP-запрос**, что плохо ложится на server actions. Берём app-layer outbox как портативную базу; Background Sync — enhancement. *(MDN; Workbox docs.)*
- **TanStack Query (persistQueryClient + paused mutations)** — рабочая управляемая альтернатива, но вводит клиентский data-слой, которого в проекте нет, и всё равно требует `setMutationDefaults` + ручной `resumePausedMutations()`; «сохранить вот эту сущность» — не его модель. Тяжелее, чем feature-scoped outbox. *(TanStack docs.)*

---

## 12. Декомпозиция на PR (по CLAUDE.md foundation-зонам)

| PR | Тип | Содержимое | Запретные зоны |
|---|---|---|---|
| **F1** | foundation | `src/sw.template.js` (cache `/static/files/*` + app-shell `/saved*`); `package.json` — вернуть `idb` | SW, package.json |
| **F2** | foundation | вынос чистых хелперов рендера в shared (`groupByParent`, badge-label, reactions-summary, formatDate) | `src/components/*`, `src/utils/*` |
| **F3** | prerequisite | рефактор `CommentNode` → контейнер/view (`CommentNodeView` как `"use client"`) | — (comments не frozen; prerequisite-рефактор) |
| **F4** | infra | слой персистентности `src/services/offline/store/*` (IndexedDB + Cache + persist/estimate) | `src/services/*` |
| **Слайс A** | feature | `getOfflineBundle` action; кнопка «Сохранить»; раздел `/saved` (read-only рендер из IDB); UX места | — |
| **Слайс B** | feature | outbox + `POST /api/offline/annotations` + foreground-драйвер; офлайн-create-форма; merge pending + reconcile | route handler касается API-границы |

Порядок: F1–F4 → A → B. Перед каждым PR: `pnpm lint && pnpm test && pnpm build` зелёные.

---

## 13. Зависимости и открытые вопросы к бэкенду (`philosophy-api`)

1. **Idempotency-key (блокирующий для безопасности):** принимает ли `POST .../annotations` клиентский ключ (заголовок `Idempotency-Key` или `client_id` в теле) и возвращает ли тот же серверный id при повторе? Без этого — риск дублей при ретрае.
2. **Same-origin `/static/files`:** подтвердить, что статика останется same-origin (если уедет на CDN через `NEXT_PUBLIC_STORAGE_URL` — нужен CORS + правка SW, который сейчас early-return'ит cross-origin).
3. **`deploy.yml`** — устаревший GitHub Pages workflow почистить (вне скоупа офлайна, мелкий PR).

---

## 14. Риски и анти-паттерны (чего избегать)

- **Реплей server action по сохранённому HTTP-запросу** — endpoint opaque/build-hashed, ломается между деплоями. → дренаж зовёт стабильный route handler свежим вызовом (D7).
- **Надежда на «SW-кэш durable сам по себе»** — опровергнуто ревью; durability только от `persist()`.
- **Молчаливое усечение комментариев** — пагинация по корням; сохранять ВСЕ страницы, при лимите — `log`/предупреждение пользователю, не тихо.
- **Двойная отправка** — single-drain lock + server-side idempotency.
- **Утечка между пользователями на общем устройстве** — чистить `flbz-offline*` при logout.
- **Передача функций через server→client границу** (render-prop слоты) — переделать на данные.

---

## 15. Тестирование

- Unit (vitest): outbox-редьюсер (переходы статусов, backoff, single-drain), reconcile temp→server, склейка пагинации комментов, извлечение `imageKeys` из blocks.
- Контракт Репозитория: один набор тестов против обоих адаптеров (мок server / fake-indexeddb).
- Изоморфность `*View`: рендер из фиксированного bundle (как `ast-render` тесты).
- Permissions/schemas — по конвенции слайса.
- Ручная проверка офлайна: DevTools → Offline, сохранить онлайн → уйти в офлайн → читать → создать аннотацию → вернуть сеть → проверить синк/reconcile.

---

## 16. Ссылки

- Аудит кодовой базы — в обсуждении (5 агентов: PWA/SW, data/API, lectures, annotations, comments) + 2 проверки (ассеты/AstRender, read-only рендер).
- Индустриальное ревью (deep-research): MDN Offline/background operation; web.dev storage-for-the-web, persistent-storage, offline-data, service-worker-vs-http-caching; Workbox background-sync/strategies; MDN Using Fetch (credentials); TanStack Query mutations; Ink & Switch local-first essay; morling.dev on idempotency keys.
- Конвенции: `docs/frontend-conventions.md`; `src/features/_template/`.
