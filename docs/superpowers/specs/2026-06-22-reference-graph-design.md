# Граф связности корпуса (`/graph`) — refgraph v1 — Design

**Дата:** 2026-06-22
**Статус:** одобрен (brainstorming), готов к writing-plans

## Проблема и контекст

Бэкенд (реген `1ffbc241`) добавил публичный граф связности корпуса, на фронте не реализованный:

- `GET /api/graph` → `refgraph.Graph` — узлы (документы + термины глоссария) + направленные взвешенные рёбра явных ссылок (`document_ref`/`glossary_ref`). Координаты узлов считаются по связности (PCA над матрицей смежности) и отдаются в том же контракте, что карта (`dims`, `bounds`, `coords`). Граф анонимно-публичный (perimeter-aware срез: документ виден анонимно), один для всех. ETag/304. До первой фоновой сборки — `503 GRAPH_NOT_READY` (реген `e8a8849b` добавил код + ответ).
- `GET /api/graph/{type}/{id}` → `refgraph.EgoGraph` — соседи одной сущности. **ВНЕ ОБЪЁМА:** по решению пользователя это не визуализация, а будущая generic-ручка «найти соседей сущности» для других мест. В этом проекте не трогаем.

Это вторая 3D-визуализация корпуса рядом с семантической картой (`/map`). Цель — переиспользовать рендер-инфраструктуру карты там, где это **действительно оправдано** (общий стабильный каркас), без объединения ради объединения.

## Контракт бэкенда (verbatim)

```
refgraph.Graph    { bounds?: refgraph.Bounds; dims?: number; edges?: refgraph.Edge[];
                    layout_version?: string; nodes?: refgraph.Node[] }
refgraph.Node     { coords?: number[]; degree?: number; id?: string; title?: string; type?: string }
refgraph.Edge     { kind?: string; source?: refgraph.NodeRef; target?: refgraph.NodeRef; weight?: number }
refgraph.NodeRef  { id?: string; type?: string }
refgraph.Bounds   { max?: number[]; min?: number[] }
```

`layout_version` зеркалит `layout_version` карты (один version-канал на обе ручки; = значение ETag).
`GET /api/graph`: 200 `httputil.Response & { data?: refgraph.Graph }`, 304, 401 (optional-auth), 503 `GRAPH_NOT_READY`.

## Объём

**В v1:**
- Публичная страница `/graph`: облако узлов по PCA-координатам + рёбра, режимы 2D/3D, навигация по клику на узел.
- Вынос общей Three-базы рендера в foundation-модуль + миграция рендерера карты на неё.

**Вне объёма (Future):**
- Ego-граф (`/api/graph/{type}/{id}`) — будущая generic-ручка соседей, не визуализация.
- Поиск-оверлей на графе (карто-специфика; графу не нужен).
- Hover-подписи узлов, стрелки направления рёбер, размер узла по `degree` — enhancement-кандидаты, в v1 не делаем.

## Архитектура и переиспользование

### Решение по переиспользованию (обоснование)

Рендерер карты (`ThreeMapRenderer`, ~320 строк) фактически делится на:
- **~80% общий каркас:** WebGL+сцена, орто/перспектива камеры (2D/3D), OrbitControls, mount/`resize` (aspect-only), `fitToBounds`, `getViewProjection` (с ручным inverse), render-loop, `onPick`+`pickNearestPoint`, **облако точек** (BufferGeometry + PointsMaterial). Графу нужно ровно это.
- **~20% карто-специфика:** `setOverlay` (подсветка/диммирование поиска) + ring-`marker`. Графу не нужно.
- **Граф добавляет новое:** слой рёбер (`LineSegments`) + покраска узлов по `type`.

Дублировать каркас дорого (тонкости: inverse в `getViewProjection`, aspect-only resize без перекадрирования, drag-suppress в `onPick`) и склонно к дрейфу. Поэтому **выносим общий каркас в базу и мигрируем карту на неё в этой же итерации** (решение пользователя: ноль дублирования, ценой повторного QA карты).

### Где живёт общая база

ESLint запрещает cross-feature импорты и deep-импорты в чужие слайсы мимо `index.ts`. Поэтому общая база **не может остаться в слайсе `semantic-map`** и импортироваться слайсом графа — она выносится в **foundation-модуль вне слайсов**: `src/components/scene-3d/`. Это делает работу **foundation-update + 2 фичи** (касание чужого слайса `semantic-map` + создание общей инфры), а не чистый feature-слайс. (Точное имя модуля финализируется в плане; по умолчанию `scene-3d`.)

### Юниты

**`src/components/scene-3d/` (foundation, общее):**
- `scene-renderer.ts` — порт `SceneRenderer` (обобщён из `MapRenderer`): `mount/resize/setMode/setReducedMotion/setModel/fitToBounds/getViewProjection/onChange/onPick/destroy`. Тип `SceneRenderMode = "2d" | "3d"`.
- `scene-render-model.ts` — общая форма модели облака: `{ count; positions: Float32Array; colors: Float32Array; ids: string[]; bounds }`. Это вход слоя точек.
- `three-scene-renderer.ts` — **базовый** Three-класс: владеет сценой/камерами/контролами/loop/resize/`fitToBounds`/`getViewProjection`/`onPick`/облаком точек. Доменные рендереры **наследуют** его и добавляют свои слои через `protected`-доступ к `scene` + хук(и) жизненного цикла (напр. `protected onModelApplied()` после `setModel`). База НЕ знает про overlay/рёбра.
- `project.ts`, `camera-fit.ts`, `pick.ts` — pure-хелперы (переезжают из `semantic-map/renderer/`).
- `palette.ts` — цветовые хелперы (`*Color`, `hexToRgb01`) — переезжают/обобщаются.
- `ui/scene-state-panel.tsx` — состояние «строится/ошибка» (обобщён `MapStatePanel`; `reason: "building" | "error"`).
- `ui/scene-mode-toggle.tsx` — тоггл 2D/3D (обобщён `MapModeToggle`; `storageKey` — параметр, чтобы карта и граф персистили независимо).
- `ui/scene-region-labels.tsx` — проецируемые подписи (обобщён `map-region-labels`).

**`src/features/semantic-map/` (миграция, без смены поведения):**
- `three-map-renderer.ts` — наследует `ThreeSceneRenderer`, оставляет дельту: `setOverlay` (recolor по `highlightIds`) + `marker`. Карто-`pick`/`project`/`camera-fit`/`palette`/state-panel/mode-toggle/region-labels импортируются из `scene-3d`.
- `to-render-model.ts` — производит `scene-render-model` (+ карта-специфичные `docs`/`clusters` остаются на `RenderModel`, расширяющем базовую форму).
- ui (`semantic-map-view` и т.д.) — импорты переезжают на `scene-3d`; поведение и тесты сохраняются.

**`src/features/reference-graph/` (новый слайс по `_template`):**
- `api.ts` — `getGraph(): Promise<GraphResult>` (server-only, optional-auth, `React.cache`; `503` → `{ ok:false, reason:"building" }`, иначе ошибка). Зеркало `getMap`.
- `types.ts` — сужения `refgraph.*`; внутренняя `GraphRenderModel = SceneRenderModel & { edges: Float32Array; edgeAlphas: Float32Array; types: string[] }`.
- `to-graph-render-model.ts` — `refgraph.Graph` → `GraphRenderModel`: `positions`/`ids`/`colors`(по `type`)/`bounds` + рёбра (буфер пар координат source→target через map `NodeRef.id`→индекс) + альфы из `weight`. Pure, тестируемо.
- `node-route.ts` — `nodeHref(type, id)`: `document` → `/documents/{id}`, `glossary` → `/glossary/{id}`. Pure.
- `ui/three-graph-renderer.ts` — наследует `ThreeSceneRenderer` + слой рёбер (`LineSegments`, `weight`→прозрачность) + покраска узлов по `type`.
- `ui/graph.tsx` — lazy client-обёртка (зеркало `SemanticMap`).
- `ui/graph-view.tsx` — lifecycle рендерера + mode-toggle + region-labels (top-N по `degree`) + `onPick`→`router.push(nodeHref(...))`.
- `app/graph/page.tsx` — server-страница: `getGraph()` → `SceneStatePanel` при не-ok, иначе `<Graph data=…/>`. `generateMetadata`.
- i18n namespace `referenceGraph` (ru/en).

## Данные и взаимодействие

- **Узлы:** `node.coords` → `positions`; `node.id` → `ids`; цвет по `node.type` (document vs glossary — два тона из палитры); `bounds` как у карты (фолбэк — расчёт из точек).
- **Рёбра:** для каждого `edge` резолвим `source.id`/`target.id` в индексы узлов (map id→index), берём их координаты в буфер `LineSegments` (2 вершины/ребро); `weight` → прозрачность линии (vertex-alpha или per-segment). Неразрешимые рёбра (id вне набора узлов) молча пропускаются.
- **Клик по узлу** → `onPick(id)` → навигация `router.push(nodeHref(type, id))` (узел = сущность). Нужен map `id`→`type` (из узлов).
- **Подписи:** постоянные ярлыки для top-N узлов по `degree` через `projectToScreen` (как region-labels карты) — ориентир в графе. Hover — Future.
- **Перф:** граф может быть крупным; облако точек + один `LineSegments`-меш на все рёбра — один draw-call каждый. Если рёбер десятки тысяч — приемлемо; кап/децимацию не делаем в v1, но отмечаем как потенциальный Future-рычаг.

## Состояния и ошибки

- `503 GRAPH_NOT_READY` → `SceneStatePanel reason="building"` (текст «граф ещё строится»).
- Прочая ошибка/нет данных → `reason="error"`.
- Пустой граф (0 узлов) → пустое состояние во view.
- ETag/304 — как карта, в v1 не используем (свежий fetch на запрос).
- `401` optional-auth — `createApiClient` приложит JWT из cookie; срез всё равно публичный.

## FE/BE split — открытые бэк-аски (выданы пользователю 2026-06-22)

Проект ведёт UX и выдаёт бэку требования; реализацию решает бэк ([[fe-be-design-split]]). Граф строится на **выводимых из описаний** допущениях; подтвердить:

- Значения `Node.type` — ожидаем `"document" | "glossary"`; `Edge.kind`/`Neighbor.kind` — `"document_ref" | "glossary_ref"`. В схеме оставлены `string` (openapi не enum'ит Go-строки). FE кодирует эти значения как известные; при расхождении — точечная правка `node-route`/палитры.
- `Node.id` документа ведёт на `/documents/{id}`, термина — на `/glossary/{id}` (как в поиске). Подтвердить.
- (Уже закрыто регеном `e8a8849b`: `503 GRAPH_NOT_READY` есть; `dims=3`/`bounds` — по описанию контракта карты.)

FE-стопгап на время неответа: трактуем `type` как `document`/`glossary`, неизвестный `type` → узел без навигации (клик no-op) и нейтральный цвет; помечаем TODO.

## Стратегия тестирования

- **Pure-юниты:** `to-graph-render-model` (позиции/цвета/bounds + резолв рёбер, пропуск неразрешимых), `node-route` (type→href, неизвестный type), edge-alpha из weight. Полное покрытие без WebGL.
- **`scene-3d` база:** `project`/`camera-fit`/`pick` переезжают со своими тестами; базовый рендерер — тонко через мок (stub `getViewProjection` identity, синтетические pointer-события — как `three-map-renderer.test.ts`).
- **Миграция карты:** существующие юнит-тесты карты (`to-render-model`, `match-overlay`, `three-map-renderer`, `semantic-map-view`) должны остаться зелёными после переезда на базу — это и есть регресс-сеть миграции.
- **Граф-рендерер/онклик-навигация:** мок-рендерер + захват `onPick`-колбэка (как тест проводки панели карты), ассерт `router.push(nodeHref)`.
- **Ручной WebGL-QA (вне юнитов):** живая проекция камеры юнитами не покрывается. Приёмка: открыть `/graph` (узлы+рёбра, 2D и 3D), клик по узлу → переход на `/documents`|`/glossary`, drag не навигирует, подписи top-N; **повторно прогнать ручной QA карты** (`/map`) после миграции рендерера.

## Глобальные ограничения (для плана)

- pnpm; kebab-case в `src/`; зелёные `pnpm lint && pnpm test && pnpm build` перед PR.
- **Foundation-зона:** создание `src/components/scene-3d/` + миграция `semantic-map/renderer` — координированно; карта не должна изменить поведение.
- Слайс графа — по `src/features/_template/`; без cross-feature импортов (всё общее — через `scene-3d`).
- Параллельные агенты: коммитить только свои файлы по имени (`git commit --only`), без `add -A`/деструктивного git.

## Что переиспользуем vs строим заново (итог)

| Кусок | Решение |
|---|---|
| WebGL/сцена/камеры/контролы/loop/resize/fit/getViewProjection/onPick/облако точек | **Reuse** через вынос в `scene-3d` базу (карта мигрирует) |
| `project`/`camera-fit`/`pick`/`palette` | **Reuse** (переезд в `scene-3d`) |
| `MapStatePanel`/`MapModeToggle`/`map-region-labels` | **Reuse** (обобщить в `scene-3d`) |
| `setOverlay`+marker (карта) | Остаётся карто-дельтой, граф НЕ использует |
| Рёбра (`LineSegments`), покраска по `type`, node→route | **Строим заново** в слайсе графа |
| Ego-граф, поиск-оверлей, hover-подписи, стрелки, degree→size | **Вне v1** (Future) |
