# Карта смыслов — движок отрисовки на фронте (v1, дизайн)

Бэкенд-агностичный движок отрисовки **карты смыслов** (semantic map): облако
точек проекции корпуса (документы + термины глоссария), раскрашенное по
кластерам, с подписями районов, навигацией и переключателем 2D/3D. Read-only.

- **Контракт данных:** `philosophy-api/docs/superpowers/specs/2026-06-20-semantic-map-frontend-contract.md`
- **Дизайн бэка:** `philosophy-api/docs/superpowers/specs/2026-06-20-semantic-map-design.md`

## Статус

**v1 РЕАЛИЗОВАН на main** (2026-06-20, слайс `src/features/semantic-map/` + роут
`/map`; план [../plans/2026-06-20-semantic-map-frontend-engine.md](../plans/2026-06-20-semantic-map-frontend-engine.md)).
Бэкенд (`/api/map`) ещё не реализован — движок работает против фикстур контрактной
формы (`getMap()` — точка swap'а), подключение к реальной ручке за тем же
интерфейсом данных без переделки. Открытые follow-ups: i18n-строки (namespace
`semanticMap`), nav-ссылка на `/map`, swap `getMap`→`/api/map`, overlay
(`onPick`/`query_point`/подсветка хитов).

## Цель и рамки

«Карта смыслов» в контракте — это **облако точек, а не граф с рёбрами**: есть
`points[]` (документы + термины глоссария) и `clusters[]` (цвет + подпись
района); связей между точками в v1 нет. Слово «граф» здесь — scatter-карта
проекции корпуса.

**В составе v1 («только базовая отрисовка»):**

- слой данных за границей `MapData` (контракт): сегодня фикстуры, завтра `/api/map`;
- WebGL-рендерер с тумблером **2D ⇄ 3D** (бэк всегда отдаёт 3 координаты, выбор
  размерности — чисто фронтовый);
- fit-to-bounds по `bounds` ответа;
- навигация: pan/zoom (2D), орбита (3D);
- раскраска по `cluster` (+ своя палитра по `id`, если `color` не пришёл);
- подписи районов из `cluster.label`;
- устойчивость к неизвестному `type` точки и additive-полям контракта;
- resize + devicePixelRatio; состояния loading/empty/error.

**Вне v1 (порт спроектирован под них, но не реализуем):**

- ленивая подгрузка деталей точки по hover/click (п.3 контракта);
- search-overlay: маркер `query_point` + подсветка хитов поиска (п.4 контракта).

`onPick`/Raycaster в рендерере — **стаб** в v1.

## Принятые решения (лог развилок)

1. **Технология рендера = WebGL, один рендерер на оба режима** с тумблером 2D/3D
   (а не SVG/Canvas2D-2D-only). Причина: «потенциально большое» облако (весь
   корпус) и честное 3D-вращение требуют GPU; SVG/Canvas2D не дотягивают по
   масштабу, а контракт прямо обещает дешёвый выбор размерности на одной сцене.
2. **Библиотека = three.js (vanilla)** за портом `MapRenderer`. Причина: одна
   зависимость; из коробки `OrthographicCamera`/`PerspectiveCamera`,
   `OrbitControls`, `Points`/`BufferGeometry` на сотни тысяч точек, `Raycaster`
   под будущий picking; императивный API совпадает с природой порта (нет
   протекающей абстракции). r3f+drei отвергнут (+2 зависимости, трение с React
   Compiler, DX-выгода съедается императивным горячим путём); regl отвергнут
   (пришлось бы руками писать камеры/контролы/пикинг — противоречит «базовому»).
3. **Бэкенд-агностичность = граница `MapData`** (форма контракта). Swap источника
   в одной серверной функции `getMap()`; нормализатор и рендерер не знают
   происхождения данных.
4. **Дефолт режима = 2D.** Сгустки/районы читаются лучше на плоскости; 3D — по
   тумблеру, выбор персистится в `localStorage`.
5. **Подписи районов = HTML-overlay** над `<canvas>`, не текстуры: чёткий текст,
   доступность, i18n-нейтрально (метки из данных). Зеркалит
   `canvas/editor-text-overlay`.
6. **LOD/тайлинг не делаем** (контракт отложил). Цель — плавные ~100k точек;
   больше — деградирует без падения.

## Архитектура

Три развязанных слоя; каждый тестируется и меняется независимо.

```text
  ┌─ data ─────────┐   ┌─ normalize ────┐   ┌─ render ──────────────┐
  │ MapSource      │ → │ to-render-model│ → │ MapRenderer (port)    │
  │  · getMap()    │   │ MapData →      │   │  └ ThreeMapRenderer    │
  │    fixture→API │   │ RenderModel    │   │     (three.js, client) │
  │  · fixtures    │   │ (typed arrays) │   │  2D⇄3D, pan/zoom/orbit │
  └────────────────┘   └────────────────┘   └────────────────────────┘
           ▲ контракт /api/map               ▲ React-оркестратор + label-overlay
```

- **Бэкенд-агностичность** = граница `MapData`. Источник свапается в `getMap()`.
- **Изоляция three.js** за портом `MapRenderer`: ни один three-тип не торчит
  наружу `renderer/`; обновление/замена библиотеки локальны.
- Слайс **не импортит другие `@/features/*`** (форсит ESLint). Мутаций нет.

### Дерево файлов (предложение)

```text
src/features/semantic-map/
  index.ts                 // public: getMap (server), SemanticMap (lazy client)
  client.ts                // client-safe: SemanticMap, типы, fixtures, нормализатор
  types.ts                 // типы контракта (MapData/...) + RenderModel
  schemas.ts               // server-only: Zod-parse /api/map (additive-толерантный)
  api.ts                   // server-only: getMap() fixture→/api/map, cache()
  fixtures.ts              // client-safe: seeded-генератор облака точек
  to-render-model.ts       // pure: MapData → RenderModel
  palette.ts               // pure: cluster id/color → палитра
  renderer/
    map-renderer.ts        // порт-интерфейс
    three-map-renderer.ts  // three.js-реализация (client-only)
    camera-fit.ts          // pure: рамка камеры под bounds
    project.ts             // pure: world→screen (подписи)
    index.ts
  ui/
    semantic-map.tsx       // "use client" lazy-обёртка (dynamic ssr:false)
    semantic-map-view.tsx  // "use client" оркестратор (canvas+overlay+toggle+states)
    map-mode-toggle.tsx    // 2D/3D switch (Base UI), localStorage
    map-region-labels.tsx  // HTML-overlay подписей районов
  *.test.ts                // co-located юниты
```

## Слой данных (контракт-граница)

- **`types.ts`** — TS-типы контракта (`MapData`, `MapCluster`, `MapPoint`,
  `MapBounds`) + внутренний `RenderModel` (§ Нормализация). Когда бэк появится —
  сузить из `@/api/schema`; пока вручную по контракту.
- **`api.ts`** (`server-only`, `cache()`) — `getMap(): Promise<MapData>`.
  Сейчас возвращает фикстуру; позже `createApiClient().GET("/api/map")` +
  Zod-parse. `layout_version`/ETag пробрасываются. **Единственная точка swap
  бэкенда.**
- **`fixtures.ts`** (client-safe) — детерминированный генератор: N точек вокруг K
  центроидов, `bounds`, `clusters[]` (цвет+метка), доля `glossary`-маяков.
  **Seeded PRNG (mulberry32)** — без `Math.random`/`Date.now`: тесты
  детерминированы, стресс-наборы воспроизводимы. Обслуживает и серверный
  реалистичный путь (`getMap()`), и клиентский стресс-режим (N=100k синтезируется
  в браузере, минуя RSC-payload).
- **`schemas.ts`** (`server-only`) — защитный Zod-parse ответа `/api/map` для
  реального пути (additive-толерантный: незнакомые поля игнор). Реально включится
  с бэком; пока главный защитный слой — нормализатор.

## Нормализация → `RenderModel` (чистая, тестируемая)

`to-render-model.ts` — чистая функция `MapData → RenderModel`, **без WebGL**,
готовит типизированные массивы для рендерера:

- `positions: Float32Array` (N×3; читает `dims`, защитно пэддит/обрезает — 2D
  игнорит z в камере);
- `colors: Float32Array` (N×3) — резолв `cluster.color`, иначе своя палитра по
  `cluster.id` (`palette.ts`);
- `ids: string[]`, `types: Uint8Array` + таблица типов (под будущий
  picking/lazy; **неизвестный `type` → generic-слот**, не падаем);
- `bounds` (из контракта; фолбэк — посчитать из точек, если нет);
- `clusters[]` с центроидами (для подписей) и метаданными.

Вся «контрактная устойчивость» (additive-игнор, неизвестный тип, нет
цвета/`bounds`) живёт здесь и полностью покрыта юнитами.

## Порт рендерера + three.js-реализация

**`renderer/map-renderer.ts`** — императивный интерфейс (совпадает с природой
three):

```ts
interface MapRenderer {
  mount(canvas: HTMLCanvasElement): void;
  setModel(model: RenderModel): void;
  setMode(mode: "2d" | "3d"): void;
  fitToBounds(): void;
  resize(w: number, h: number, dpr: number): void;
  onPick?(cb: (id: string | null) => void): void; // стаб под overlay/lazy в v1
  destroy(): void;
}
```

**`renderer/three-map-renderer.ts`** (client-only):

- одна `Points` + `BufferGeometry` (position + per-vertex color из палитры) →
  **один draw-call** на весь корпус;
- камеры: `OrthographicCamera` (2D, честная плоскость) ⇄ `PerspectiveCamera`
  (3D); `setMode` меняет активную камеру и контролы на **тех же буферах**;
- контролы: pan+zoom без вращения (2D) ⇄ `OrbitControls` (3D);
- **render-on-demand** (dirty-flag по change-событиям контролов/данных, не вечный
  rAF) — как слайс `canvas`;
- DPR-aware + `ResizeObserver`; cap DPR ≤ 2 ради fill-rate на 100k.

**Чистые помощники вынесены и тестируются** (паттерн `canvas/editor/coords.ts` +
`render-map.ts`): `camera-fit.ts` (рамка под `bounds`), `project.ts`
(world→screen для подписей), `palette.ts`. three-glue остаётся тонким и
проверяется harness-страницей/ручной верификацией, не jsdom.

## Подписи районов

Метки кластеров — **HTML-overlay-слой** (`map-region-labels.tsx`), абсолютно
позиционированный над `<canvas>`; позиции = центроиды кластеров,
спроецированные `project.ts` на экран на каждом render-tick. Чёткий текст,
доступность, i18n-нейтрально (метки из данных). Зеркалит
`canvas/editor-text-overlay`.

## React-оркестрация и роут

- **`ui/semantic-map-view.tsx`** (`"use client"`) — держит `<canvas>` ref +
  overlay-слой, создаёт `ThreeMapRenderer` в `useEffect` (cleanup → `destroy`),
  кормит `RenderModel`, тумблер 2D/3D, состояния loading/empty/error,
  `ResizeObserver`. Тонкий glue; данные приходят пропами.
- **`ui/semantic-map.tsx`** — lazy-обёртка
  `dynamic(() => import("./semantic-map-view"), { ssr: false, loading: <Skeleton/> })`.
  **three.js никогда не попадает в SSR** (паттерн `lazy-ast-editor`).
- **`ui/map-mode-toggle.tsx`** — 2D/3D (Base UI), доступный; выбор в
  `localStorage`, дефолт 2D.
- **Роут `src/app/map/page.tsx`** (server) — `const data = await getMap()` →
  `<SemanticMap data={data} />`. Dev-аффорданс стресс-N через `?n=`. Публичный
  (как search): RBAC-гейтов нет — viewer-scoped срез делает бэк.
- **`index.ts`** — наружу: `getMap` (server) + `SemanticMap` (lazy client).
  **`client.ts`** — client-safe: `SemanticMap`, типы, `fixtures`, нормализатор
  (без реэкспорта server-only — Guardrail 4).

## Масштаб / производительность

Один buffer-draw; vertex-colors; render-on-demand; DPR-cap; типизированные
массивы строятся раз в нормализаторе. Цель — плавные ~100k; больше —
деградирует без падения. **LOD/тайлинг не делаем** (контракт отложил; кластеры —
семя под него позже).

## RBAC / приватность

Read-only потребление. Срез по видимости (аноним → public, залогиненный → своё)
— ответственность бэка (`/api/map` отдаёт уже viewer-scoped). Фронт:
`requireCapability`/`getMe` не нужны, страница публичная. Совпадает с
инвариантами MAP-1/MAP-2 дизайна бэка (карта — потребление, не производство; без
поимённого аудита).

## Тестирование

- **Чистые юниты (vitest/jsdom):** `to-render-model` (pad coords, unknown
  type→generic, нет цвета→палитра, фолбэк bounds, cluster-index), `fixtures`
  (детерминизм по seed, N, в пределах bounds), `camera-fit`/`project`/`palette`,
  `schemas` (success + unknown-field + unknown-type).
- **three-glue** не юнитим в jsdom (нет WebGL): проверяем harness-страницей +
  извлечёнными чистыми функциями. Зеркалит тест-стратегию `canvas`.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## Зависимости и координация (вне «фичи» — флагируется явно)

1. **`package.json` += `three`** — запретная зона → отдельный coordinated
   **foundation-PR**. Движок пишется против него; мерж зависимости — отдельный
   шаг.
2. **i18n** под активной параллельной работой (не мешать). Движок i18n-нейтрален;
   нужны лишь строки chrome (тумблер/состояния) — выносятся в **финальную
   интеграцию, координируемую с i18n-веткой**; engine не блокируется.
3. **Nav-ссылка** на `/map` трогает `src/app/layout.tsx` (frozen zone) → мелкий
   follow-up с владельцами shell. Роут существует, линк — отдельно.

## Открытые вопросы (на этап плана/реализации)

1. Имя роута: `/map` vs `/semantic-map` vs `/corpus`. (Контракт допускает
   обсуждение имени и серверного эндпоинта.)
2. Конкретика палитры фолбэка (число различимых цветов; согласование с
   APCA-токенами темизации проекта).
3. Поведение тумблера при свёрнутом z-разбросе данных (плоское облако в 3D).
4. Нужен ли dev-only стресс-контрол в UI или достаточно `?n=` query-параметра.
