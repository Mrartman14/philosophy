# Карта смыслов — подключение к `/api/map` + overlay поиска (дизайн)

Две под-фичи поверх реализованного движка карты
([2026-06-20-semantic-map-frontend-engine-design.md](2026-06-20-semantic-map-frontend-engine-design.md)):

- **A. Swap `getMap`→`/api/map`** — заменить фикстуру на реальный бэкенд (endpoint
  уже в `@/api/schema`: `semmap.Layout`).
- **B. Overlay поиска** — `/map?q=<запрос>`: подсветка документов-источников ответа
  + маркер «центр результатов», вычисляемый на фронте.

## Статус

**Дизайн (brainstorming), не реализован.** Порядок реализации: **A → B** (A даёт
реальные данные и состояние «карта строится», на которое опирается B).

## Контракт бэкенда (факты из `@/api/schema`)

- `GET /api/map` (optional-auth, viewer-scoped): ответ `httputil.Response & { data?:
  semmap.Layout }` + заголовок `ETag`; `304` при совпадении `If-None-Match`;
  **`503 MAP_NOT_READY`** до первой фоновой сборки; `401` при битом токене.
- `semmap.Layout` (**все поля optional**): `layout_version?: string` (content-hash),
  `dims?`, `bounds?: { min?: number[]; max?: number[] }`, `clusters?: { id?, label?,
  color?, size? }[]`, `points?: { type?, id?, coords?, cluster? }[]`.
- Маркер запроса бэк **не** отдаёт: «overlay-маркер фронт считает сам из этих
  координат и хитов поиска» (описание ручки).
- `POST /api/search` → `llmretrieval.Hit[]`: `entity_id?`, `score?`, `type?`
  (`document`|`glossary`), `snippet?`, `title?`, `source_url?`. `entity_id` совпадает
  с `id` точки карты.

## A. Swap `getMap` → `/api/map` (чистый, без фолбэка)

### `getMap()` — серверный fetcher (`api.ts`)

Дискриминированный результат вместо голого `MapData` (нужны три UI-состояния):

```ts
export type MapResult =
  | { ok: true; map: MapData }
  | { ok: false; reason: "building" | "error" };

export const getMap = cache(async (): Promise<MapResult> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/map");
  if (error) {
    if (response.status === 503) return { ok: false, reason: "building" };
    return { ok: false, reason: "error" };
  }
  const layout = data?.data;
  if (!layout) return { ok: false, reason: "error" };
  return { ok: true, map: layout };
});
```

- 503 MAP_NOT_READY → `building` (не ошибка). Прочее → `error`.
- ETag/304 в v1 **игнорируем** (свежий запрос; per-viewer кеш отложен дизайном
  движка).
- `count`-параметр удаляется (был только для фикстурного стресса).

### Типы

`MapData`/`MapBounds`/`MapCluster`/`MapPoint` в `types.ts` **сужаются из
`@/api/schema`**:

```ts
import type { components } from "@/api/schema";
export type MapData = components["schemas"]["semmap.Layout"];
export type MapBounds = components["schemas"]["semmap.Bounds"];
export type MapCluster = components["schemas"]["semmap.Cluster"];
export type MapPoint = components["schemas"]["semmap.Point"];
```

Все поля становятся optional (реальность бэка). `RenderModel`/`RenderCluster`
(внутренняя форма рендерера) остаются как есть.

### Нормализатор `toRenderModel`

Вход теперь all-optional → защитные `?? default` становятся **легитимными** (поля
реально опциональны, `no-unnecessary-condition` не сработает):

- `data.points ?? []`, `data.clusters ?? []`, `data.dims ?? 3`, `data.bounds`
  (опционально — `computeBounds` уже умеет без него);
- на точку: `p.id ?? ""`, `p.cluster ?? 0`, `p.coords ?? []`, `p.type` через
  `typeIndex.get(p.type ?? "") ?? genericIdx`;
- на кластер: `c.id ?? 0`, `c.label ?? ""`, `clusterColor(c.id ?? 0, c.color)`,
  `c.size ?? …`.

Один проход в типизированные массивы (без промежуточной копии). Существующие
тесты нормализатора расширяются кейсами «все поля отсутствуют → не падает,
пустой/дефолтный RenderModel».

### Страница `/map`

```tsx
const result = await getMap();
if (!result.ok) return <MapStatePanel reason={result.reason} />;
return <main className="h-[80vh] w-full"><SemanticMap data={result.map} /></main>;
```

`MapStatePanel` (новый, в слайсе): `building` → «Карта строится, зайдите позже»;
`error` → «Не удалось загрузить карту». Строки — namespace `semanticMap`.

**RBAC:** optional-auth (`createApiClient` приложит JWT из cookie — бэк скоупит по
видимости), страница публичная, без `requireCapability` (как `/search`).

### Удаляем мёртвое после swap

- `fixtures.ts` + `fixtures.test.ts` (генератор больше не нужен — фолбэка нет).
- `schemas.ts` + `schemas.test.ts` (Zod-parse ответа): **конвенция проекта** —
  типизированные ответы рантаймом не валидируют (`search/api.ts` не валидирует);
  слой устойчивости — нормализатор.
- dev-параметр `?n=` на странице.

## B. Overlay поиска (карта владеет, поиск линкует)

### Поток данных (через URL, ноль cross-feature импортов слайсов)

```text
/search (или хедер) ──ссылка «на карте»──▶ /map?q=<query>
                                              │
        страница app/map/page.tsx (композиционный корень):
          getMap()  +  getSearchResults({ q })   ← обе фичи, page-level
                                              │
                       <SemanticMap data={map} overlay={…} />
                                              │
        слайс semantic-map: матч hits↔points по id, подсветка + маркер
```

- `/map?q=<query>`: страница читает `searchParams.q`. Есть `q` → тянет `getMap()`
  **и** `getSearchResults({ q })` (импорт `@/features/search` — это **app-страница**,
  композиция нескольких фич разрешена; слайсы друг друга НЕ импортируют). Передаёт
  хиты пропом. Нет `q` → обычная карта.
- Состояние едет через URL → шарится/бэкмаркается (`/map?q=Кант`), SSR-friendly.

### Overlay-проп (простые данные)

```ts
interface MapOverlay {
  query: string;
  hits: { id: string; type: string; score: number }[]; // из llmretrieval.Hit
}
// <SemanticMap data={…} overlay?={MapOverlay} />
```

Слайс получает хиты как **данные**, `search` не импортирует. Маппинг
`SearchHit → hit` (`entity_id`→`id`) — на странице.

### Слайс: подсветка + маркер

- **Матч:** вью строит `Set<id>` + `Map<id, score>` из `overlay.hits`, пересекая с
  `RenderModel.ids`. Хит, чьего `id` нет в загруженной карте (дрейф версии /
  невидимость) — пропускается.
- **Подсветка (рендерер):** точки-хиты — увеличенный размер + полная opacity,
  масштаб по `score`; не-хиты — приглушены (низкая opacity). Реализуется через
  per-point атрибуты (size/alpha) или второй draw-проход подсвеченных точек.
- **Маркер «центр результатов»:** чистая функция
  `weightedCentroid(points: {pos:[x,y,z]; score:number}[]): [x,y,z]` — score-взвешенный
  центроид позиций хитов. Рисуется отдельным глифом (кольцо/перекрестье). Честная
  подача: «примерно здесь / центр результатов» (не точная проекция запроса).
- **Порт:** `setOverlay(overlay: { ids: Set<string>; scores: Map<string, number>;
  marker: [number, number, number] | null } | null): void`. Вычисление в вью из
  пропа + `RenderModel`.
- **0 совпадений** (`q` есть, но ни один хит не на карте) → карта + заметка «по
  запросу ничего не найдено на карте».

### Сторона поиска (минимально, без импорта карты)

В результаты `/search` (`search-results.tsx`) добавляется ссылка **«Посмотреть на
карте»** → `RouterLink href={"/map?q=" + encodeURIComponent(query)}`. Собственный UI
слайса search, ссылается на роут — **без** импорта `@/features/semantic-map`. Search
остаётся полностью независимым (бэкенд + слайс). Строка — namespace `pages` или
`search`.

> Вне scope: «поиск в модальном окне» — отдельное UX-изменение слайса search, для
> overlay не требуется (ссылка `→/map?q=` работает откуда угодно).

## Архитектурные инварианты

- Слайсы `semantic-map` и `search` **не импортируют друг друга** (ESLint-гард).
  Связь — только через URL `?q=` + проп `overlay` (простые данные) + композиция на
  уровне `app/map/page.tsx`.
- Маркер — фронтовый расчёт (бэк это благословил); подаётся как приблизительный.
- Backend-agnostic-граница схлопывается в `getMap()` (один вызов реальной ручки).

## Тестирование

- **A:** нормализатор — кейсы all-optional/недостающих полей (не падает, дефолты).
  `getMap`-дискриминация (мок openapi-клиента: 200 → ok; 503 → building; иное →
  error) по возможности (server-only fetcher; если мок дорог — покрыть вручную).
- **B:** `weightedCentroid` — чистая, юнит-тесты (взвешивание, пустой вход → null,
  один хит). Матч hits↔points по id — юнит-тест. Подсветка/маркер в рендерере —
  typecheck/build + ручной smoke (jsdom без WebGL).

## i18n (namespace `semanticMap`, паритет ru/en)

Новые строки: `building` («Карта строится, зайдите позже»), `loadError` («Не удалось
загрузить карту»), `overlayNoMatches` («По запросу ничего не найдено на карте»),
`markerLabel` («Центр результатов»). Ссылка поиска — в `pages`/`search`.

## Изменяемые файлы

- `semantic-map/api.ts` — `getMap` → реальная ручка + `MapResult`.
- `semantic-map/types.ts` — сузить из `@/api/schema`.
- `semantic-map/to-render-model.ts` — all-optional толерантность.
- `semantic-map/renderer/{map-renderer,three-map-renderer}.ts` — `setOverlay` +
  подсветка/маркер; новый `overlay/weighted-centroid.ts` (чистый).
- `semantic-map/ui/{semantic-map-view,semantic-map}.tsx` — проп `overlay`, матч,
  заметка о 0 совпадений; `ui/map-state-panel.tsx` (building/error).
- `semantic-map/index.ts` — экспорт типа `MapOverlay`.
- `app/map/page.tsx` — `MapResult`-ветвление + `?q=` композиция getMap+getSearchResults.
- `search/ui/search-results.tsx` — ссылка «на карте».
- `i18n/messages/{ru,en}/semanticMap.ts` (+ `pages`/`search`).
- **Удаляются:** `semantic-map/{fixtures,fixtures.test,schemas,schemas.test}.ts`.

## Открытые вопросы (на этап плана)

1. Подсветка — per-point alpha-атрибут (один draw) vs второй draw-проход
   подсвеченных (решается при реализации рендерера; YAGNI-выбор).
2. Глиф маркера (кольцо/перекрестье/пульс) — мелочь, фиксируется в плане.
3. Строка ссылки поиска — namespace `pages` (рядом с `mapTitle`) vs `search`.
