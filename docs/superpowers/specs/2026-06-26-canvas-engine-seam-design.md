# Шов движка рендеринга канваса («painter boundary»)

Дата: 2026-06-26
Статус: дизайн одобрен, ожидает написания плана

## Проблема

Интерактивный редактор канваса жёстко завязан на SVG. Цель — сделать движок
рендеринга **сменяемым** (SVG → HTML5 canvas → что-то ещё) так, чтобы будущий
переход требовал написания одного нового модуля-«painter», а не переписывания
всего редактора. «Без фанатизма»: наводим порядок и по максимуму убираем
зацепление, второй движок сейчас НЕ пишем.

### Что уже хорошо

Ядро уже движок-нейтрально (чистые модули без SVG):

- [coords.ts](../../../src/features/canvas/editor/coords.ts) — математика вьюпорта/зума (screen↔world).
- [geometry-editor.ts](../../../src/features/canvas/editor/geometry-editor.ts) — hit-test узлов, ресайз, marquee.
- [interaction.ts](../../../src/features/canvas/editor/interaction.ts) — разрешение жестов (pan/marquee/zoom/nudge).
- [canvas-reducer.ts](../../../src/features/canvas/editor/canvas-reducer.ts) — стейт-машина.
- [validate.ts](../../../src/features/canvas/editor/validate.ts), [render-map.ts](../../../src/features/canvas/editor/render-map.ts), [types.ts](../../../src/features/canvas/types.ts) — данные и валидация.

### Где зацепление

1. **Отрисовка** — SVG-JSX прямо в компонентах:
   [canvas-editor.tsx](../../../src/features/canvas/ui/canvas-editor.tsx) (`<svg viewBox>`, `<defs>`/markers, marquee `<rect>`),
   [editor-node-layer.tsx](../../../src/features/canvas/ui/editor-node-layer.tsx),
   [editor-edge-layer.tsx](../../../src/features/canvas/ui/editor-edge-layer.tsx),
   [canvas-export.tsx](../../../src/features/canvas/ui/canvas-export.tsx).
2. **Модель ввода (главная зацепка)** — DOM-делегированная: каждый узловой `<g>`,
   каждая ручка-`<rect>`, порт-`<circle>`, ребро-`<path>` несут свой
   `onPointerDown`/`onDoubleClick`, а hit-test делает **браузер** (по тому, какой
   элемент кликнули). HTML canvas — это один битмап без поэлементного DOM, поэтому
   canvas-движок физически **не может** уважать поэлементные обработчики. Значит,
   настоящая граница движка требует переноса ввода на JS hit-test из одной
   поверхности.

### Решённые развилки (вход в дизайн)

- **Объём:** только шов/абстракция, второй движок сейчас не пишем (YAGNI).
- **Поверхности:** только интерактивный редактор. Read-only `CanvasRender` —
  server component (SSR, zero-JS, индексируется); canvas не умеет SSR, поэтому
  read-only остаётся SVG как есть, **вне объёма**.
- **Глубина шва:** настоящая граница движка. Painter рисует только картинку
  (`pointer-events: none`), редактор владеет одной нейтральной поверхностью и
  всем вводом через JS hit-test. Бонус: hit-test-логика переезжает в чистый
  юнит-тестируемый слой (сейчас редактор без тестов). Цена: переписывается
  маршрутизация жестов + нужен ручной браузер-QA.

## Архитектура: три слоя

```
CanvasEditor  (стейт + ВЕСЬ ввод)  ── движок-нейтрален
  • одна нейтральная поверхность <div>: pointer/wheel/keyboard,
    ResizeObserver, pointer-capture, координаты
    (getBoundingClientRect — уже нейтрален к движку)
  • hit-test в JS (чистый, юнит-тестируемый) решает каждый жест
  • собирает снапшот Scene → отдаёт painter'у
  • inline-редактор текста (HTML <textarea>) остаётся здесь (нейтрален)
        │ Scene (данные внутрь)        CanvasPainter (контракт)
        ▼                                       ▲
engine/painter.ts  — контракт
  type Scene { data, viewport, selection, hover, edgeDraft, marquee,
               invalidNodeIds, handlesForNodeId, resolveEntityRef, tool }
  interface CanvasPainter {
    Surface: ComponentType<{ scene; size }>   // рисует картинку, pointer-events:none
    exportImage(scene, opts): download .svg/.png
  }
        ▼ реализуется
engine/svg/  — ЕДИНСТВЕННЫЙ painter сегодня
  svg-painter.tsx  (<svg viewBox> + слои + arrow defs + marquee)
  svg-nodes.tsx / svg-edges.tsx / svg-overlays.tsx (рамка выделения,
    ручки ресайза, порты, превью создаваемого ребра) / svg-export.ts
  → переиспользует NodeShapeRender из canvas-render (без дублирования)
```

**Ключевой инвариант:** редактор НЕ излучает ни одного SVG-тега и не знает слова
«svg». Он знает только контракт `CanvasPainter` и тип данных `Scene`. Painter не
знает бизнес-логики/коллбэков — он чистый «рисователь» сцены.

## Поведенческое ядро: JS hit-test (новое, чистое, TDD)

Риск переезжает в **тестируемый** чистый слой (редактор по конвенции без тестов).

Новый `editor/hit-test.ts` + чистый помощник `edgeSegment()` в
[geometry.ts](../../../src/components/canvas-render/geometry.ts):

- Переиспользуем существующие чистые примитивы: `hitTestNode`, `handleAtPoint`,
  `portPoint`, `marqueeHits`.
- Добавляем:
  - `portAtPoint(p, node, offset, tol) → Side | null` — какой порт-кружок задет
    (поверх существующего `portPoint`).
  - `hitTestEdge(p, edges, nodesById, tol) → edgeId | null` — расстояние от точки
    до отрезка ребра; `tol ≈ 12px / zoom` (соответствует нынешней прозрачной
    «широкой» подложке-`<path>` для клика).
  - `edgeSegment(from, to, fromSide, toSide) → { start, end }` в geometry.ts;
    `edgePath` рефакторится поверх него (без изменения поведения — безопасно
    делится с read-only рендером).
- Оркестратор `hitTest(p, scene, tol)` возвращает дискриминированный результат:
  `{ kind: 'resize-handle', nodeId, handle }` |
  `{ kind: 'port', nodeId, side }` |
  `{ kind: 'node', nodeId }` |
  `{ kind: 'edge', edgeId }` |
  `{ kind: 'background' }`,
  в приоритете **ручка ресайза → порт → узел (верхний) → ребро → фон** — это
  зеркалит нынешний порядок `stopPropagation`/z-order. Редактор зовёт его один
  раз на pointerdown и маршрутизирует жест.

## Изменения редактора ([canvas-editor.tsx](../../../src/features/canvas/ui/canvas-editor.tsx))

- `useRef<SVGSVGElement>` → `useRef<HTMLDivElement>` (нейтральная поверхность).
  `eventWorld`, `ResizeObserver`, нативный `wheel`-listener и `setPointerCapture`
  переезжают на `<div>` — `getBoundingClientRect` работает на любом элементе, так
  что математика координат не меняется.
- Пять поэлементных обработчиков (`onBackgroundPointerDown`, `onNodePointerDown`,
  `onResizeHandleDown`, `onSideHandleDown`, `onEdgePointerDown`) схлопываются в
  один `onSurfacePointerDown`, маршрутизирующий по `hitTest(...)`.
  `onNodeDoubleClick` → `dblclick` на поверхности + `hitTestNode`. Это **убирает**
  хрупкий нюанс ретаргета захвата, описанный в
  [canvas-editor.tsx:191-196](../../../src/features/canvas/ui/canvas-editor.tsx#L191)
  (захват на одной поверхности → dblclick стреляет по ней же).
- Контекстное меню (`onCanvasContextMenu`) уже использует `hitTestNode` — по сути
  без изменений (переходит на общий `hitTest`/нейтральную поверхность).
- Редактор собирает мемоизированный `Scene` и рендерит
  `<painter.Surface scene size />` внутри `<div>`. Рамки выделения, ручки, порты,
  marquee и превью ребра — больше НЕ JSX редактора: их рисует painter из `Scene`.
- Экспорт зовёт `painter.exportImage(...)`, передавая живой `<div>` для
  разрешения цветов темы через `getComputedStyle` (работает и на `<div>`).

### Маппинг текущего состояния редактора → поля `Scene`

| Сейчас в редакторе | Поле `Scene` |
|---|---|
| `renderData` (`canvasDataToRenderData(state.data)`) | `data` |
| `state.viewport` | `viewport` |
| `state.selection` (node/edge ids) | `selection` |
| `edgeTargetId` (узел-кандидат под курсором) | `hover` |
| `edgePreview` ({from,to}) | `edgeDraft` |
| `marquee` ({x,y,w,h}) | `marquee` |
| `invalidNodeId` | `invalidNodeIds` |
| одиночное выделение (`singleSelected`) | `handlesForNodeId` |
| `resolveEntityRef` | `resolveEntityRef` |
| `state.tool` | `tool` |

## Что осознанно остаётся на месте (узкий объём)

- `src/components/canvas-render/*` (read-only рендер, `node-shapes`, `types`) —
  не трогаем, кроме добавления чистого `edgeSegment` в `geometry.ts`. SVG-painter
  **переиспользует** `NodeShapeRender` (без дублирования отрисовки узлов).
- `edgePath().d` остаётся SVG-строкой пути — документируется как «непрозрачное
  представление пути, которое умеет потреблять painter» (SVG использует напрямую;
  будущий canvas-painter — через `new Path2D(d)`). НЕ рефакторим.
- Чистое ядро (`coords`, `interaction`, `canvas-reducer`, `validate`,
  `render-map`) уже нейтрально — без изменений.
- [editor-text-overlay.tsx](../../../src/features/canvas/ui/editor-text-overlay.tsx)
  нейтрален к движку (HTML-`<textarea>` по `worldToScreen`) — остаётся.

## Перемещения файлов

| Откуда | Куда |
|---|---|
| `ui/editor-node-layer.tsx` | `engine/svg/svg-nodes.tsx` (+ chrome выделения/ручек/портов в `svg-overlays.tsx`) |
| `ui/editor-edge-layer.tsx` | `engine/svg/svg-edges.tsx` |
| `ui/canvas-export.tsx` | `engine/svg/svg-export.ts` |
| markers/marquee (инлайн в canvas-editor) | `engine/svg/svg-painter.tsx` |
| — (новое) | `engine/painter.ts` (контракт + тип `Scene`) |
| — (новое) | `engine/svg/svg-painter.tsx` (реализует контракт) |
| — (новое) | `engine/index.ts` (экспортирует активный painter) |
| — (новое) | `editor/hit-test.ts` (+ тесты) |
| — (новое helper) | `geometry.ts` `edgeSegment()` |

Правки импортов: путь в `canvas-export.test.tsx`; экспорты в `index.ts` слайса.
Все имена файлов — kebab-case (конвенция проекта). Папка `engine/` живёт внутри
слайса `src/features/canvas/` (рядом с существующей `editor/`).

## Точка смены движка

Единственная привязка в `engine/index.ts`:

```ts
export const painter: CanvasPainter = svgPainter;
```

Смена движка = добавить `engine/canvas/canvas-painter.tsx`, реализующий
`CanvasPainter`, и поменять один импорт. Рантайм-переключателя нет (YAGNI).

## Тестирование и приёмка

- **TDD** новых чистых модулей (`hit-test`, `edgeSegment`) — высокоценные, они
  заменяют браузерный hit-test: порядок приоритета, дистанция до ребра, попадание
  по порту/ручке, пороги на разных зумах.
- Все существующие чистые тесты — зелёные; [canvas-export.test.tsx](../../../src/features/canvas/ui/canvas-export.test.tsx)
  — зелёный после переезда (правка импортов).
- Дешёвый contract-smoke: SVG-painter рендерит `Scene` без падения + проверка
  соответствия типу `CanvasPainter`.
- Редактор остаётся без юнит-тестов (конвенция) → **гейт = ручной браузер-QA**:
  select/move/resize/marquee/pan/zoom/создание ребра/dblclick-редактирование
  текста/контекстное меню/экспорт svg+png.
- Финальный гейт: `pnpm lint && pnpm test && pnpm build` зелёные.

## Риски и митигации

- **R1 — пороги hit-test** (рёбра трудно кликнуть / порты мелкие на крайних
  зумах). Митигация: `tol` масштабируется как `1/zoom`; юнит-тесты фиксируют
  математику; финальная подгонка в QA.
- **R2 — регрессии pointer-capture / dblclick.** Захват на одной поверхности
  упрощает прежний нюанс с `<g>`; ручной QA-чеклист.
- **R3 — touch.** `touchAction: none` был на `<svg>` — переносится на `<div>`.
- **R4 — z-порядок оверлеев.** Painter рисует узлы → оверлеи → marquee, зеркаля
  текущий порядок.
- **R5 — цвета темы при экспорте** через `getComputedStyle` на `<div>` вместо
  `<svg>` — работает (тот же каскад).

## Вне объёма (явно)

- Второй (canvas) движок — не пишем; только готовим место.
- Read-only `CanvasRender` — остаётся SVG-server-component.
- Полная клавиатурная навигация по узлам/рёбрам — как и сейчас, отложена.
- Бэкенд — не затрагивается (чисто FE-рефактор).
