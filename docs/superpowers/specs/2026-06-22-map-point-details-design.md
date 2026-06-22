# Дизайн: детали точки карты смыслов + последствия chunk-shift

**Дата:** 2026-06-22
**Статус:** на ревью
**Тип:** feature-слайс (`src/features/semantic-map/`) + точечное касание i18n (флаг foundation-зоны)

## Проблема и контекст

### Что сделал бэкенд (chunk-shift)

Карта смыслов (`/api/map`, слайс `src/features/semantic-map/`) мигрирована
бэкендом на **чанковую, общую/публичную** модель. Каждая точка карты теперь —
это **чанк документа**:

- `point.id` — id строки эмбеддинга (стабилен в пределах одной генерации
  раскладки);
- `point.doc` — id родительского документа;
- `point.node` — id листового узла дерева (кластера, к которому принадлежит чанк).

Глоссарий больше **не точки** — только подписи кластеров (cluster labels).
Type-only реалайн под этот контракт уже произошёл (см. `types.ts`,
`to-render-model.ts`). Эта фича подключает **нетто-новую способность**, которую
реалайн оставил неиспользуемой.

### Что сейчас не используется на карте

1. **`POST /api/map/points`** — батч-ручка деталей точки. Zero frontend.
2. **`semmap.Layout.documents: { [docId]: string }`** — карта «id документа →
   заголовок». Net-new, не протянута во view.
3. **`semmap.Point.doc`** — теперь несётся в `RenderModel.docs` (overlay-фикс уже
   отгружён), но не используется для деталей точки.

### Что УЖЕ сделано (фундамент этой фичи, НЕ перепроектируем)

Регрессия overlay поиска починена отдельной отгрузкой:

- `RenderModel.docs: string[]` несёт `point.doc` (см. `types.ts:27-32`,
  `to-render-model.ts:49`);
- чистая `matchOverlay(model, overlay)` в
  `src/features/semantic-map/overlay/match-overlay.ts` матчит хиты поиска по
  `doc`, кладёт в `highlightIds` именно `point.id`.

Эта фича **строится поверх** doc-keyed модели и `matchOverlay`, не дублируя их.

### Критический факт по объёму — picking это СТАБ

Фетч деталей триггерится взаимодействием, но picking в рендерере **не
реализован**:

- `src/features/semantic-map/renderer/map-renderer.ts:30` объявляет
  `onPick?(cb: (id: string | null) => void): void` как стаб v1 («Реализация может
  игнорировать cb»);
- `src/features/semantic-map/renderer/three-map-renderer.ts:191-193` —
  `onPick(_cb)` игнорирует callback (нет raycasting/picking);
- view `src/features/semantic-map/ui/semantic-map-view.tsx` **не подключает**
  `onPick`.

Поэтому у фичи **два слоя**, и оба обязательны:

1. **Picking в рендерере** — реализовать клик-picking в `three-map-renderer.ts`.
2. **Путь данных деталей + UI** — server action `getMapPointDetails(ids)` →
   панель деталей.

## Контракт бэкенда (verbatim из `src/api/schema.ts`)

### `POST /api/map/points` (`schema.ts:11134-11193`)

Детали точек карты по id (батч). Read-only; optional-auth; **без audit и без
Idempotency-Key**. Резолвит ТОЛЬКО id, присутствующие в текущей опубликованной
(публичной) раскладке; неизвестные id молча пропускаются. Вьюпорт-отбор id —
работа фронта.

- requestBody — `components["schemas"]["semmap.BatchPointsRequest"]`:

  ```ts
  "semmap.BatchPointsRequest": { ids: string[] }   // кэп 300
  ```

- 200 — `components["schemas"]["httputil.Response"] & { data?: { [pointId: string]: components["schemas"]["semmap.PointDetail"] } }`:

  ```ts
  "semmap.PointDetail": {
    chunk_ord?: number;
    doc?: string;
    snippet?: string;
  }
  ```

  То есть `data` — это `Record<pointId, PointDetail>`; неизвестные id просто
  отсутствуют в карте.

- Ошибки: `400` (Bad Request), `401` (optional-auth — невалидный Bearer),
  `413` (`REQUEST_BODY_TOO_LARGE`), `422` (`httputil.ValidationErrorResponse`).

### Net-new поля layout (`schema.ts:16417-16448`)

```ts
"semmap.Layout": {
  // ...
  documents?: { [key: string]: string };   // id документа → заголовок
  points?: components["schemas"]["semmap.Point"][];
}
"semmap.Point": {
  coords?: number[];
  doc?: string;   // parent document id (lens + overlay match key)
  id?: string;    // embeddings row id (stable within one layout generation)
  node?: number;  // id of the leaf tree node this chunk belongs to
}
```

## Цели

- Клик по точке карты → панель с деталями чанка: **заголовок документа**
  (из `Layout.documents[detail.doc]`), `snippet`, `chunk_ord`, и **ссылка на
  документ** `/documents/[detail.doc]`.
- Picking в рендерере реализован реально (не стаб), но three.js остаётся скрыт за
  портом `MapRenderer` — view три-агностичен.
- Путь данных проходит через server action (api-слой слайса server-only; view —
  `"use client"`).

## Не-цели (YAGNI / Future, см. ниже)

- **Hover-тултипы** на точках — не v1.
- **Вьюпорт-батч префетч** (собрать ≤300 видимых id, батч-фетч, hover-подписи) —
  не v1.
- Мульти-селект / лассо-выбор точек.
- ETag/кеш деталей; повторный клик по той же точке делает новый запрос (дёшево,
  батч из 1 id).

## Дизайн-решения (продуктовые — следуем им)

### Взаимодействие v1 = клик по одной точке

CLICK-to-select одной точки робастен на плотном облаке: пользователь целится в
конкретную точку, получает детерминированный отклик, без шумных hover-событий по
тысячам точек. Hover и батч-префетч специально отложены (см. Future) — кэп-300 +
FE-вьюпорт-отбор в контракте `/api/map/points` спроектированы именно под этот
будущий режим.

В v1 фетч деталей — **батч из одного id** (`{ ids: [pickedId] }`). Это намеренно:
сигнатура `getMapPointDetails(ids: string[])` сразу батчевая, поэтому будущий
вьюпорт-префетч не потребует менять action — только call-site.

### Picking: screen-space nearest, а не 3D-raycaster

Picking реализуем как **проекцию всех точек в экранные координаты + поиск
ближайшей в пределах пиксельного порога**, переиспользуя существующие
`getViewProjection()` (renderer) и `projectToScreen()` (`renderer/project.ts`).

Почему не `THREE.Raycaster.params.Points.threshold`:

- Точки рисуются с `sizeAttenuation:false` (размер в ПИКСЕЛЯХ, `three-map-renderer.ts:62-72`).
  Порог raycaster'а задаётся в **мировых единицах** и не соответствует
  пиксельному размеру точки на нормализованных `~[-1,1]` координатах — пришлось бы
  пересчитывать мировой порог из пикселей на каждый клик с учётом текущего zoom.
- Screen-space подход даёт **единый пиксельный порог** (визуально предсказуемо:
  «клик в пределах N px от точки»), работает идентично в 2D и 3D, и —
  ключевое — **чистая математика выносится в тестируемый хелпер**
  (`pickNearestPoint`), а WebGL-часть рендерера остаётся тонкой.
- Переиспользуется уже существующая и уже протестированная проекция
  (`projectToScreen`, `project.test.ts`), вместо введения второго пути
  world→screen через raycaster.

Хелпер `pickNearestPoint(positions, count, viewProj, width, height, px, py, threshold)`
проецирует каждую точку (`projectToScreen`), считает евклидово расстояние в
пикселях до `(px, py)`, возвращает **индекс** ближайшей видимой точки в пределах
`threshold` или `-1`. Рендерер маппит индекс → `model.ids[index]` и зовёт cb;
промах → `cb(null)`.

Рендерер вешает `pointerdown` на canvas, конвертирует `clientX/clientY` в
canvas-local через `getBoundingClientRect()`, и (чтобы не путать клик с
pan/orbit-драгом) трактует как pick только если между `pointerdown` и `pointerup`
указатель сместился менее чем на небольшой порог (drag-suppression). Слушатели
снимаются в `destroy()`.

### Панель деталей — overlay-карточка в контейнере карты

Панель — абсолютно спозиционированная карточка внутри `wrapRef`-контейнера (как
`MapModeToggle` справа-сверху и `MapRegionLabels`). Содержит: заголовок документа
(резолвится из `documents[detail.doc]`, фолбэк — сам `detail.doc`, если заголовка
нет), `snippet`, `chunk_ord` (если есть), `RouterLink` на `/documents/[detail.doc]`,
и кнопку закрытия. Закрытие: крестик, повторный клик «в пустоту» (pick→null), либо
смена модели.

### Server/client границы (паттерн слайса)

- `api.ts` — server-only (`getMap`). Сюда же кладём `getMapPointDetails` как
  **server action** в новом `actions.ts` (`"use server"` + `"server-only"`), по
  образцу `statistics/actions.ts`: `createApiClient` → POST → `rethrowApiError` на
  ошибке → вернуть `Record`. View (`"use client"`) импортирует action напрямую из
  `../actions` — ровно как `comments/ui/comment-create-form.tsx` импортирует
  `createComment` из `../actions`.
- View тянет детали по клику: `void getMapPointDetails([id]).then(...)`,
  результат — `ActionResult<Record<string, PointDetail>>`.
- `Layout.documents` протягивается **синхронно** через `MapData` (она уже на
  контракте `data`) во view → панель. Заголовок берётся из неё, не из ответа
  ручки (ручка отдаёт `chunk_ord/doc/snippet`, заголовка в `PointDetail` нет).

### i18n (флаг foundation-зоны)

Новые UI-строки — в `src/i18n/messages/{ru,en}/semanticMap.ts` (namespace
`semanticMap`, как существующие ключи). `src/i18n/*` — foundation-зона для
feature-слайсов; добавление ключей в существующий namespace слайса — минимальное
координированное касание (паритет ru/en обязателен, иначе краснеет
`tsc`/ICU-parity тест).

## Карта переиспользования (что читать перед работой)

| Что | Файл | Зачем |
|-----|------|-------|
| Server-fetcher карты | `semantic-map/api.ts` | образец `cache` + `createApiClient` + envelope `data.data` |
| Контрактные типы | `semantic-map/types.ts` | `MapData=semmap.Layout`, `MapPoint`, `RenderModel.docs/ids` |
| Нормализация | `semantic-map/to-render-model.ts` | `RenderModel.ids[i]`/`positions[i*3..]` — индексация для picking |
| Overlay-матч (готов) | `semantic-map/overlay/match-overlay.ts` | doc-keyed модель — НЕ дублировать |
| Порт рендерера | `semantic-map/renderer/map-renderer.ts:30` | `onPick?` — стаб, который реализуем |
| Реализация рендерера | `semantic-map/renderer/three-map-renderer.ts:191` | `onPick(_cb)` стаб; `getViewProjection()`, `mount(canvas)`, `destroy()` |
| Проекция world→screen | `semantic-map/renderer/project.ts` | `projectToScreen(p, viewProj, w, h)` — переиспользуем в pick-математике |
| Тест рендерера | `semantic-map/renderer/three-map-renderer.test.ts` | как мокается `WebGLRenderer`/`OrbitControls` |
| View-композиция | `semantic-map/ui/semantic-map-view.tsx` | lifecycle-эффект `[model]`, `wrapRef`, overlay-карточки |
| Overlay-карточки | `semantic-map/ui/map-mode-toggle.tsx`, `map-region-labels.tsx` | паттерн absolute-карточки в контейнере |
| Server action образец | `features/statistics/actions.ts` | `createAction` + `createApiClient` + `rethrowApiError` + `unwrap` |
| Cross-boundary import | `features/comments/ui/comment-create-form.tsx:10` | client-view импортирует server action из `../actions` |
| Error-маппинг | `utils/api-error.ts` | `rethrowApiError` (413→`REQUEST_BODY_TOO_LARGE`, 422→fields) |
| Action-обёртка | `utils/create-action.ts` | `createAction`, `ActionResult` |
| API-клиент | `api/client.ts` | `createApiClient` (JWT из cookie, optional-auth) |
| Envelope-unwrap | `utils/api-unwrap.ts` | `unwrap<T>({ data })` |
| Ссылка-таргет | `app/documents/[id]/page.tsx` | маршрут `/documents/[id]` |
| i18n строки | `i18n/messages/{ru,en}/semanticMap.ts` | namespace, форма ключей |
| Конвенции | `docs/frontend-conventions.md` | SSR + server actions, тесты |

## FE/BE split и бэкенд-аски

Слайс ведёт UX, бэк решает реализацию контракта. Открытые вопросы к бэку:

1. **`Layout.documents` — ключ и значение.** FE предполагает: ключ = id
   документа (совпадает с `point.doc`), значение = человекочитаемый заголовок
   (FE рисует его заголовком панели). Подтвердить. Если **glossary-cluster
   подписи** живут в другом месте (например, только в `TreeNode.label`) —
   подтвердить, что `documents` это исключительно документы, чтобы FE не путал
   ключи.

2. **`PointDetail.snippet` — длина и разметка.** FE нужно знать: это plaintext
   или может содержать markup/HTML. **FE-предположение по умолчанию: plaintext**
   — рендерим как текст (React экранирует по умолчанию), без `dangerouslySetInnerHTML`.
   Если бэк шлёт markup/подсветку — нужен явный контракт (что именно, как
   санитизировать), иначе будет либо XSS-риск, либо видимые теги. Также: есть ли
   гарантия максимальной длины (для верстки карточки)?

3. **`/api/map/points` резолвит только ОПУБЛИКОВАННУЮ ПУБЛИЧНУЮ раскладку.**
   Контракт это утверждает (`schema.ts:11145`). FE-предположение: залогиненный
   пользователь, кликнувший по чанку приватного документа (если такой когда-либо
   появится в облаке), получит **пустую** карту деталей для этого id (id молча
   пропущен). FE обрабатывает «деталь не найдена» (id отсутствует в `data`) как
   валидное состояние — показывает branded-сообщение, не ошибку. Подтвердить, что
   приватные чанки в принципе не попадают в публичную раскладку (тогда кейс
   недостижим), либо что пропуск id — ожидаемое поведение.

> Любой дрейф контракта (например, `data` приходит массивом, а не картой;
> заголовок прилетает в `PointDetail`, а не в `Layout.documents`) — флагуем
> пользователю для починки корня на бэке, FE-обход только как временный стопгап
> (AGENTS.md).

## Out of scope / Future

| Отложено | Одна строка обоснования |
|----------|------------------------|
| Hover-тултипы | Шумно на плотном облаке; v1 — детерминированный клик. |
| Вьюпорт-батч префетч (≤300 видимых id) | Под него спроектирован кэп-300 + FE-вьюпорт-отбор; `getMapPointDetails(ids[])` уже батчевая — включается без смены контракта. |
| Кеш/ETag деталей | Батч из 1 id дёшев; повторный клик = новый запрос. |
| Lens-режим (подсветка всех чанков документа при клике) | Отдельная UX-итерация поверх `point.doc`. |
| Мульти-селект / лассо | Не нужно для просмотра одной точки. |

## Стратегия тестирования

### Что тестируется юнитами (vitest)

- **`pickNearestPoint` (чистая математика)** — отдельный модуль
  `renderer/pick.ts`, без three.js. Тесты: попадание в порог → индекс ближайшей;
  две точки рядом → берётся ближайшая по пикселям; промах вне порога → `-1`;
  невидимая точка (за кадром, `projectToScreen.visible=false`) игнорируется;
  пустое облако → `-1`. Переиспользует `projectToScreen` (identity-матрица в
  тестах, как `project.test.ts`).
- **`getMapPointDetails` (server action)** — мок `@/api/client` (как
  `auth/actions.test.ts` мокает fetch/headers): 200 с картой → `Record`;
  неизвестный id отсутствует в карте → не в результате; 413/422/400 → `error`
  (через `rethrowApiError`); пустой `data` → `{}`.
- **Панель деталей (UI, @testing-library/react)** — заголовок из
  `documents[doc]`; фолбэк на `doc`, если заголовка нет; `snippet`/`chunk_ord`
  рендерятся; `RouterLink` ведёт на `/documents/{doc}`; кнопка закрытия зовёт
  `onClose`.

### Что трудно юнит-тестировать (WebGL) и как это покрыто

- **`ThreeMapRenderer.onPick` (raycasting/pointer-плумбинг)** завязан на реальный
  `getBoundingClientRect`, pointer-события и WebGL-камеру. Юнит-тест
  `three-map-renderer.test.ts` уже **мокает `WebGLRenderer` и `OrbitControls`**
  (см. `vi.mock("three", …)` с `FakeWebGLRenderer` и заглушкой `OrbitControls`),
  но не WebGL-рендеринг.

  Стратегия:
  - **Вся попиксельная логика** (proj→nearest→threshold) вынесена в
    `pickNearestPoint` и покрыта юнитами **без** three.js. Это и есть «мясо»
    picking'а.
  - **`onPick` в рендерере** тестируется тонко на том же моке: вызвать `mount`
    (fake canvas с `getBoundingClientRect`), `setModel`, подписать cb через
    `onPick`, синтезировать `pointerdown`+`pointerup` (через `addEventListener`,
    перехваченный в моке canvas / реальный jsdom-EventTarget), проверить, что cb
    получил ожидаемый id (геометрию подставляем так, чтобы `getViewProjection`
    через моканную камеру дал предсказуемую проекцию — либо стаббим
    `getViewProjection` на инстансе) и `null` при клике в пустоту/драге.
  - **Реальный WebGL-рендеринг и точность проекции на живой камере** —
    **out of unit scope**: проверяется ручной браузер-приёмкой (клик по точке →
    панель с верными данными). Это честно отмечается в плане как ручной шаг.
  - **Drag-suppression** (клик ≠ orbit-драг) тестируется юнитом на пороге
    смещения pointer'а — чистая ветка, не требует WebGL.

### Регрессия

- Существующие тесты слайса (`three-map-renderer.test.ts`, `project.test.ts`,
  overlay-тесты) должны остаться зелёными — picking аддитивен, порт не ломается.
- `pnpm lint && pnpm test && pnpm build` зелёные перед PR.

## Файлы

**Новые:** `renderer/pick.ts` (+ тест), `actions.ts` (+ тест),
`ui/map-point-panel.tsx` (+ тест).

**Изменяемые:** `renderer/three-map-renderer.ts` (реализация `onPick` +
pointer-плумбинг), `renderer/index.ts` (экспорт `pickNearestPoint` если нужен
вью/тестам), `ui/semantic-map-view.tsx` (проброс `documents`, wire `onPick`,
fetch, панель), `index.ts` (экспорт типа `MapPointDetail` при необходимости),
`i18n/messages/{ru,en}/semanticMap.ts` (строки панели — foundation-зона).
