# Canvas Engine Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Изолировать весь SVG-рендеринг интерактивного редактора канваса за контрактом `CanvasPainter` и перенести ввод на JS hit-test из одной нейтральной поверхности, чтобы будущая смена движка (SVG → HTML5 canvas → …) сводилась к написанию одного painter-модуля.

**Architecture:** Три слоя. (1) `CanvasEditor` — стейт + весь ввод, движок-нейтрален: одна `<div>`-поверхность ловит pointer/wheel/keyboard, координаты считаются через `getBoundingClientRect`, а каждый жест решает чистый `hitTest`. (2) Контракт `engine/painter.ts` — тип `Scene` (снапшот того, что рисовать) + интерфейс `CanvasPainter`. (3) `engine/svg/*` — единственная реализация, рисует картинку (`pointer-events: none`). Read-only `CanvasRender` (server component) — вне объёма, остаётся SVG.

**Tech Stack:** TypeScript, React 19, Next 16, Vitest, pnpm. Чистые модули геометрии/хит-теста — без DOM. Презентация — SVG-JSX, переиспользует `NodeShapeRender`/`edgePath` из `@/components/canvas-render`.

**Спека:** [docs/superpowers/specs/2026-06-26-canvas-engine-seam-design.md](../specs/2026-06-26-canvas-engine-seam-design.md)

## Global Constraints

- Имена файлов и папок в `src/` — kebab-case.
- Параллельная работа агентов: НЕ `git add -A` / `git add .` — добавлять только свои файлы по имени; НЕ делать деструктивные git-операции (`stash`/`reset`/`checkout .`/`clean`); НЕ откатывать чужое.
- Допуски hit-test — константы в **мировых** единицах (НЕ `1/zoom`): текущие SVG-хит-зоны живут внутри `viewBox`. Точка приходит уже в мировых координатах (`screenToWorld`).
- `CanvasEditor` и презентационные SVG-слои НЕ покрываются юнит-тестами (конвенция как у ast-editor) → их деливерабл проверяется `pnpm build`/`pnpm typecheck` + ручной браузер-QA. Юнит-тестами покрываем только чистые модули (`edgeSegment`, `hit-test`, painter-smoke).
- Painter рисует ВСЁ с `pointer-events: none` (через стиль на корневом `<svg>`); ввод владеет редактор.
- Read-only `src/components/canvas-render/canvas-render.tsx` НЕ трогаем; в `geometry.ts` только добавляем чистый `edgeSegment` и рефакторим `edgePath` поверх него без изменения поведения.
- Финальный гейт перед завершением: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — всё зелёное.
- TS-конфиг строгий (`noUncheckedIndexedAccess`): индексацию массива страховать `?? null`, не `!`.
- Субагенты-исполнители — на модели opus.

---

## File Structure

**Создаются:**
- `src/features/canvas/engine/painter.ts` — контракт: типы `Scene`, `SurfaceSize`, `CanvasPainter`.
- `src/features/canvas/engine/index.ts` — активный движок `painter` + ре-экспорт типов/`svgPainter`.
- `src/features/canvas/engine/svg/svg-painter.tsx` — `SvgSurface` (корневой `<svg viewBox>` + defs + слои + marquee) и объект `svgPainter`.
- `src/features/canvas/engine/svg/svg-edges.tsx` — `SvgEdges` (видимые рёбра + стрелки + подписи + превью).
- `src/features/canvas/engine/svg/svg-nodes.tsx` — `SvgNodes` (узлы через `NodeShapeRender`).
- `src/features/canvas/engine/svg/svg-overlays.tsx` — `SvgOverlays` (подсветка цели, рамки, ручки, порты).
- `src/features/canvas/engine/svg/svg-export.tsx` — экспорт `.svg`/`.png` (переезд из `ui/canvas-export.tsx`).
- `src/features/canvas/engine/svg/svg-painter.test.tsx` — smoke-тест Surface.
- `src/features/canvas/engine/svg/svg-export.test.tsx` — переезд `ui/canvas-export.test.tsx`.
- `src/features/canvas/editor/hit-test.ts` — `hitTest`, `hitTestEdge`, `portAtPoint`, типы, константы.
- `src/features/canvas/editor/hit-test.test.ts` — тесты хит-теста.

**Модифицируются:**
- `src/components/canvas-render/geometry.ts` — добавить `edgeSegment`, рефактор `edgePath`.
- `src/components/canvas-render/geometry.test.ts` — тесты `edgeSegment`.
- `src/components/canvas-render/index.ts` — экспорт `edgeSegment`.
- `src/features/canvas/editor/geometry-editor.ts` — вынести `PORT_OFFSET` константу.
- `src/features/canvas/editor/index.ts` — экспорт `PORT_OFFSET` + хит-теста.
- `src/features/canvas/ui/canvas-editor.tsx` — перевод на painter-шов.

**Удаляются (в конце):**
- `src/features/canvas/ui/editor-node-layer.tsx`
- `src/features/canvas/ui/editor-edge-layer.tsx`
- `src/features/canvas/ui/canvas-export.tsx`

---

## Task 1: Чистый `edgeSegment` в geometry.ts

**Files:**
- Modify: `src/components/canvas-render/geometry.ts`
- Modify: `src/components/canvas-render/index.ts`
- Test: `src/components/canvas-render/geometry.test.ts`

**Interfaces:**
- Produces: `edgeSegment(from: RenderNode, to: RenderNode, fromSide: Side | undefined, toSide: Side | undefined): { start: Point; end: Point }` — экспортирован из `@/components/canvas-render`.
- Поведение `edgePath` не меняется (тот же `d`/`mid`/`end`).

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `src/components/canvas-render/geometry.test.ts`:

```ts
import { edgeSegment } from "./geometry";

describe("edgeSegment", () => {
  const a: RenderNode = { id: "a", type: "shape", x: 0, y: 0, width: 100, height: 100 };
  const b: RenderNode = { id: "b", type: "shape", x: 300, y: 0, width: 100, height: 100 };

  it("по заданным сторонам — точки на серединах сторон", () => {
    const { start, end } = edgeSegment(a, b, "right", "left");
    expect(start).toEqual({ x: 100, y: 50 });
    expect(end).toEqual({ x: 300, y: 50 });
  });

  it("без сторон — пересечение границ по лучу между центрами", () => {
    const { start, end } = edgeSegment(a, b, undefined, undefined);
    expect(start).toEqual({ x: 100, y: 50 });
    expect(end).toEqual({ x: 300, y: 50 });
  });

  it("edgePath строит d/mid/end из тех же точек", () => {
    const geo = edgePath(a, b, "right", "left");
    expect(geo.d).toBe("M 100 50 L 300 50");
    expect(geo.mid).toEqual({ x: 200, y: 50 });
    expect(geo.end).toEqual({ x: 300, y: 50 });
  });
});
```

> Если `RenderNode`/`edgePath` ещё не импортированы в этом тест-файле — добавить к существующим импортам сверху: `import { edgePath } from "./geometry";` и `import type { RenderNode } from "./types";` (проверь, что нет дублей).

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/components/canvas-render/geometry.test.ts`
Expected: FAIL — `edgeSegment is not a function` (или ошибка импорта).

- [ ] **Step 3: Реализовать `edgeSegment` + рефактор `edgePath`**

В `src/components/canvas-render/geometry.ts` заменить функцию `edgePath` (строки ~69-83) на:

```ts
/**
 * Геометрические точки отрезка ребра (без SVG-форматирования). Если сторона
 * задана — точка на ней; иначе — пересечение границы бокса с лучом к центру
 * другого узла. Делится между рендером (edgePath) и хит-тестом (hitTestEdge).
 */
export function edgeSegment(
  from: RenderNode,
  to: RenderNode,
  fromSide: Side | undefined,
  toSide: Side | undefined,
): { start: Point; end: Point } {
  const start = fromSide ? sidePoint(from, fromSide) : boxBorderIntersection(from, center(to));
  const end = toSide ? sidePoint(to, toSide) : boxBorderIntersection(to, center(from));
  return { start, end };
}

/**
 * Геометрия ребра между двумя узлами для SVG: путь `d`, середина (label) и конец.
 */
export function edgePath(
  from: RenderNode,
  to: RenderNode,
  fromSide: Side | undefined,
  toSide: Side | undefined,
): EdgeGeometry {
  const { start, end } = edgeSegment(from, to, fromSide, toSide);
  const d = `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`;
  return {
    d,
    mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    end,
  };
}
```

- [ ] **Step 4: Экспортировать `edgeSegment`**

В `src/components/canvas-render/index.ts` добавить `edgeSegment` к блоку `export { ... } from "./geometry";`:

```ts
export {
  boundingBox,
  sidePoint,
  edgePath,
  edgeSegment,
  center,
  boxBorderIntersection,
} from "./geometry";
```

- [ ] **Step 5: Запустить тесты — убедиться, что проходят**

Run: `pnpm exec vitest run src/components/canvas-render/geometry.test.ts`
Expected: PASS (включая прежние тесты `edgePath`).

- [ ] **Step 6: Коммит**

```bash
git add src/components/canvas-render/geometry.ts src/components/canvas-render/geometry.test.ts src/components/canvas-render/index.ts
git commit -m "refactor(canvas-render): чистый edgeSegment, edgePath поверх него

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Чистый модуль хит-теста

**Files:**
- Create: `src/features/canvas/editor/hit-test.ts`
- Test: `src/features/canvas/editor/hit-test.test.ts`
- Modify: `src/features/canvas/editor/geometry-editor.ts` (вынести `PORT_OFFSET`)
- Modify: `src/features/canvas/editor/index.ts` (экспорты)

**Interfaces:**
- Consumes: `edgeSegment` (Task 1); `handleAtPoint`, `portPoint`, `hitTestNode`, `PORT_OFFSET` из `./geometry-editor`; `ResizeHandle`, `Side` из `./editor-types`; `Point`, `RenderNode`, `RenderEdge` из `@/components/canvas-render`.
- Produces:
  - `export const PORT_OFFSET = 14` (из `geometry-editor.ts`).
  - `type HitResult = { kind: "resize-handle"; nodeId: string; handle: ResizeHandle } | { kind: "port"; nodeId: string; side: Side } | { kind: "node"; nodeId: string } | { kind: "edge"; edgeId: string } | { kind: "background" }`.
  - `interface HitTestInput { nodes: RenderNode[]; edges: RenderEdge[]; nodesById: Map<string, RenderNode>; singleSelectedNodeId: string | null }`.
  - `hitTest(p: Point, input: HitTestInput): HitResult`.
  - `hitTestEdge(p, edges, nodesById, tol): string | null`; `portAtPoint(p, n, offset, tol): Side | null`.
  - Константы `RESIZE_HANDLE_HIT`, `PORT_HIT`, `EDGE_HIT` (= 6 мировых единиц).

- [ ] **Step 1: Вынести `PORT_OFFSET` в `geometry-editor.ts`**

В `src/features/canvas/editor/geometry-editor.ts` добавить рядом с `MIN_SIZE` (после строки `const MIN_SIZE = 20;`):

```ts
/** Вынос порта ребра наружу узла, чтобы он не накладывался на среднюю ручку
 *  ресайза (та же точка). Делится между отрисовкой портов и их хит-тестом. */
export const PORT_OFFSET = 14;
```

- [ ] **Step 2: Написать падающий тест хит-теста**

Создать `src/features/canvas/editor/hit-test.test.ts`:

```ts
// src/features/canvas/editor/hit-test.test.ts
import { describe, it, expect } from "vitest";

import type { RenderNode, RenderEdge } from "@/components/canvas-render";

import { PORT_OFFSET } from "./geometry-editor";
import { hitTest, hitTestEdge, portAtPoint, PORT_HIT, EDGE_HIT } from "./hit-test";

const node = (id: string, x: number, y: number): RenderNode => ({
  id, type: "shape", x, y, width: 100, height: 60, shapeKind: "rect",
});

const a = node("a", 0, 0);   // тело 0..100 × 0..60; центр (50,30)
const b = node("b", 300, 0);
const nodesById = new Map<string, RenderNode>([["a", a], ["b", b]]);
const nodes = [a, b];
const edges: RenderEdge[] = [{ id: "e1", fromNode: "a", toNode: "b", fromSide: "right", toSide: "left" }];
const base = { nodes, edges, nodesById };

describe("hitTestEdge", () => {
  it("точка у линии ребра → id ребра", () => {
    // ребро (100,30)→(300,30); точка (200,31) в пределах допуска
    expect(hitTestEdge({ x: 200, y: 31 }, edges, nodesById, EDGE_HIT)).toBe("e1");
  });
  it("точка вдали от ребра → null", () => {
    expect(hitTestEdge({ x: 200, y: 100 }, edges, nodesById, EDGE_HIT)).toBeNull();
  });
  it("ребро с отсутствующим узлом пропускается", () => {
    const bad: RenderEdge[] = [{ id: "x", fromNode: "a", toNode: "missing" }];
    expect(hitTestEdge({ x: 200, y: 30 }, bad, nodesById, EDGE_HIT)).toBeNull();
  });
});

describe("portAtPoint", () => {
  it("точка у порта стороны → сторона", () => {
    // правая середина (100,30); порт вынесен на (114,30)
    expect(portAtPoint({ x: 114, y: 30 }, a, PORT_OFFSET, PORT_HIT)).toBe("right");
  });
  it("точка вдали от портов → null", () => {
    expect(portAtPoint({ x: 50, y: 30 }, a, PORT_OFFSET, PORT_HIT)).toBeNull();
  });
});

describe("hitTest приоритет", () => {
  it("ручка ресайза побеждает тело узла (одиночное выделение)", () => {
    expect(hitTest({ x: 0, y: 0 }, { ...base, singleSelectedNodeId: "a" }))
      .toEqual({ kind: "resize-handle", nodeId: "a", handle: "nw" });
  });
  it("порт побеждает фон (одиночное выделение)", () => {
    expect(hitTest({ x: 114, y: 30 }, { ...base, singleSelectedNodeId: "a" }))
      .toEqual({ kind: "port", nodeId: "a", side: "right" });
  });
  it("без одиночного выделения ручки/порты не активны → узел", () => {
    expect(hitTest({ x: 0, y: 0 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "node", nodeId: "a" });
  });
  it("точка в теле узла → node", () => {
    expect(hitTest({ x: 50, y: 30 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "node", nodeId: "a" });
  });
  it("точка на ребре вне узлов → edge", () => {
    expect(hitTest({ x: 200, y: 30 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "edge", edgeId: "e1" });
  });
  it("пустое место → background", () => {
    expect(hitTest({ x: 200, y: 200 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "background" });
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/canvas/editor/hit-test.test.ts`
Expected: FAIL — модуль `./hit-test` не найден.

- [ ] **Step 4: Реализовать `hit-test.ts`**

Создать `src/features/canvas/editor/hit-test.ts`:

```ts
// src/features/canvas/editor/hit-test.ts
// Чистый хит-тест сцены редактора: что под мировой точкой p. Без React/DOM —
// заменяет браузерный поэлементный hit-test (DOM-делегирование) для движок-
// нейтрального ввода. Точка p — в мировых координатах (после screenToWorld).
import { edgeSegment } from "@/components/canvas-render";
import type { Point, RenderEdge, RenderNode, Side } from "@/components/canvas-render";

import type { ResizeHandle } from "./editor-types";
import { handleAtPoint, hitTestNode, PORT_OFFSET, portPoint } from "./geometry-editor";

/** Допуски попадания в мировых единицах (SVG-хит-зоны живут внутри viewBox). */
export const RESIZE_HANDLE_HIT = 6;
export const PORT_HIT = 6;
export const EDGE_HIT = 6;

/** Что находится под точкой. Приоритет — порядок вариантов сверху вниз. */
export type HitResult =
  | { kind: "resize-handle"; nodeId: string; handle: ResizeHandle }
  | { kind: "port"; nodeId: string; side: Side }
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "background" };

/** Вход хит-теста — подмножество состояния редактора (движок-нейтрально). */
export interface HitTestInput {
  nodes: RenderNode[];
  edges: RenderEdge[];
  nodesById: Map<string, RenderNode>;
  /** id единственного выделенного узла — только тогда активны ручки/порты. */
  singleSelectedNodeId: string | null;
}

/** Дистанция от точки p до отрезка [a,b]. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Верхнее ребро под точкой в радиусе tol, либо null. */
export function hitTestEdge(
  p: Point,
  edges: RenderEdge[],
  nodesById: Map<string, RenderNode>,
  tol: number,
): string | null {
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    if (!e) continue;
    const from = nodesById.get(e.fromNode);
    const to = nodesById.get(e.toNode);
    if (!from || !to) continue;
    const { start, end } = edgeSegment(from, to, e.fromSide, e.toSide);
    if (distToSegment(p, start, end) <= tol) return e.id;
  }
  return null;
}

/** Сторона-порт узла под точкой в радиусе tol, либо null. */
export function portAtPoint(p: Point, n: RenderNode, offset: number, tol: number): Side | null {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  let best: Side | null = null;
  let bestDist = tol;
  for (const side of sides) {
    const pt = portPoint(n, side, offset);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d <= bestDist) {
      bestDist = d;
      best = side;
    }
  }
  return best;
}

/**
 * Что под мировой точкой p. Приоритет: ручка ресайза → порт → узел (верхний) →
 * ребро → фон. Ручки/порты активны только при одиночном выделении узла (зеркалит
 * рендер: оверлеи рисуются лишь для одиночного выделения).
 */
export function hitTest(p: Point, input: HitTestInput): HitResult {
  const { nodes, edges, nodesById, singleSelectedNodeId } = input;
  if (singleSelectedNodeId) {
    const sel = nodesById.get(singleSelectedNodeId);
    if (sel) {
      const handle = handleAtPoint(p, sel, RESIZE_HANDLE_HIT);
      if (handle) return { kind: "resize-handle", nodeId: sel.id, handle };
      const side = portAtPoint(p, sel, PORT_OFFSET, PORT_HIT);
      if (side) return { kind: "port", nodeId: sel.id, side };
    }
  }
  const node = hitTestNode(p, nodes);
  if (node) return { kind: "node", nodeId: node.id };
  const edgeId = hitTestEdge(p, edges, nodesById, EDGE_HIT);
  if (edgeId) return { kind: "edge", edgeId };
  return { kind: "background" };
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/canvas/editor/hit-test.test.ts`
Expected: PASS (все 9 тестов).

- [ ] **Step 6: Экспортировать из `editor/index.ts`**

В `src/features/canvas/editor/index.ts`:

1. В блок `export { pointInRect, hitTestNode, resizeHandles, handleAtPoint, applyResize, marqueeHits, portPoint } from "./geometry-editor";` добавить `PORT_OFFSET`.
2. После строки `export type { Rect } from "./geometry-editor";` добавить:

```ts
export { hitTest, hitTestEdge, portAtPoint, RESIZE_HANDLE_HIT, PORT_HIT, EDGE_HIT } from "./hit-test";
export type { HitResult, HitTestInput } from "./hit-test";
```

- [ ] **Step 7: Прогнать весь набор тестов канваса (регрессия чистого ядра)**

Run: `pnpm exec vitest run src/features/canvas`
Expected: PASS (новые + существующие).

- [ ] **Step 8: Коммит**

```bash
git add src/features/canvas/editor/hit-test.ts src/features/canvas/editor/hit-test.test.ts src/features/canvas/editor/geometry-editor.ts src/features/canvas/editor/index.ts
git commit -m "feat(canvas): чистый JS hit-test сцены редактора + PORT_OFFSET

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Контракт движка (`engine/painter.ts`)

**Files:**
- Create: `src/features/canvas/engine/painter.ts`

**Interfaces:**
- Consumes: `EntityRefResolver`, `Point`, `RenderData` из `@/components/canvas-render`; `Rect`, `Viewport` из `../editor`.
- Produces: типы `SurfaceSize`, `Scene`, `CanvasPainter`.

- [ ] **Step 1: Создать файл контракта**

Создать `src/features/canvas/engine/painter.ts`:

```ts
// src/features/canvas/engine/painter.ts
// Контракт движка рендеринга редактора. Реализация прячет ВСЮ специфику бэкенда
// отрисовки (SVG / canvas / …). Редактор знает только эти типы.
import type { ComponentType } from "react";

import type { EntityRefResolver, Point, RenderData } from "@/components/canvas-render";

import type { Rect, Viewport } from "../editor";

/** Пиксельные размеры поверхности (из ResizeObserver редактора). */
export interface SurfaceSize {
  width: number;
  height: number;
}

/**
 * Снапшот того, что нужно нарисовать: граф + вьюпорт + аффордансы взаимодействия.
 * Редактор собирает Scene из своего состояния и отдаёт painter'у. Painter НЕ несёт
 * бизнес-логики/коллбэков — он чистый «рисователь».
 */
export interface Scene {
  data: RenderData;
  viewport: Viewport;
  resolveEntityRef: EntityRefResolver;
  /** Выделенные узлы/рёбра. */
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  /** id единственного выделенного узла → ручки ресайза + порты. */
  handlesForNodeId: string | null;
  /** Узел-кандидат под курсором при протягивании ребра (подсветка цели). */
  edgeTargetId: string | null;
  /** Узел с ошибкой валидации (красная рамка). */
  invalidNodeId: string | null;
  /** Превью создаваемого ребра (мировые точки). */
  edgeDraft: { from: Point; to: Point } | null;
  /** Marquee-рамка (мировые координаты). */
  marquee: Rect | null;
}

/**
 * Контракт движка рендеринга редактора. Смена движка = новая реализация + одна
 * перепривязка в engine/index.ts.
 */
export interface CanvasPainter {
  /** Визуальная поверхность. Рисует картинку; pointer-events:none (ввод — у редактора). */
  Surface: ComponentType<{ scene: Scene; size: SurfaceSize }>;
  /** Экспорт чистого графа (без chrome редактора) в .svg. */
  exportSvg(data: RenderData, resolve: EntityRefResolver, title: string, rootEl: Element): void;
  /** Экспорт чистого графа в .png. */
  exportPng(data: RenderData, resolve: EntityRefResolver, title: string, rootEl: Element): Promise<void>;
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS — без ошибок (новый файл компилируется; потребителей пока нет).

- [ ] **Step 3: Коммит**

```bash
git add src/features/canvas/engine/painter.ts
git commit -m "feat(canvas): контракт движка CanvasPainter + тип Scene

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SVG-слои презентации

**Files:**
- Create: `src/features/canvas/engine/svg/svg-edges.tsx`
- Create: `src/features/canvas/engine/svg/svg-nodes.tsx`
- Create: `src/features/canvas/engine/svg/svg-overlays.tsx`

**Interfaces:**
- Consumes: `edgePath`, `NodeShapeRender` из `@/components/canvas-render`; `portPoint`, `resizeHandles`, `PORT_OFFSET`, `ResizeHandle` из `../../editor`.
- Produces: компоненты `SvgEdges`, `SvgNodes`, `SvgOverlays` (см. пропсы ниже). Без коллбэков — чисто визуальные.

> Эти компоненты не покрываются юнит-тестами (презентация, конвенция). Деливерабл — компилируются и используются painter'ом в Task 6 (там smoke-тест). Проверка тут — `pnpm typecheck`.

- [ ] **Step 1: `svg-edges.tsx`**

Создать `src/features/canvas/engine/svg/svg-edges.tsx`:

```tsx
"use client";
// src/features/canvas/engine/svg/svg-edges.tsx
import { edgePath } from "@/components/canvas-render";
import type { Point, RenderEdge, RenderNode } from "@/components/canvas-render";

interface Props {
  edges: RenderEdge[];
  nodesById: Map<string, RenderNode>;
  selectedEdgeIds: ReadonlySet<string>;
  /** Превью создаваемого ребра (мировые точки). */
  edgeDraft: { from: Point; to: Point } | null;
}

/**
 * SVG-слой рёбер: видимые пути + стрелки + подписи + превью. Без хит-зон —
 * попадание считает JS hit-test редактора. Весь слой не перехватывает указатель
 * (pointer-events:none на корневом svg painter'а).
 */
export function SvgEdges({ edges, nodesById, selectedEdgeIds, edgeDraft }: Props) {
  return (
    <g data-layer="edges">
      {edges.map((e) => {
        const from = nodesById.get(e.fromNode);
        const to = nodesById.get(e.toNode);
        if (!from || !to) return null;
        const geo = edgePath(from, to, e.fromSide, e.toSide);
        const selected = selectedEdgeIds.has(e.id);
        const arrow = (e.end ?? "arrow") === "arrow";
        return (
          <g key={e.id}>
            <path
              d={geo.d}
              fill="none"
              stroke={selected ? "var(--color-accent)" : "var(--color-fg-muted)"}
              strokeWidth={selected ? 2.5 : 1.5}
              strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
              markerEnd={arrow ? (selected ? "url(#cv-arrow-selected)" : "url(#cv-arrow)") : undefined}
            />
            {e.label && (
              <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-fg-muted)">
                {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
              </text>
            )}
          </g>
        );
      })}
      {edgeDraft && (
        <path
          d={`M ${edgeDraft.from.x} ${edgeDraft.from.y} L ${edgeDraft.to.x} ${edgeDraft.to.y}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}
    </g>
  );
}
```

- [ ] **Step 2: `svg-nodes.tsx`**

Создать `src/features/canvas/engine/svg/svg-nodes.tsx`:

```tsx
"use client";
// src/features/canvas/engine/svg/svg-nodes.tsx
import { NodeShapeRender } from "@/components/canvas-render";
import type { EntityRefResolver, RenderNode } from "@/components/canvas-render";

interface Props {
  nodes: RenderNode[];
  resolveEntityRef: EntityRefResolver;
}

/** SVG-слой узлов: та же презентация NodeShapeRender, что в read-only рендере. */
export function SvgNodes({ nodes, resolveEntityRef }: Props) {
  return (
    <g data-layer="nodes">
      {nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </g>
  );
}
```

- [ ] **Step 3: `svg-overlays.tsx`**

Создать `src/features/canvas/engine/svg/svg-overlays.tsx`:

```tsx
"use client";
// src/features/canvas/engine/svg/svg-overlays.tsx
import type { RenderNode, Side } from "@/components/canvas-render";

import { PORT_OFFSET, portPoint, resizeHandles } from "../../editor";
import type { ResizeHandle } from "../../editor";

const SIDES: Side[] = ["top", "right", "bottom", "left"];

interface Props {
  nodes: RenderNode[];
  selectedNodeIds: ReadonlySet<string>;
  invalidNodeId: string | null;
  edgeTargetId: string | null;
  handlesForNodeId: string | null;
}

/**
 * Служебные оверлеи редактора: подсветка цели ребра, рамки выделения/ошибки,
 * 8 ручек ресайза и 4 порта на одиночном выделении. Чисто визуальны (указатель
 * не перехватывают — pointer-events:none на корневом svg painter'а).
 */
export function SvgOverlays({ nodes, selectedNodeIds, invalidNodeId, edgeTargetId, handlesForNodeId }: Props) {
  const single = handlesForNodeId ? nodes.find((n) => n.id === handlesForNodeId) ?? null : null;
  return (
    <g data-layer="overlays">
      {nodes.map((n) => {
        const selected = selectedNodeIds.has(n.id);
        const invalid = n.id === invalidNodeId;
        const isEdgeTarget = n.id === edgeTargetId;
        return (
          <g key={n.id}>
            {isEdgeTarget && (
              <rect
                x={n.x - 3} y={n.y - 3} width={n.width + 6} height={n.height + 6}
                rx={4}
                fill="var(--color-accent)" fillOpacity={0.12}
                stroke="var(--color-accent)" strokeWidth={2.5}
              />
            )}
            {(selected || invalid) && (
              <rect
                x={n.x - 2} y={n.y - 2} width={n.width + 4} height={n.height + 4}
                fill="none"
                stroke={invalid ? "var(--color-danger)" : "var(--color-accent)"}
                strokeWidth={1.5}
                strokeDasharray={invalid ? "4 2" : undefined}
              />
            )}
          </g>
        );
      })}

      {single && SIDES.map((side) => {
        const p = portPoint(single, side, PORT_OFFSET);
        return (
          <circle
            key={`side-${side}`}
            cx={p.x} cy={p.y} r={5}
            fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={1.5}
          />
        );
      })}

      {single && (Object.entries(resizeHandles(single)) as [ResizeHandle, { x: number; y: number }][]).map(([handle, p]) => (
        <rect
          key={`rh-${handle}`}
          x={p.x - 4} y={p.y - 4} width={8} height={8}
          fill="var(--color-accent)"
        />
      ))}
    </g>
  );
}
```

- [ ] **Step 4: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/canvas/engine/svg/svg-edges.tsx src/features/canvas/engine/svg/svg-nodes.tsx src/features/canvas/engine/svg/svg-overlays.tsx
git commit -m "feat(canvas): SVG-слои презентации (edges/nodes/overlays) без коллбэков

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Переезд экспорта в `engine/svg/svg-export.tsx`

**Files:**
- Create: `src/features/canvas/engine/svg/svg-export.tsx`
- Create: `src/features/canvas/engine/svg/svg-export.test.tsx`
- Modify: `src/features/canvas/ui/canvas-export.tsx` (превратить в шим-реэкспорт)
- Delete: `src/features/canvas/ui/canvas-export.test.tsx`

**Interfaces:**
- Produces: `buildExportSvg`, `downloadCanvasSvg`, `downloadCanvasPng`, тип `ExportSvg` из `engine/svg/svg-export`.
- Старый `ui/canvas-export.tsx` остаётся как шим (реэкспорт) до Task 7, чтобы `canvas-editor.tsx` не сломался.

- [ ] **Step 1: Создать `svg-export.tsx` (копия логики)**

Создать `src/features/canvas/engine/svg/svg-export.tsx` с ПОЛНЫМ содержимым текущего `src/features/canvas/ui/canvas-export.tsx` (логика идентична; импорты `@/components/canvas-render` — абсолютные, остаются). Обновить только комментарий-путь в первой строке:

```tsx
"use client";
// src/features/canvas/engine/svg/svg-export.tsx
import { renderToStaticMarkup } from "react-dom/server";

import { boundingBox, edgePath, NodeShapeRender } from "@/components/canvas-render";
import type { EntityRefResolver, RenderData, RenderNode } from "@/components/canvas-render";

const MARGIN = 24;

function CanvasExportSvg({ data, resolveEntityRef }: { data: RenderData; resolveEntityRef: EntityRefResolver }) {
  const bbox = boundingBox(data.nodes);
  const vbX = bbox.minX - MARGIN;
  const vbY = bbox.minY - MARGIN;
  const vbW = bbox.maxX - bbox.minX + MARGIN * 2;
  const vbH = bbox.maxY - bbox.minY + MARGIN * 2;
  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} width={vbW} height={vbH}>
      <defs>
        <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-muted)" />
        </marker>
      </defs>
      <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="var(--color-surface)" />
      {data.edges.map((e) => {
        const from = byId.get(e.fromNode);
        const to = byId.get(e.toNode);
        if (!from || !to) return null;
        const geo = edgePath(from, to, e.fromSide, e.toSide);
        const arrow = (e.end ?? "arrow") === "arrow";
        return (
          <g key={e.id}>
            <path
              d={geo.d}
              fill="none"
              stroke="var(--color-fg-muted)"
              strokeWidth={1.5}
              strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
              markerEnd={arrow ? "url(#cv-arrow)" : undefined}
            />
            {e.label && (
              <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-fg-muted)">
                {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
              </text>
            )}
          </g>
        );
      })}
      {data.nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </svg>
  );
}

const COLOR_VAR_RE = /var\((--color-[a-z0-9-]+)\)/g;

/** Заменяет var(--color-*) на вычисленные значения темы из cascade rootEl. */
function inlineThemeColors(svg: string, rootEl: Element): string {
  const cs = getComputedStyle(rootEl);
  const cache = new Map<string, string>();
  return svg.replace(COLOR_VAR_RE, (_m, token: string) => {
    let v = cache.get(token);
    if (v === undefined) {
      v = cs.getPropertyValue(token).trim() || "#000";
      cache.set(token, v);
    }
    return v;
  });
}

export interface ExportSvg {
  svg: string;
  width: number;
  height: number;
}

/** Строит самодостаточный SVG графа (цвета темы вшиты) + его пиксельные размеры. */
export function buildExportSvg(data: RenderData, resolveEntityRef: EntityRefResolver, rootEl: Element): ExportSvg {
  const bbox = boundingBox(data.nodes);
  const width = bbox.maxX - bbox.minX + MARGIN * 2;
  const height = bbox.maxY - bbox.minY + MARGIN * 2;
  const raw = renderToStaticMarkup(<CanvasExportSvg data={data} resolveEntityRef={resolveEntityRef} />);
  return { svg: inlineThemeColors(raw, rootEl), width, height };
}

/** Скачивает Blob под заданным именем (общий клиентский download-хелпер). */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Безопасное имя файла из названия канваса (фолбэк «canvas»). */
function safeName(title: string): string {
  const base = title.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, "").replace(/\s+/g, "-");
  return base || "canvas";
}

/** Скачивает граф как .svg. */
export function downloadCanvasSvg(data: RenderData, resolveEntityRef: EntityRefResolver, title: string, rootEl: Element): void {
  const { svg } = buildExportSvg(data, resolveEntityRef, rootEl);
  triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${safeName(title)}.svg`);
}

/**
 * Скачивает граф как .png — растеризация того же self-contained SVG на <canvas>
 * (Image → drawImage → toBlob). scale=2 для чёткости. Blob-URL (не data-URL) →
 * canvas не tainted, toBlob работает.
 */
export async function downloadCanvasPng(
  data: RenderData,
  resolveEntityRef: EntityRefResolver,
  title: string,
  rootEl: Element,
  scale = 2,
): Promise<void> {
  const { svg, width, height } = buildExportSvg(data, resolveEntityRef, rootEl);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => { resolve(); };
      img.onerror = () => { reject(new Error("svg image load failed")); };
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    await new Promise<void>((resolve) => {
      canvas.toBlob((png) => {
        if (png) triggerDownload(png, `${safeName(title)}.png`);
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Перенести тест на новый путь**

Создать `src/features/canvas/engine/svg/svg-export.test.tsx` (копия `ui/canvas-export.test.tsx`, импорт указывает на `./svg-export`):

```tsx
// src/features/canvas/engine/svg/svg-export.test.tsx
import { describe, it, expect } from "vitest";

import type { EntityRefResolver, RenderData } from "@/components/canvas-render";

import { buildExportSvg } from "./svg-export";

const resolve: EntityRefResolver = (type) => ({ href: null, typeLabel: type });

const data: RenderData = {
  nodes: [
    { id: "t", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" },
    { id: "s", type: "shape", x: 200, y: 0, width: 80, height: 80, shapeKind: "rect" },
  ],
  edges: [{ id: "e", fromNode: "t", toNode: "s" }],
};

describe("buildExportSvg", () => {
  it("строит самодостаточный SVG: текст узла отрендерен переиспользуемым рендером", () => {
    const { svg } = buildExportSvg(data, resolve, document.documentElement);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Привет");
  });

  it("вшивает цвета темы: в строке не остаётся var(--color-*)", () => {
    const { svg } = buildExportSvg(data, resolve, document.documentElement);
    expect(svg).not.toMatch(/var\(--color-/);
  });

  it("размер = bounding box графа + поля с обеих сторон", () => {
    const { width, height } = buildExportSvg(data, resolve, document.documentElement);
    expect(width).toBe(280 + 48);
    expect(height).toBe(80 + 48);
  });
});
```

- [ ] **Step 3: Удалить старый тест**

```bash
git rm src/features/canvas/ui/canvas-export.test.tsx
```

- [ ] **Step 4: Превратить `ui/canvas-export.tsx` в шим**

Заменить ВСЁ содержимое `src/features/canvas/ui/canvas-export.tsx` на реэкспорт (временный мост, удалим в Task 8):

```tsx
"use client";
// src/features/canvas/ui/canvas-export.tsx
// ВРЕМЕННЫЙ ШИМ: реальная реализация переехала в engine/svg/svg-export.
// Удаляется в финальной задаче после перевода canvas-editor на painter.
export { buildExportSvg, downloadCanvasSvg, downloadCanvasPng } from "../engine/svg/svg-export";
export type { ExportSvg } from "../engine/svg/svg-export";
```

- [ ] **Step 5: Прогнать тесты экспорта + типы**

Run: `pnpm exec vitest run src/features/canvas/engine/svg/svg-export.test.tsx`
Expected: PASS (3 теста).

Run: `pnpm typecheck`
Expected: PASS (старый редактор импортирует из шима — мост жив).

- [ ] **Step 6: Коммит**

```bash
git add src/features/canvas/engine/svg/svg-export.tsx src/features/canvas/engine/svg/svg-export.test.tsx src/features/canvas/ui/canvas-export.tsx src/features/canvas/ui/canvas-export.test.tsx
git commit -m "refactor(canvas): экспорт графа переехал в engine/svg (ui — шим)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: SVG-painter (Surface) + активный движок

**Files:**
- Create: `src/features/canvas/engine/svg/svg-painter.tsx`
- Create: `src/features/canvas/engine/svg/svg-painter.test.tsx`
- Create: `src/features/canvas/engine/index.ts`

**Interfaces:**
- Consumes: `Scene`, `SurfaceSize`, `CanvasPainter` из `../painter`; `SvgEdges`/`SvgNodes`/`SvgOverlays` (Task 4); `downloadCanvasSvg`/`downloadCanvasPng` из `./svg-export` (Task 5); `RenderNode` из `@/components/canvas-render`.
- Produces: `export const svgPainter: CanvasPainter`; `engine/index.ts` → `export const painter: CanvasPainter = svgPainter` + ре-экспорт `Scene`, `SurfaceSize`, `CanvasPainter`, `svgPainter`.

- [ ] **Step 1: `svg-painter.tsx`**

Создать `src/features/canvas/engine/svg/svg-painter.tsx`:

```tsx
"use client";
// src/features/canvas/engine/svg/svg-painter.tsx
import { useMemo } from "react";

import type { RenderNode } from "@/components/canvas-render";

import type { CanvasPainter, Scene, SurfaceSize } from "../painter";
import { downloadCanvasPng, downloadCanvasSvg } from "./svg-export";
import { SvgEdges } from "./svg-edges";
import { SvgNodes } from "./svg-nodes";
import { SvgOverlays } from "./svg-overlays";

/** SVG-поверхность: viewBox по вьюпорту, defs-маркеры, слои, marquee. Указатель
 *  не перехватывает (pointer-events:none) — ввод владеет редактор. */
function SvgSurface({ scene, size }: { scene: Scene; size: SurfaceSize }) {
  const vp = scene.viewport;
  const viewBox = `${vp.x} ${vp.y} ${size.width / vp.zoom} ${size.height / vp.zoom}`;
  const nodesById = useMemo(
    () => new Map<string, RenderNode>(scene.data.nodes.map((n) => [n.id, n])),
    [scene.data.nodes],
  );
  return (
    <svg
      width="100%" height="100%"
      viewBox={viewBox}
      style={{ pointerEvents: "none", background: "var(--color-surface)", display: "block" }}
    >
      <defs>
        {/* markerUnits=userSpaceOnUse: размер стрелки не зависит от strokeWidth.
            Два маркера = два цвета: стрелка перекрашивается под цвет своего ребра. */}
        <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-muted)" />
        </marker>
        <marker id="cv-arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
        </marker>
      </defs>

      <SvgEdges
        edges={scene.data.edges}
        nodesById={nodesById}
        selectedEdgeIds={scene.selectedEdgeIds}
        edgeDraft={scene.edgeDraft}
      />
      <SvgNodes nodes={scene.data.nodes} resolveEntityRef={scene.resolveEntityRef} />
      <SvgOverlays
        nodes={scene.data.nodes}
        selectedNodeIds={scene.selectedNodeIds}
        invalidNodeId={scene.invalidNodeId}
        edgeTargetId={scene.edgeTargetId}
        handlesForNodeId={scene.handlesForNodeId}
      />

      {scene.marquee && (
        <rect
          x={scene.marquee.x} y={scene.marquee.y} width={scene.marquee.width} height={scene.marquee.height}
          fill="var(--color-accent)" fillOpacity={0.1}
          stroke="var(--color-accent)" strokeDasharray="4 2"
        />
      )}
    </svg>
  );
}

/** SVG-реализация движка рендеринга редактора (единственная сегодня). */
export const svgPainter: CanvasPainter = {
  Surface: SvgSurface,
  exportSvg: downloadCanvasSvg,
  exportPng: downloadCanvasPng,
};
```

- [ ] **Step 2: Написать smoke-тест**

Создать `src/features/canvas/engine/svg/svg-painter.test.tsx`:

```tsx
// src/features/canvas/engine/svg/svg-painter.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import type { Scene } from "../painter";
import { svgPainter } from "./svg-painter";

const scene: Scene = {
  data: {
    nodes: [{ id: "n", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" }],
    edges: [],
  },
  viewport: { x: 0, y: 0, zoom: 1 },
  resolveEntityRef: (t) => ({ href: null, typeLabel: t }),
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  handlesForNodeId: null,
  edgeTargetId: null,
  invalidNodeId: null,
  edgeDraft: null,
  marquee: null,
};

describe("svgPainter.Surface", () => {
  it("рендерит сцену в SVG с текстом узла", () => {
    const Surface = svgPainter.Surface;
    const html = renderToStaticMarkup(<Surface scene={scene} size={{ width: 800, height: 600 }} />);
    expect(html).toContain("<svg");
    expect(html).toContain("Привет");
  });

  it("ставит pointer-events:none на корневой svg", () => {
    const Surface = svgPainter.Surface;
    const html = renderToStaticMarkup(<Surface scene={scene} size={{ width: 800, height: 600 }} />);
    expect(html).toMatch(/pointer-events:\s*none/);
  });
});
```

- [ ] **Step 3: Запустить smoke-тест**

Run: `pnpm exec vitest run src/features/canvas/engine/svg/svg-painter.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 4: `engine/index.ts` — активный движок**

Создать `src/features/canvas/engine/index.ts`:

```ts
// src/features/canvas/engine/index.ts
import type { CanvasPainter } from "./painter";
import { svgPainter } from "./svg/svg-painter";

export type { Scene, SurfaceSize, CanvasPainter } from "./painter";
export { svgPainter } from "./svg/svg-painter";

/**
 * Активный движок рендеринга редактора. Смена движка (SVG → canvas → …) =
 * заменить эту привязку на другую реализацию CanvasPainter.
 */
export const painter: CanvasPainter = svgPainter;
```

- [ ] **Step 5: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/features/canvas/engine/svg/svg-painter.tsx src/features/canvas/engine/svg/svg-painter.test.tsx src/features/canvas/engine/index.ts
git commit -m "feat(canvas): SVG-painter (Surface) + активный движок engine/index

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Перевод `canvas-editor.tsx` на painter-шов

**Files:**
- Modify: `src/features/canvas/ui/canvas-editor.tsx`

**Interfaces:**
- Consumes: `painter`, `Scene` из `../engine`; `hitTest` из `../editor` (+ уже импортируемые `hitTestNode`, `resolveBackgroundGesture`, `resolveNodeGesture`, `marqueeHits`, …).
- Удаляет использование: `EditorEdgeLayer`, `EditorNodeLayer`, `downloadCanvasSvg`/`downloadCanvasPng` из `./canvas-export`, локальный `viewBox`, `svgRef`.

> Деливерабл — `pnpm typecheck && pnpm build` зелёные. Юнит-тестов у редактора нет (конвенция) → поведение проверяется ручным браузер-QA (чеклист в конце задачи).

- [ ] **Step 1: Обновить импорты**

В `src/features/canvas/ui/canvas-editor.tsx`:

Удалить строки:
```tsx
import { downloadCanvasSvg, downloadCanvasPng } from "./canvas-export";
import { EditorEdgeLayer } from "./editor-edge-layer";
import { EditorNodeLayer } from "./editor-node-layer";
```

В импорт из `"../editor"` добавить `hitTest`:
```tsx
import {
  canvasReducer, initEditorState, canvasDataToRenderData,
  screenToWorld, applyZoomAtPoint, snapPoint, validateGraph, hitTestNode, hitTest, marqueeHits, newId,
  resolveBackgroundGesture, resolveNodeGesture, resolveWheel, resolveNudge,
} from "../editor";
```

После строки `import type { Canvas, CanvasRefEntityType, Visibility } from "../types";` добавить:
```tsx
import { painter } from "../engine";
import type { Scene } from "../engine";
```

- [ ] **Step 2: Заменить `svgRef` на `surfaceRef`**

Строку `const svgRef = useRef<SVGSVGElement>(null);` заменить на:
```tsx
const surfaceRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Перецепить ResizeObserver, eventWorld, wheel на `surfaceRef`**

В эффекте ResizeObserver: `const el = svgRef.current;` → `const el = surfaceRef.current;`.

В `eventWorld`: `const rect = svgRef.current?.getBoundingClientRect();` → `const rect = surfaceRef.current?.getBoundingClientRect();`.

В wheel-эффекте: `const el = svgRef.current;` → `const el = surfaceRef.current;`. И внутри `onWheelRef.current`: `const rect = svgRef.current?.getBoundingClientRect();` → `const rect = surfaceRef.current?.getBoundingClientRect();`.

- [ ] **Step 4: Удалить локальный `viewBox`**

Удалить строку (painter сам считает viewBox):
```tsx
const viewBox = `${vp.x} ${vp.y} ${size.width / vp.zoom} ${size.height / vp.zoom}`;
```
Строку `const vp = state.viewport;` — ОСТАВИТЬ (используется широко).

- [ ] **Step 5: Добавить `singleSelectedNodeId`**

Сразу после `const selectedEdgeIds = useMemo(...)` добавить:
```tsx
// id единственного выделенного узла — общий источник для ручек/портов (рендер) и хит-теста.
const singleSelectedNodeId = state.selection.nodeIds.length === 1 ? (state.selection.nodeIds[0] ?? null) : null;
```

- [ ] **Step 6: Заменить пять pointer-down-хендлеров на один + dblclick**

Удалить функции `onBackgroundPointerDown`, `onNodePointerDown`, `onResizeHandleDown`, `onSideHandleDown`, `onEdgePointerDown` и `onNodeDoubleClick`. Оставить `startPan` и `sideWorld` без изменений.

Вместо удалённого `onBackgroundPointerDown` (и др.) вставить единый обработчик (после `startPan`):

```tsx
/** Единый pointerdown по поверхности: JS hit-test решает жест. */
const onSurfacePointerDown = (e: React.PointerEvent) => {
  const world = eventWorld(e);
  const hit = hitTest(world, {
    nodes: renderData.nodes,
    edges: renderData.edges,
    nodesById,
    singleSelectedNodeId,
  });
  const capture = () => { (e.currentTarget as Element).setPointerCapture(e.pointerId); };
  switch (hit.kind) {
    case "resize-handle":
      dragRef.current = { kind: "resize", nodeId: hit.nodeId, handle: hit.handle, lastWorld: world };
      capture();
      return;
    case "port":
      dragRef.current = { kind: "edge", fromNode: hit.nodeId, fromSide: hit.side, currentWorld: world };
      capture();
      return;
    case "node": {
      const gesture = resolveNodeGesture({
        tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey,
      });
      if (gesture === "pan") { startPan(e); return; }
      if (!selectedNodeIds.has(hit.nodeId)) {
        dispatch({ type: "selectNode", nodeId: hit.nodeId, additive: e.shiftKey });
      } else if (e.shiftKey) {
        dispatch({ type: "selectNode", nodeId: hit.nodeId, additive: true });
      }
      dragRef.current = { kind: "move", lastWorld: world };
      capture();
      return;
    }
    case "edge":
      dispatch({ type: "selectEdge", edgeId: hit.edgeId, additive: e.shiftKey });
      return;
    case "background": {
      const gesture = resolveBackgroundGesture({
        tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey,
      });
      if (gesture === "marquee") {
        if (!e.shiftKey) dispatch({ type: "clearSelection" });
        dragRef.current = { kind: "marquee", startWorld: world, currentWorld: world, additive: e.shiftKey };
        capture();
      } else {
        dispatch({ type: "clearSelection" });
        startPan(e);
      }
      return;
    }
  }
};

/** Двойной клик по узлу (text/shape) → инлайн-редактор текста. */
const onSurfaceDoubleClick = (e: React.MouseEvent) => {
  const world = eventWorld(e);
  const hit = hitTestNode(world, renderData.nodes);
  if (!hit) return;
  const node = (state.data.nodes ?? []).find((n) => n.id === hit.id);
  if (node && (node.type === "text" || node.type === "shape")) {
    dispatch({ type: "selectNode", nodeId: hit.id, additive: false });
    setNewNodeId(null);
    setEditingNodeId(hit.id);
  }
};
```

- [ ] **Step 7: Hover-курсор в `onPointerMove`**

Заменить начало `onPointerMove`:
```tsx
const onPointerMove = (e: React.PointerEvent) => {
  const drag = dragRef.current;
  if (!drag) return;
  const world = eventWorld(e);
```
на:
```tsx
const onPointerMove = (e: React.PointerEvent) => {
  const drag = dragRef.current;
  if (!drag) { updateHoverCursor(eventWorld(e)); return; }
  const world = eventWorld(e);
```

И добавить перед `onPointerMove` функцию hover-курсора (императивно через ref, без ре-рендера):
```tsx
/** Курсор поверхности по тому, что под указателем (без активного drag). */
const updateHoverCursor = (world: Point) => {
  const el = surfaceRef.current;
  if (!el) return;
  if (state.tool === "hand" || spaceHeld) { el.style.cursor = "grab"; return; }
  const hit = hitTest(world, { nodes: renderData.nodes, edges: renderData.edges, nodesById, singleSelectedNodeId });
  el.style.cursor =
    hit.kind === "resize-handle" ? `${hit.handle}-resize`
      : hit.kind === "port" ? "crosshair"
        : hit.kind === "node" ? "move"
          : hit.kind === "edge" ? "pointer"
            : "default";
};
```

- [ ] **Step 8: Экспорт через painter**

Заменить тела `onExportSvg`/`onExportPng`:
```tsx
const onExportSvg = () => {
  painter.exportSvg(renderData, resolveEntityRef, exportTitle, surfaceRef.current ?? document.documentElement);
};
const onExportPng = () => {
  void painter.exportPng(renderData, resolveEntityRef, exportTitle, surfaceRef.current ?? document.documentElement);
};
```

- [ ] **Step 9: Собрать `Scene` (мемо) перед `return`**

Перед строкой `const editingNode = ...` добавить:
```tsx
const scene: Scene = useMemo(() => ({
  data: renderData,
  viewport: vp,
  resolveEntityRef,
  selectedNodeIds,
  selectedEdgeIds,
  handlesForNodeId: singleSelectedNodeId,
  edgeTargetId,
  invalidNodeId: invalidNodeId ?? null,
  edgeDraft: edgePreview,
  marquee,
}), [renderData, vp, resolveEntityRef, selectedNodeIds, selectedEdgeIds, singleSelectedNodeId, edgeTargetId, invalidNodeId, edgePreview, marquee]);
```

- [ ] **Step 10: Заменить JSX холста (svg → painter)**

Найти блок от `<ContextMenu.Trigger` (с `render={...}`) до закрывающего `</ContextMenu.Trigger>` (включает `<svg ref={svgRef}>...</svg>` и `{editingNode && <EditorTextOverlay .../>}`). Структура одного div: Trigger-render `<div>` несёт роль/клавиши/контекст-меню/указатель/`ref`/курсор; `<painter.Surface>` — его дочерний элемент (svg c `pointer-events:none`, события «проваливаются» на div). Текст-оверлей — соседом. `ref={surfaceRef}` на render-элементе мёржится Base UI (он форвардит и сливает ref). Так ближе к оригиналу и НЕ добавляет новых a11y-нарушений: на Trigger уже стоят оба нужных `eslint-disable` (`no-noninteractive-element-interactions` покрывает указательные хендлеры на `role="application"`).

Заменить ВЕСЬ блок на:

```tsx
<ContextMenu.Trigger
  render={
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={surfaceRef}
      role="application"
      aria-label={t("editor.ariaLabel")}
      className="relative flex-1 select-none"
      style={{ height: "70vh", cursor: canvasCursor, touchAction: "none" }}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={onKeyDown}
      onContextMenu={onCanvasContextMenu}
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onSurfaceDoubleClick}
    />
  }
>
  <painter.Surface scene={scene} size={size} />

  {editingNode && (
    <EditorTextOverlay
      node={editingNode}
      viewport={vp}
      onCommit={(text) => {
        const id = editingNode.id;
        if (id) {
          if (id === newNodeId && text.trim() === "") {
            deleteNodeById(id);
          } else {
            dispatch({ type: "setNodeText", nodeId: id, text });
          }
        }
        setEditingNodeId(null);
        setNewNodeId(null);
      }}
      onCancel={() => {
        const id = editingNode.id;
        if (id && id === newNodeId) deleteNodeById(id);
        setEditingNodeId(null);
        setNewNodeId(null);
      }}
    />
  )}
</ContextMenu.Trigger>
```

> Примечание: большой a11y-комментарий о `role="application"` и клавиатурной модели (строки ~583-603 в исходнике) оставить как есть над блоком — он по-прежнему верен.
> Риск (см. спеку R2): если в твоей версии Base UI `ref` на render-элементе НЕ мёржится (surfaceRef.current === null в рантайме), запасной вариант — вложить `<div ref={surfaceRef} className="absolute inset-0 select-none" style={{touchAction:"none", cursor:canvasCursor}}>` со ВСЕМИ указательными хендлерами внутрь Trigger (оставив на Trigger только role/aria/tabIndex/onKeyDown/onContextMenu) и добавить на внутренний div `// eslint-disable-next-line jsx-a11y/no-static-element-interactions`.

- [ ] **Step 11: Проверить типы и сборку**

Run: `pnpm typecheck`
Expected: PASS — нет неиспользуемых импортов (`EditorEdgeLayer`/`EditorNodeLayer`/`downloadCanvasSvg`/`svgRef`/`viewBox` удалены), нет ошибок типов.

Run: `pnpm lint`
Expected: PASS — нет `no-unused-vars`/иных ошибок в `canvas-editor.tsx`.

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 12: Коммит**

```bash
git add src/features/canvas/ui/canvas-editor.tsx
git commit -m "refactor(canvas): редактор на painter-шов (div-поверхность + JS hit-test)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 13: Ручной браузер-QA (гейт редактора)**

Запустить dev (`pnpm dev`, фронт :3001), открыть `/canvases/new` и существующий `/canvases/{id}/edit`. Проверить (это замена отсутствующих юнит-тестов):

- [ ] Выделение узла кликом; shift-клик — добавление к выделению.
- [ ] Перетаскивание узла (move) — курсор «move» над узлом.
- [ ] Ресайз: 8 ручек у одиночного выделения, курсоры `nwse`/`ns`/`ew`, минимальный размер не схлопывается.
- [ ] Создание ребра: тянуть от порта (4 кружка) к другому узлу; подсветка цели; self-loop запрещён.
- [ ] Клик по ребру — выделяется (акцентный цвет, толще); подпись на месте.
- [ ] Marquee: протягивание рамки по фону выделяет пересечённые узлы; shift — аддитивно.
- [ ] Пан: средняя кнопка / Space / инструмент Hand; колесо — пан; Ctrl/Cmd+колесо — зум к курсору.
- [ ] Двойной клик по text/shape — инлайн-редактор; Enter коммит, Esc отмена; пустой новый узел удаляется.
- [ ] Контекстное меню по узлу (на передний/задний план, удалить); по пустому фону НЕ открывается.
- [ ] Клавиатура: Delete/Backspace, Esc, Ctrl+Z/Shift, V/H, стрелки (nudge), Ctrl/Cmd+]/[.
- [ ] Экспорт .svg и .png скачиваются, цвета темы корректны.
- [ ] Сохранение (create POST / edit PUT), невалидный граф подсвечивает узел.

Любой регресс — чинить до перехода к Task 8.

---

## Task 8: Удаление старых файлов + финальный гейт

**Files:**
- Delete: `src/features/canvas/ui/editor-node-layer.tsx`
- Delete: `src/features/canvas/ui/editor-edge-layer.tsx`
- Delete: `src/features/canvas/ui/canvas-export.tsx`

- [ ] **Step 1: Убедиться, что нет ссылок на удаляемые файлы**

Run:
```bash
grep -rn "editor-node-layer\|EditorNodeLayer\|editor-edge-layer\|EditorEdgeLayer\|ui/canvas-export\|from \"./canvas-export\"" src --include="*.ts" --include="*.tsx"
```
Expected: пусто (ни одной ссылки).

- [ ] **Step 2: Удалить файлы**

```bash
git rm src/features/canvas/ui/editor-node-layer.tsx src/features/canvas/ui/editor-edge-layer.tsx src/features/canvas/ui/canvas-export.tsx
```

- [ ] **Step 3: Финальный гейт**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: всё PASS.

- [ ] **Step 4: Коммит**

```bash
git add src/features/canvas/ui/editor-node-layer.tsx src/features/canvas/ui/editor-edge-layer.tsx src/features/canvas/ui/canvas-export.tsx
git commit -m "chore(canvas): удалить старые SVG-слои и шим экспорта (переезд завершён)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Итоговая структура движка

```
src/features/canvas/
  engine/
    painter.ts            — контракт: Scene, SurfaceSize, CanvasPainter
    index.ts              — const painter (активный движок) + ре-экспорт
    svg/
      svg-painter.tsx     — SvgSurface + svgPainter
      svg-edges.tsx       — рёбра + стрелки + подписи + превью
      svg-nodes.tsx       — узлы (NodeShapeRender)
      svg-overlays.tsx    — подсветка/рамки/ручки/порты
      svg-export.tsx      — экспорт .svg/.png
      svg-painter.test.tsx
      svg-export.test.tsx
  editor/                 — чистое ядро (без движка)
    hit-test.ts (+ .test) — JS hit-test сцены
    coords.ts / geometry-editor.ts / interaction.ts / canvas-reducer.ts / …
  ui/
    canvas-editor.tsx     — стейт + весь ввод, рендер через painter.Surface
    editor-text-overlay.tsx / editor-inspector.tsx / editor-toolbar.tsx / …
```

Смена движка: добавить `engine/canvas/canvas-painter.tsx` (реализует `CanvasPainter`) и поменять одну привязку в `engine/index.ts`.
