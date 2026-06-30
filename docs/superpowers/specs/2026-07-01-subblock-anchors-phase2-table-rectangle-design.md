# Под-блочные якоря Phase 2 — table-rectangle (прямоугольник в таблице)

- **Дата:** 2026-07-01
- **Статус:** дизайн одобрен, готов к плану
- **Тип:** FE-only фича (бэк НЕ меняется)
- **Предшественник:** [2026-06-30-subblock-node-id-anchors-design.md](2026-06-30-subblock-node-id-anchors-design.md) (Core — реализован на main)
- **Нормативный контракт:** [philosophy-api/docs/domain/anchors.md](../../../../philosophy-api/docs/domain/anchors.md) §«Диапазоны (три случая)» + правило 4

## Контекст и проблема

Core под-блочных якорей (node_id) поддержал два из трёх случаев диапазона контракта:
within-leaf (`start_node_id == end_node_id`) и линейный кросс-лист
(`start_node_id != end_node_id`, ни один конец не ячейка). Третий случай —
**table-rectangle**: оба конца — `table_cell` ОДНОЙ таблицы (правило 4 контракта),
прямоугольник по двум углам, «FE выводит его по геометрии». В Core он сознательно
отложен: капчур запрещает cross-cell (single-cell гард), резолвер отдаёт `null`
для двух разных ячеек → прямоугольник из данных показывается как неотличимый орфан.

Phase 2 включает создание и рендер прямоугольных якорей.

## Объём

**В Phase 2:**

- Капчур: выделение по двум ячейкам ОДНОЙ таблицы → прямоугольный якорь.
- Резолв: два угловых node_id одной таблицы → прямоугольная геометрия.
- Рендер: bounding-box подсветка (полупрозрачная заливка области от угла до угла),
  карточка/коннектор/хит-тест к прямоугольнику.

**Вне объёма (как и в Core):** Composite 1:N (разрывные/непрямоугольные наборы
ячеек), partial-cell углы (частичное выделение внутри угловой ячейки —
прямоугольник cell-granular), серверный resolve/orphan-status. Бэк не трогается.

## Решения дизайна (выбраны на брейншторме 2026-07-01)

- **Подсветка:** bounding-box заливка — ОДИН полупрозрачный прямоугольник на всю
  область (от угла до угла, включая внутренние границы), тем же `.annotation-overlay`,
  что и линейные якоря. (Отвергнуто: поячеечная заливка — больше геометрии;
  обводка рамкой — не согласуется с fill-парадигмой.)
- **Геометрия (подход A):** нормализованный `AnchorGeometry` — и линейный (Range),
  и прямоугольный сводятся к общему `{ boundingRect, clientRects }`; потребители
  source-agnostic, где возможно. (Отвергнуто: B — `kind`-ветвление в каждом
  потребителе; C — синтез Range «угол→угол», но его `getClientRects()` даёт
  row-major линейную подсветку, противоречит bounding-box.)
- **Гранулярность:** cell-granular. Якорь = две угловые ячейки (`start_node_id` /
  `end_node_id`); `start_char`/`end_char`/`exact` несутся из выделения, но
  прямоугольным резолвом ИГНОРИРУЮТСЯ (ячейки id-стабильны, резолв структурный).
- **FE-only:** бэк не меняется. Контракт уже несёт node_id; валидатор различает
  только table/non-table границу (`ast.ValidateSubBlockTextAnchor`); офсеты/exact
  хранятся непрозрачно. Прямоугольник кодируется существующими полями якоря.

## Ключевое ограничение: Highlight API не подсвечивает прямоугольники

CSS Custom Highlight API ([highlight-controller.ts](../../../src/components/anchor-engine/highlight-controller.ts))
принимает только текстовые `Range` (`new Highlight(...ranges)`). Прямоугольник —
не текст, в Highlight API не кладётся. Следствие: **прямоугольные якоря всегда
рендерятся div-оверлеем** ([highlight-overlay.tsx](../../../src/components/anchor-engine/highlight-overlay.tsx),
уже существует как фолбэк), независимо от поддержки Highlight API. Линейные якоря —
как сейчас (Highlight API при поддержке, иначе оверлей).

## Архитектура

### Тип геометрии

[types.ts](../../../src/components/anchor-engine/types.ts) — дискриминированный union:

```ts
type AnchorGeometry =
  | { kind: "range"; range: Range; boundingRect: DOMRect; clientRects: DOMRect[] }
  | { kind: "rect"; boundingRect: DOMRect; clientRects: DOMRect[] }; // clientRects = [boundingRect]
```

Общие `boundingRect`/`clientRects` у обоих; `range` только у линейного (нужен
Highlight API + caret-хит-тест).

### Новый юнит — table-grid

`src/components/anchor-engine/table-grid.ts` (новый, фокусный, юнит-тестируемый по
DOM): по DOM-ячейке `<td>`/`<th>` → grid-индекс (столбец = позиция среди
ячеек-сиблингов в `<tr>`; строка = позиция `<tr>` среди строк таблицы); по двум
угловым ячейкам → диапазон строк×столбцов (min/max — ориентация перетаскивания не
важна) → набор ячеек диапазона → bounding-box (объединение прямоугольников угловых
ячеек). Возвращает `null`, если ячейки не в одной таблице или индекс не вычислился.

### Резолв

[anchor-to-range.ts](../../../src/components/anchor-engine/anchor-to-range.ts) —
новая публичная точка входа `resolveAnchor(anchor, root): AnchorGeometry | null`:

- оба node_id резолвятся в ячейки ОДНОЙ таблицы → **прямоугольник** через
  `table-grid` → `{ kind:"rect", boundingRect, clientRects:[boundingRect] }`;
- иначе → **линейный**: переиспользует существующий `rangeFromAnchor` →
  `{ kind:"range", range, boundingRect: range.getBoundingClientRect(),
  clientRects: [...range.getClientRects()] }`;
- угловая ячейка не нашлась (мёртвый node_id) → `null` (мягкий орфан).

`rangeFromAnchor` остаётся без изменений для линейного (его тесты не трогаются).
Прямоугольник определяется на резолве (как в контракте: «три случая различает
резолвер FE»), без явного kind-поля на проводе.

### Капчур

[anchor-from-selection.ts](../../../src/components/anchor-engine/anchor-from-selection.ts) —
снять Core-запрет cross-cell, заменив на правило 4:

- обе ячейки + `sBlock === eBlock` (одна таблица) → **разрешить** (прямоугольный
  якорь: `startNodeId`/`endNodeId` = угловые ячейки, офсеты/exact из выделения);
- обе ячейки + `sBlock !== eBlock` (разные таблицы) → `null`;
- ячейка + проза (mixed) → `null`;
- ни одной ячейки → существующий линейный путь (без изменений).

Капчур не нормализует углы (start/end как есть); нормализацию в bounding-диапазон
делает резолвер.

### Потребители геометрии

| Потребитель | Изменение |
| --- | --- |
| [use-anchor-ranges.ts](../../../src/components/anchor-engine/use-anchor-ranges.ts) | `Map<string, AnchorGeometry|null>` (через `resolveAnchor`); `getAnchorRect` = `geom.boundingRect`. Пересчёт resize/fonts/notes — без изменений. |
| [use-anchor-highlights.ts](../../../src/components/anchor-engine/use-anchor-highlights.ts) + оркестратор | Маршрутизация по `kind`: линейные `range` → `controller.apply` (Highlight API) при поддержке; прямоугольные (всегда) + линейные (если Highlight API не поддержан) → div-оверлею. При поддержке API оверлей получает ТОЛЬКО rect-якоря (без двойной подсветки). |
| [highlight-overlay.tsx](../../../src/components/anchor-engine/highlight-overlay.tsx) | Принимает `clientRects` (от rect-якорей всегда, от линейных — в фолбэк-режиме). Active — `.annotation-overlay--active`. |
| [margin-anchor-layer.tsx](../../../src/components/anchor-engine/margin-anchor-layer.tsx), [margin-notes-column.tsx](../../../src/components/anchor-engine/margin-notes-column.tsx) | Через `boundingRect` (anchorTop/Bottom/Y). |
| [connector-geometry.ts](../../../src/components/anchor-engine/connector-geometry.ts) | Без изменений (чистая, берёт числа); крепление к краю прямоугольника на anchorY (верх/центр bbox) подаётся из boundingRect. |
| [hit-test.ts](../../../src/components/anchor-engine/hit-test.ts) | Ветка по `kind`: `range` → существующий `comparePoint(caret)`; `rect` → point-in-`boundingRect(x,y)`. Принимает карту `AnchorGeometry`. |

## Краевые случаи

- **Угловая ячейка удалена** (node_id мёртв) → `resolveAnchor` → `null` → орфан
  (как у любого якоря; гард удаления листа на FE не живёт — block-гранулярность).
- **Вставка строк/столбцов МЕЖДУ углами** → прямоугольник растёт, продолжая
  охватывать те же 2 угловые ячейки (трекинг углов по id — ожидаемое поведение).
- **Вырожденный диапазон** (две ячейки одной строки → 1×N, или одного столбца →
  N×1) → валидный bounding-box (полоса).
- **Одна ячейка** (`start_node_id == end_node_id`) → это within-leaf Core, НЕ
  прямоугольник (резолвится существующим линейным путём).
- **Active/hover** прямоугольника → `.annotation-overlay--active` (оверлей).

## Тестирование (TDD, по юнитам)

- **table-grid:** grid-индекс ячейки (строка/столбец из DOM); сбор ячеек диапазона;
  bbox; разные таблицы → null; вырожденные 1×N / N×1.
- **капчур:** same-table cross-cell → прямоугольный якорь (оба cell node_id);
  cross-table → null; cell+проза → null; линейная проза — без регресса.
- **resolveAnchor:** два угла одной таблицы → `{kind:"rect"}` с bbox; мёртвый угол
  → null; линейный → `{kind:"range"}` нормализован; within-leaf ячейка → range.
- **подсветка-маршрутизация:** rect → оверлей (НЕ Highlight API); линейный →
  controller при поддержке; фолбэк-режим (нет API) → оба в оверлей.
- **хит-тест:** point внутри прямоугольного bbox → id; снаружи → null; линейный —
  по-прежнему caret/comparePoint.
- **коннектор/карточка:** прямоугольный boundingRect подаётся в attach-геометрию
  (через существующие чистые функции).

## Риски / known-limitations

1. **Прямоугольник трекает углы, не «логическую область».** При вставке строк/
   столбцов между углами область растёт. Это сознательный трейд (id-стабильность
   углов > фиксированный размер); документируется.
2. **Highlight API не покрывает прямоугольники** → они всегда через оверлей (на
   1 кадр позже Highlight API при первой отрисовке; визуально незаметно).
3. **partial-cell углы не поддержаны** (cell-granular) — выделение внутри угловой
   ячейки расширяется до целой ячейки в прямоугольнике. Symmetрично Core YAGNI.
4. **RTL:** bbox строится по физическим `getBoundingClientRect` (RTL-safe, как весь
   движок — ср. `connector-layer` «RTL-safe»); визуальный/DOM-порядок столбцов не
   влияет на охват прямоугольной DOM-области.
5. **Attach коннектора у ВЕРХНЕГО края bbox** (наследует `FIRST_LINE_CLAMP` логику
   `connector-layer`: `anchorTop + min(height,24)/2`) — не центр прямоугольника.
   `connector-layer.tsx` план не меняет. Центрирование выноски прямоугольника — Phase 3.
6. **a11y/touch-капчур прямоугольника** (клавиатурное выделение диапазона ячеек,
   тач-drag двух ячеек) — наследует pointer-only ограничение Core, вне Phase 2.
   Хит-тест/активация прямоугольника — pointer-only.
7. **Вложенные таблицы** (table в ячейке) — `ownRows` исключает строки вложенной
   таблицы из grid-индекса внешней; но прямоугольник через границу вложенности не
   поддержан (редкий кейс, вне скоупа). AST-таблицы — простой грид без spans.

## FE/BE и координация

- **Бэк не меняется.** `src/api/schema.ts` не трогается.
- Затрагиваемые зоны — anchor-engine (субстрат аннотаций), правка в рамках фичи.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build` (итерации —
  `pnpm exec vitest run <path>`; `pnpm test` тянет eslint-гард).
