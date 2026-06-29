# Canvas Read-Only Pan/Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать зрителю read-only канваса зум/панораму/«уместить» (как в редакторе), сохранив текущий SSR-рендер графа.

**Architecture:** Прогрессивное улучшение (подход B). Серверный `CanvasRender` остаётся SSR/no-JS фолбэком; тело SVG извлекается в общий client-safe `CanvasScene`. Новый `"use client"` `CanvasViewer` рисует то же тело, до замера контейнера отдаёт идентичную статичную ветку (= текущий SSR), после — управляет `viewBox` из React-state. Жесты pan/zoom вынесены в общий хук `usePanZoom`, который потребляют и viewer, и (рефактором) редактор — единый источник истины. Вся математика вьюпорта переиспользуется из `editor/coords.ts`.

**Tech Stack:** Next.js (App Router, RSC), React 19, TypeScript, Tailwind v4 (CSS-переменные тем), Base UI kit (`@/components/ui`), Vitest + jsdom + @testing-library/react, next-intl (`@/i18n`, `@/i18n/client`), pnpm.

## Global Constraints

- Менеджер пакетов — **pnpm** (НЕ npm). Гейт перед готовностью: `pnpm lint && pnpm test && pnpm build` — все зелёные.
- Имена файлов/папок в `src/` — **kebab-case**.
- **Guardrail 7 (kit-only):** никаких нативных интерактивных тегов (`<button>` и т.п.) вне `src/components/ui/*`. Кнопки тулбара — только kit `IconButton`/`Button`.
- **Импорты:** только внутри `features/canvas` (intra-feature) и из `@/components/*` (верное направление слоёв). Никаких cross-feature и deep-импортов в чужие фичи.
- **Субагенты:** диспатчить на opus (не haiku), даже для механики.
- **Параллельные агенты:** НЕ делать `git stash/reset/checkout./clean`, НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени; не откатывать чужие изменения.
- Бэкенд НЕ трогаем — задача чисто FE (контракт не меняется).
- Спека: `docs/superpowers/specs/2026-06-29-canvas-read-only-pan-zoom-design.md`.

---

## File Structure

| Файл | Ответственность |
|------|------|
| `src/components/canvas-render/canvas-scene.tsx` | НОВЫЙ. Чистое (не-async, client-safe) тело SVG: defs+рёбра+узлы; параметризовано `viewBox/width/height`. Общий субстрат сервера и клиента. Экспорт `CANVAS_MARGIN`. |
| `src/components/canvas-render/canvas-render.tsx` | ПРАВКА. Async-оболочка (getT, bbox, статичный viewBox) рендерит `<CanvasScene>`. Внешний вывод неизменен. |
| `src/components/canvas-render/index.ts` | ПРАВКА. Экспорт `CanvasScene`, `CanvasSceneProps`, `CANVAS_MARGIN`. |
| `src/features/canvas/editor/use-pan-zoom.ts` | НОВЫЙ. Общий хук жестов: wheel + drag-пан + пинч. Controlled (`viewport`+`onViewportChange`). |
| `src/features/canvas/editor/index.ts` | ПРАВКА. Экспорт `usePanZoom`, `UsePanZoomOptions`. |
| `src/assets/icons/zoom-in-icon.tsx`, `zoom-out-icon.tsx` | НОВЫЕ. Иконки тулбара (в наборе их нет). |
| `src/features/canvas/ui/canvas-viewer.tsx` | НОВЫЙ. `"use client"` интерактивный read-only просмотр: статичная/интерактивная ветки, мини-тулбар, `usePanZoom`. |
| `src/features/canvas/ui/canvas-detail.tsx` | ПРАВКА. Не-async; маппинг `CanvasData→RenderData` + рендер `<CanvasViewer>`. |
| `src/i18n/messages/*/canvas.ts` | ПРАВКА. Ключи `viewer.zoomIn/zoomOut/resetZoom` (fit — reuse `toolbar.fit`). |
| `src/features/canvas/ui/canvas-editor.tsx` | РЕФАКТОР. Потребляет `usePanZoom`; свои wheel/pan-drag удаляются. Браузер-регресс. |

**Порядок задач:** 1 (CanvasScene) → 2 (usePanZoom) → 3 (CanvasViewer) → 4 (wire CanvasDetail) → 5 (editor refactor). Фича для пользователя готова уже после задачи 4; задача 5 — консолидация «единого источника истины» (самая рискованная, выделена последней).

---

## Task 1: Extract `CanvasScene` from `CanvasRender`

**Files:**
- Create: `src/components/canvas-render/canvas-scene.tsx`
- Create: `src/components/canvas-render/canvas-scene.test.tsx`
- Modify: `src/components/canvas-render/canvas-render.tsx`
- Modify: `src/components/canvas-render/index.ts`
- Existing: `src/components/canvas-render/canvas-render.test.tsx` (должен остаться зелёным — регрессионный инвариант)

**Interfaces:**
- Produces: `CanvasScene(props: CanvasSceneProps)` — компонент; `CANVAS_MARGIN: number` (=24); тип `CanvasSceneProps { data: RenderData; resolveEntityRef: EntityRefResolver; viewBox: string; width: number|string; height: number|string; ariaLabel: string; svgStyle?: CSSProperties }`.

- [ ] **Step 1: Write the failing test** — `src/components/canvas-render/canvas-scene.test.tsx`

```tsx
// src/components/canvas-render/canvas-scene.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CanvasScene } from "./canvas-scene";
import type { EntityRefResolver, RenderData } from "./types";

const resolve: EntityRefResolver = (type, id) =>
  type === "document" ? { href: `/documents/${id}`, typeLabel: "Документ" } : { href: null, typeLabel: "Объект" };

afterEach(cleanup);

describe("CanvasScene", () => {
  it("рендерит svg с переданным viewBox, узлами и ребром-стрелкой", () => {
    const data: RenderData = {
      nodes: [
        { id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" },
        { id: "b", type: "shape", x: 200, y: 0, width: 80, height: 80, shapeKind: "ellipse" },
      ],
      edges: [{ id: "e1", fromNode: "a", toNode: "b", end: "arrow" }],
    };
    const { container } = render(
      <CanvasScene data={data} resolveEntityRef={resolve} viewBox="0 0 300 100" width="100%" height="100%" ariaLabel="граф" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 300 100");
    expect(svg?.getAttribute("aria-label")).toBe("граф");
    expect(container.querySelector("ellipse")).not.toBeNull();
    expect(container.querySelector("path[marker-end]")).not.toBeNull();
  });

  it("entity_ref известного типа → ссылка", () => {
    const data: RenderData = {
      nodes: [{ id: "r", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entityType: "document", entityId: "d1" }],
      edges: [],
    };
    const { container } = render(
      <CanvasScene data={data} resolveEntityRef={resolve} viewBox="0 0 120 60" width="100%" height="100%" ariaLabel="граф" />,
    );
    expect(container.querySelector('a[href="/documents/d1"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/canvas-render/canvas-scene.test.tsx`
Expected: FAIL — `Failed to resolve import "./canvas-scene"` (модуль не существует).

- [ ] **Step 3: Create `CanvasScene`** — `src/components/canvas-render/canvas-scene.tsx`

```tsx
// src/components/canvas-render/canvas-scene.tsx
import type { CSSProperties } from "react";

import { EdgeShapeRender, ArrowMarkerDefs } from "./edge-shape";
import { NodeShapeRender } from "./node-shapes";
import type { EntityRefResolver, RenderData, RenderNode } from "./types";

/** Поле вокруг bounding box для статичного viewBox (px в координатах мира). */
export const CANVAS_MARGIN = 24;

export interface CanvasSceneProps {
  data: RenderData;
  resolveEntityRef: EntityRefResolver;
  /** "minX minY width height". */
  viewBox: string;
  width: number | string;
  height: number | string;
  ariaLabel: string;
  /** Доп. inline-стиль <svg> (статика: подгон по ширине; интерактив: block). */
  svgStyle?: CSSProperties;
}

/**
 * Чистое (client-safe, НЕ async) тело SVG canvas-графа: defs + рёбра + узлы.
 * Общий субстрат для серверного CanvasRender (статичный viewBox по bbox) и
 * клиентского CanvasViewer (viewBox из стейта pan/zoom). Координаты узлов заданы
 * извне (бек посчитал layout). Рёбра — прямые с привязкой к стороне.
 */
export function CanvasScene({ data, resolveEntityRef, viewBox, width, height, ariaLabel, svgStyle }: CanvasSceneProps) {
  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={viewBox} width={width} height={height} role="img" aria-label={ariaLabel} style={svgStyle}>
      <ArrowMarkerDefs />

      {data.edges.map((e) => (
        <EdgeShapeRender key={e.id} edge={e} nodesById={byId} />
      ))}

      {data.nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Refactor `CanvasRender` to use `CanvasScene`** — заменить ВСЁ содержимое `src/components/canvas-render/canvas-render.tsx`

```tsx
// src/components/canvas-render/canvas-render.tsx
import { getT } from "@/i18n";

import { CanvasScene, CANVAS_MARGIN } from "./canvas-scene";
import { boundingBox } from "./geometry";
import type { CanvasRenderProps } from "./types";

/**
 * Generic read-only SSR-рендер canvas-графа. Координаты узлов заданы извне
 * (бек уже посчитал layout). Рисует <svg> со статичным viewBox по bounding box;
 * тело графа — общий CanvasScene. Без интерактива (pan/zoom) — внешняя обёртка
 * скроллит при необходимости (overflow:auto). Интерактивный вариант — CanvasViewer.
 */
export async function CanvasRender({ data, resolveEntityRef, emptyText, className, children }: CanvasRenderProps) {
  const t = await getT("common");
  const resolvedEmptyText = emptyText ?? t("canvasRender.emptyGraph");

  if (data.nodes.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{resolvedEmptyText}</p>;
  }

  const bbox = boundingBox(data.nodes);
  const vbX = bbox.minX - CANVAS_MARGIN;
  const vbY = bbox.minY - CANVAS_MARGIN;
  const vbW = bbox.maxX - bbox.minX + CANVAS_MARGIN * 2;
  const vbH = bbox.maxY - bbox.minY + CANVAS_MARGIN * 2;

  return (
    <div className={className} style={{ overflow: "auto", maxWidth: "100%" }}>
      <CanvasScene
        data={data}
        resolveEntityRef={resolveEntityRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={vbW}
        height={vbH}
        ariaLabel={t("canvasRender.graphAriaLabel")}
        svgStyle={{ maxWidth: "100%", height: "auto" }}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Export from barrel** — добавить в `src/components/canvas-render/index.ts` (после строки с `NodeShapeRender`/`edge-shape`)

```ts
export { CanvasScene, CANVAS_MARGIN } from "./canvas-scene";
export type { CanvasSceneProps } from "./canvas-scene";
```

- [ ] **Step 6: Run tests** — новый + существующий регрессионный

Run: `pnpm test -- src/components/canvas-render/`
Expected: PASS — `canvas-scene.test.tsx` зелёный И `canvas-render.test.tsx` зелёный без изменений (svg/ellipse/path[stroke-dasharray]/path[marker-end]/a[href]/data-entity-unlinked/«Граф пуст.» — всё на месте: разметка не изменилась).

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas-render/canvas-scene.tsx src/components/canvas-render/canvas-scene.test.tsx src/components/canvas-render/canvas-render.tsx src/components/canvas-render/index.ts
git commit -m "refactor(canvas-render): извлечь общее тело SVG в CanvasScene"
```

---

## Task 2: `usePanZoom` hook (общий wheel + drag-пан + пинч)

**Files:**
- Create: `src/features/canvas/editor/use-pan-zoom.ts`
- Create: `src/features/canvas/editor/use-pan-zoom.test.tsx`
- Modify: `src/features/canvas/editor/index.ts`

**Interfaces:**
- Consumes: `applyZoomAtPoint` (`./coords`), `resolveWheel` (`./interaction`), `Viewport` (`./editor-types`).
- Produces: `usePanZoom(ref: RefObject<HTMLElement | null>, opts: UsePanZoomOptions): void`; тип `UsePanZoomOptions { viewport: Viewport | null; onViewportChange: (next: Viewport) => void; enablePanDrag: boolean | ((e: PointerEvent) => boolean); onPointerDownOther?: (e: PointerEvent) => void; disabled?: boolean }`.

- [ ] **Step 1: Write the failing test** — `src/features/canvas/editor/use-pan-zoom.test.tsx`

```tsx
// src/features/canvas/editor/use-pan-zoom.test.tsx
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Viewport } from "./editor-types";
import { usePanZoom, type UsePanZoomOptions } from "./use-pan-zoom";

function mount(over: Partial<UsePanZoomOptions> = {}) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const onViewportChange = vi.fn<(v: Viewport) => void>();
  const opts: UsePanZoomOptions = {
    viewport: { x: 0, y: 0, zoom: 1 },
    onViewportChange,
    enablePanDrag: true,
    ...over,
  };
  const ref = { current: el };
  const view = renderHook(() => { usePanZoom(ref, opts); });
  return { el, onViewportChange, unmount: view.unmount };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("usePanZoom — wheel", () => {
  it("ctrl+колесо вверх → зум (zoom ≈ 1.1)", () => {
    const { el, onViewportChange } = mount();
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onViewportChange).toHaveBeenCalledTimes(1);
    const vp = onViewportChange.mock.calls[0]![0];
    expect(vp.zoom).toBeCloseTo(1.1);
  });

  it("плоское колесо → пан (zoom не меняется, x/y = delta/zoom)", () => {
    const { el, onViewportChange } = mount();
    el.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, deltaY: 12, bubbles: true, cancelable: true }));
    const vp = onViewportChange.mock.calls[0]![0];
    expect(vp.zoom).toBe(1);
    expect(vp.x).toBeCloseTo(30);
    expect(vp.y).toBeCloseTo(12);
  });

  it("disabled → колесо игнорируется", () => {
    const { el, onViewportChange } = mount({ disabled: true });
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("после unmount слушатель снят", () => {
    const { el, onViewportChange, unmount } = mount();
    unmount();
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onViewportChange).not.toHaveBeenCalled();
  });
});
```

> Примечание: jsdom НЕ реализует `PointerEvent` → drag-пан и пинч (pointer-механика) здесь НЕ тестируются; они проверяются в браузер-QA (задачи 3 и 5), а их математика — это уже покрытые `coords` (`applyZoomAtPoint` + формула пана `start - delta/zoom`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/canvas/editor/use-pan-zoom.test.tsx`
Expected: FAIL — `Failed to resolve import "./use-pan-zoom"`.

- [ ] **Step 3: Create the hook** — `src/features/canvas/editor/use-pan-zoom.ts`

```ts
// src/features/canvas/editor/use-pan-zoom.ts
import { useEffect, useRef, type RefObject } from "react";

import { applyZoomAtPoint } from "./coords";
import type { Viewport } from "./editor-types";
import { resolveWheel } from "./interaction";

export interface UsePanZoomOptions {
  /** Текущий вьюпорт (controlled). null → интерактив выключен (статичная ветка). */
  viewport: Viewport | null;
  onViewportChange: (next: Viewport) => void;
  /** Должен ли pointerdown начать пан. boolean | предикат по нативному событию. */
  enablePanDrag: boolean | ((e: PointerEvent) => boolean);
  /** Вызывается на pointerdown, когда enablePanDrag вернул false (не-пановый ввод). */
  onPointerDownOther?: (e: PointerEvent) => void;
  /** Полностью отключить жесты (напр. до замера контейнера). */
  disabled?: boolean;
}

/**
 * Общий клей жестов pan/zoom поверх DOM-элемента — единственный владелец wheel и
 * pointerdown. Controlled: стейт вьюпорта держит консьюмер (редактор — в reducer,
 * viewer — в useState), хук лишь шлёт `onViewportChange`. Вся математика — из coords.
 *
 *  - wheel (non-passive): Figma-конвенция (ctrl/meta → зум у курсора, shift → гориз, иначе пан).
 *  - drag-пан: pointerdown при enablePanDrag → захват + сдвиг вьюпорта по экранной дельте.
 *  - пинч (2 тач-указателя): отношение дистанций → зум в середине щипка.
 *  - не-пановый pointerdown делегируется через onPointerDownOther (там консьюмер ведёт
 *    свои жесты: select/marquee/resize/edge у редактора).
 */
export function usePanZoom(ref: RefObject<HTMLElement | null>, opts: UsePanZoomOptions): void {
  // Свежие opts в ref: слушатели вешаются один раз и читают current на событии
  // (без переподписки и без stale-замыканий vp/предикатов).
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  // --- wheel ---
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { viewport: vp, onViewportChange, disabled } = optsRef.current;
      if (disabled || !vp) return;
      e.preventDefault();
      const action = resolveWheel({ deltaX: e.deltaX, deltaY: e.deltaY, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
      if (action.kind === "zoom") {
        const rect = el.getBoundingClientRect();
        onViewportChange(applyZoomAtPoint(vp, action.factor, e.clientX - rect.left, e.clientY - rect.top));
      } else {
        onViewportChange({ ...vp, x: vp.x + action.dx / vp.zoom, y: vp.y + action.dy / vp.zoom });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); };
  }, [ref]);

  // --- pointer: drag-пан + пинч ---
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const points = new Map<number, { x: number; y: number }>();
    let panning = false;
    let panPointerId = -1;
    let startScreen = { x: 0, y: 0 };
    let startVp = { x: 0, y: 0 };
    let pinchPrevDist = 0;

    const onDown = (e: PointerEvent) => {
      const { disabled, viewport, enablePanDrag, onPointerDownOther } = optsRef.current;
      if (disabled || !viewport) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        // начался пинч → отменяем возможный пан
        panning = false;
        const [a, b] = [...points.values()];
        pinchPrevDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        return;
      }
      const wantPan = typeof enablePanDrag === "function" ? enablePanDrag(e) : enablePanDrag;
      if (wantPan) {
        panning = true;
        panPointerId = e.pointerId;
        startScreen = { x: e.clientX, y: e.clientY };
        startVp = { x: viewport.x, y: viewport.y };
        el.setPointerCapture?.(e.pointerId);
      } else {
        onPointerDownOther?.(e);
      }
    };

    const onMove = (e: PointerEvent) => {
      const { viewport, onViewportChange } = optsRef.current;
      if (!viewport) return;
      if (points.has(e.pointerId)) points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        const [a, b] = [...points.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinchPrevDist > 0 && dist > 0) {
          const rect = el.getBoundingClientRect();
          const midX = (a!.x + b!.x) / 2 - rect.left;
          const midY = (a!.y + b!.y) / 2 - rect.top;
          onViewportChange(applyZoomAtPoint(viewport, dist / pinchPrevDist, midX, midY));
        }
        pinchPrevDist = dist;
        return;
      }
      if (!panning || e.pointerId !== panPointerId) return;
      const dx = e.clientX - startScreen.x;
      const dy = e.clientY - startScreen.y;
      onViewportChange({ zoom: viewport.zoom, x: startVp.x - dx / viewport.zoom, y: startVp.y - dy / viewport.zoom });
    };

    const onUp = (e: PointerEvent) => {
      points.delete(e.pointerId);
      if (points.size < 2) pinchPrevDist = 0;
      if (e.pointerId === panPointerId) {
        panning = false;
        panPointerId = -1;
        el.releasePointerCapture?.(e.pointerId);
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [ref]);
}
```

- [ ] **Step 4: Export from editor barrel** — добавить в `src/features/canvas/editor/index.ts`

```ts
export { usePanZoom } from "./use-pan-zoom";
export type { UsePanZoomOptions } from "./use-pan-zoom";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- src/features/canvas/editor/use-pan-zoom.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas/editor/use-pan-zoom.ts src/features/canvas/editor/use-pan-zoom.test.tsx src/features/canvas/editor/index.ts
git commit -m "feat(canvas): общий хук usePanZoom (wheel + drag-пан + пинч)"
```

---

## Task 3: `CanvasViewer` component + иконки зума + i18n

**Files:**
- Create: `src/assets/icons/zoom-in-icon.tsx`, `src/assets/icons/zoom-out-icon.tsx`
- Create: `src/features/canvas/ui/canvas-viewer.tsx`
- Create: `src/features/canvas/ui/canvas-viewer.test.tsx`
- Modify: `src/i18n/messages/ru/canvas.ts` (+ `en`, `ar`, `zh` при необходимости — см. Step 5)

**Interfaces:**
- Consumes: `CanvasScene`, `CANVAS_MARGIN`, `boundingBox`, тип `RenderData` (`@/components/canvas-render`); `IconButton`, `Button` (`@/components/ui`); `usePanZoom`, `applyZoomAtPoint`, `centerViewport`, `fitViewport`, тип `Viewport` (`../editor`); `makeEntityRefResolver` (`../entity-ref`); `useT` (`@/i18n/client`); иконки `ZoomInIcon`/`ZoomOutIcon`/`FitIcon`.
- Produces: `CanvasViewer(props: { data: RenderData; className?: string; children?: ReactNode })`.

- [ ] **Step 1: Create zoom icons** — `src/assets/icons/zoom-in-icon.tsx`

```tsx
import { SVGProps } from "react";

/** Лупа с плюсом — приблизить. */
export const ZoomInIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);
```

И `src/assets/icons/zoom-out-icon.tsx`:

```tsx
import { SVGProps } from "react";

/** Лупа с минусом — отдалить. */
export const ZoomOutIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
    <path d="M8 11h6" />
  </svg>
);
```

- [ ] **Step 2: Write the failing test** — `src/features/canvas/ui/canvas-viewer.test.tsx`

```tsx
// src/features/canvas/ui/canvas-viewer.test.tsx
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import type { RenderData } from "@/components/canvas-render";

import { CanvasViewer } from "./canvas-viewer";

type RoCb = (entries: { contentRect: { width: number; height: number } }[]) => void;

/** Стаб ResizeObserver, отдающий захваченный callback тесту. */
function stubResizeObserver(): { fire: (w: number, h: number) => void } {
  let cb: RoCb | null = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(c: RoCb) { cb = c; }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  return { fire: (w, h) => { act(() => { cb?.([{ contentRect: { width: w, height: h } }]); }); } };
}

const oneNode: RenderData = {
  nodes: [{ id: "a", type: "text", x: 0, y: 0, width: 100, height: 100, text: "x" }],
  edges: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CanvasViewer", () => {
  it("пустой граф → плашка emptyText, тулбара нет", () => {
    stubResizeObserver();
    render(<CanvasViewer data={{ nodes: [], edges: [] }} />);
    expect(screen.getByText("canvasRender.emptyGraph")).toBeInTheDocument();
    expect(screen.queryByLabelText("viewer.zoomIn")).not.toBeInTheDocument();
  });

  it("до замера контейнера — статичная ветка (viewBox по bbox+margin), без тулбара", () => {
    stubResizeObserver();
    const { container } = render(<CanvasViewer data={oneNode} />);
    const svg = container.querySelector("svg");
    // bbox {0,0,100,100} + margin 24 → "-24 -24 148 148"
    expect(svg?.getAttribute("viewBox")).toBe("-24 -24 148 148");
    expect(screen.queryByLabelText("viewer.zoomIn")).not.toBeInTheDocument();
  });

  it("после замера → интерактив: появляется тулбар, viewBox из вьюпорта", () => {
    const ro = stubResizeObserver();
    const { container } = render(<CanvasViewer data={oneNode} />);
    ro.fire(800, 600);
    expect(screen.getByLabelText("viewer.zoomIn")).toBeInTheDocument();
    const svg = container.querySelector("svg")!;
    const vbAfterFit = svg.getAttribute("viewBox");
    // fit-вьюпорт даёт viewBox формата "x y w h" ≠ статичному
    expect(vbAfterFit).not.toBe("-24 -24 148 148");
  });

  it("кнопка зум-ин меняет viewBox (масштаб растёт → видимая область сужается)", () => {
    const ro = stubResizeObserver();
    const { container } = render(<CanvasViewer data={oneNode} />);
    ro.fire(800, 600);
    const svg = container.querySelector("svg")!;
    const before = svg.getAttribute("viewBox");
    fireEvent.click(screen.getByLabelText("viewer.zoomIn"));
    expect(svg.getAttribute("viewBox")).not.toBe(before);
  });
});
```

> ⚠️ Это jsdom-санити (act() может маскировать баги реактивности — см. конвенцию ast-toolbar). Реальные wheel/drag/пинч/курсор — браузер-QA в Step 6.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- src/features/canvas/ui/canvas-viewer.test.tsx`
Expected: FAIL — `Failed to resolve import "./canvas-viewer"`.

- [ ] **Step 4: Create `CanvasViewer`** — `src/features/canvas/ui/canvas-viewer.tsx`

```tsx
"use client";
// src/features/canvas/ui/canvas-viewer.tsx
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FitIcon } from "@/assets/icons/fit-icon";
import { ZoomInIcon } from "@/assets/icons/zoom-in-icon";
import { ZoomOutIcon } from "@/assets/icons/zoom-out-icon";
import { boundingBox, CanvasScene, CANVAS_MARGIN, type RenderData } from "@/components/canvas-render";
import { Button, IconButton } from "@/components/ui";
import { useT } from "@/i18n/client";

import { applyZoomAtPoint, centerViewport, fitViewport, usePanZoom, type Viewport } from "../editor";
import { makeEntityRefResolver } from "../entity-ref";

interface Props {
  data: RenderData;
  className?: string;
  children?: ReactNode;
}

// Шаг зума кнопкой тулбара — крупнее одного «щелчка» колеса (комфортнее кликом).
const BTN_ZOOM_IN = 1.4;
const BTN_ZOOM_OUT = 1 / 1.4;

/**
 * Read-only интерактивный просмотр канваса: pan/zoom поверх SSR-рендера.
 * До замера контейнера рендерит статичную ветку, идентичную CanvasRender
 * (SSR/no-JS фолбэк, без mismatch при гидрации); после — управляет viewBox из
 * стейта через общий usePanZoom. i18n/ссылки резолвит сам (как редактор).
 */
export function CanvasViewer({ data, className, children }: Props) {
  const t = useT("canvas");
  const tCommon = useT("common");
  const resolveEntityRef = useMemo(() => makeEntityRefResolver(t), [t]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  const hasNodes = data.nodes.length > 0;

  // Замер контейнера на клиенте → переход в интерактив; fit при первом замере.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !hasNodes) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width <= 0 || r.height <= 0) return;
      const s = { width: r.width, height: r.height };
      setSize(s);
      setViewport((prev) => prev ?? fitViewport(boundingBox(data.nodes), s));
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [data.nodes, hasNodes]);

  const interactive = size !== null && viewport !== null;

  usePanZoom(containerRef, {
    viewport,
    onViewportChange: setViewport,
    enablePanDrag: true,
    disabled: !interactive,
  });

  const zoomAtCenter = useCallback((factor: number) => {
    if (!size || !viewport) return;
    setViewport(applyZoomAtPoint(viewport, factor, size.width / 2, size.height / 2));
  }, [size, viewport]);

  const onFit = useCallback(() => {
    if (!size) return;
    setViewport(fitViewport(boundingBox(data.nodes), size));
  }, [size, data.nodes]);

  const onResetZoom = useCallback(() => {
    if (!size || !viewport) return;
    const center = {
      x: viewport.x + size.width / 2 / viewport.zoom,
      y: viewport.y + size.height / 2 / viewport.zoom,
    };
    setViewport(centerViewport(center, size, 1));
  }, [size, viewport]);

  if (!hasNodes) {
    return <p className="text-sm text-(--color-fg-muted)">{tCommon("canvasRender.emptyGraph")}</p>;
  }

  const bbox = boundingBox(data.nodes);
  const staticW = bbox.maxX - bbox.minX + CANVAS_MARGIN * 2;
  const staticH = bbox.maxY - bbox.minY + CANVAS_MARGIN * 2;
  const staticViewBox = `${bbox.minX - CANVAS_MARGIN} ${bbox.minY - CANVAS_MARGIN} ${staticW} ${staticH}`;

  const viewBox =
    interactive && viewport && size
      ? `${viewport.x} ${viewport.y} ${size.width / viewport.zoom} ${size.height / viewport.zoom}`
      : staticViewBox;

  return (
    <div
      ref={containerRef}
      className={className}
      style={
        interactive
          ? { position: "relative", overflow: "hidden", touchAction: "none", cursor: "grab", height: "100%" }
          : { overflow: "auto", maxWidth: "100%" }
      }
    >
      <CanvasScene
        data={data}
        resolveEntityRef={resolveEntityRef}
        viewBox={viewBox}
        width={interactive ? "100%" : staticW}
        height={interactive ? "100%" : staticH}
        ariaLabel={tCommon("canvasRender.graphAriaLabel")}
        svgStyle={interactive ? { display: "block" } : { maxWidth: "100%", height: "auto" }}
      />

      {interactive && viewport && (
        <div
          className="absolute bottom-2 end-2 flex items-center gap-1 rounded border border-(--color-border) bg-(--color-surface) p-1"
          style={{ pointerEvents: "auto" }}
        >
          <IconButton type="button" compact aria-label={t("viewer.zoomOut")} onClick={() => { zoomAtCenter(BTN_ZOOM_OUT); }}>
            <span className="inline-flex text-lg"><ZoomOutIcon /></span>
          </IconButton>
          <Button type="button" tone="quiet" compact aria-label={t("viewer.resetZoom")} onClick={onResetZoom}>
            <span className="text-xs tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
          </Button>
          <IconButton type="button" compact aria-label={t("viewer.zoomIn")} onClick={() => { zoomAtCenter(BTN_ZOOM_IN); }}>
            <span className="inline-flex text-lg"><ZoomInIcon /></span>
          </IconButton>
          <IconButton type="button" compact aria-label={t("toolbar.fit")} onClick={onFit}>
            <span className="inline-flex text-lg"><FitIcon /></span>
          </IconButton>
        </div>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Add i18n keys** — открыть `src/i18n/messages/ru/canvas.ts`, найти объект `viewer` (если нет — создать рядом с `toolbar`) и добавить:

```ts
  viewer: {
    zoomIn: "Приблизить",
    zoomOut: "Отдалить",
    resetZoom: "Сбросить масштаб (100%)",
  },
```

Затем прогнать тест-парность локалей: `pnpm test`. Если падает проверка парности ключей — добавить те же ключи в `src/i18n/messages/en/canvas.ts`:

```ts
  viewer: {
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetZoom: "Reset zoom (100%)",
  },
```

и в `src/i18n/messages/ar/canvas.ts`, `src/i18n/messages/zh/canvas.ts` — теми же значениями, что и `en` (стопгап), пометив для вычитки носителем (консистентно с открытым follow-up «EN/ar/zh вычитка»). `en-XA` — псевдолокаль, генерится автоматически, файла нет.

- [ ] **Step 6: Run tests to verify they pass + браузер-QA viewer (изолированно через /canvases/[id])**

Run: `pnpm test -- src/features/canvas/ui/canvas-viewer.test.tsx`
Expected: PASS (4 теста).

Браузер-QA отложить до задачи 4 (когда viewer реально подключён к странице) — там полный чеклист.

- [ ] **Step 7: Commit**

```bash
git add src/assets/icons/zoom-in-icon.tsx src/assets/icons/zoom-out-icon.tsx src/features/canvas/ui/canvas-viewer.tsx src/features/canvas/ui/canvas-viewer.test.tsx src/i18n/messages/ru/canvas.ts
# плюс изменённые локали, если парность потребовала:
git add src/i18n/messages/en/canvas.ts src/i18n/messages/ar/canvas.ts src/i18n/messages/zh/canvas.ts 2>/dev/null || true
git commit -m "feat(canvas): интерактивный CanvasViewer (pan/zoom поверх SSR)"
```

---

## Task 4: Wire `CanvasDetail` → `CanvasViewer`

**Files:**
- Modify: `src/features/canvas/ui/canvas-detail.tsx`

**Interfaces:**
- Consumes: `CanvasViewer` (`./canvas-viewer`), `RenderData`/`RenderEdge`/`RenderNode` (`@/components/canvas-render`), `CanvasData` (`../types`).
- Produces: `CanvasDetail(props: { data: CanvasData | undefined })` — теперь синхронный.

- [ ] **Step 1: Replace `CanvasDetail`** — заменить ВСЁ содержимое `src/features/canvas/ui/canvas-detail.tsx`

```tsx
// src/features/canvas/ui/canvas-detail.tsx
import type { RenderData, RenderEdge, RenderNode } from "@/components/canvas-render";

import type { CanvasData } from "../types";

import { CanvasViewer } from "./canvas-viewer";

interface Props {
  data: CanvasData | undefined;
}

/** Мапит CanvasData (schema-форма) в доменно-нейтральный RenderData. */
function toRenderData(data: CanvasData | undefined): RenderData {
  const nodes: RenderNode[] = (data?.nodes ?? []).flatMap((n) =>
    n.id
      ? [
          {
            id: n.id,
            type: n.type,
            x: n.x ?? 0,
            y: n.y ?? 0,
            width: n.width ?? 100,
            height: n.height ?? 40,
            text: n.text,
            shapeKind: n.shape_kind,
            entityType: n.entity_type,
            entityId: n.entity_id,
          },
        ]
      : [],
  );
  const edges: RenderEdge[] = (data?.edges ?? []).flatMap((e) =>
    e.id && e.from_node && e.to_node
      ? [
          {
            id: e.id,
            fromNode: e.from_node,
            toNode: e.to_node,
            fromSide: e.from_side,
            toSide: e.to_side,
            label: e.label,
            style: e.style,
            end: e.end,
          },
        ]
      : [],
  );
  return { nodes, edges };
}

/**
 * Read-only визуализация графа канваса. Маппинг чистый → синхронный серверный
 * компонент; интерактив (pan/zoom) и i18n/ссылки ведёт клиентский CanvasViewer.
 * Единая точка для /canvases/[id] и модалки ревизий (CanvasRevisions).
 */
export function CanvasDetail({ data }: Props) {
  return (
    <CanvasViewer
      data={toRenderData(data)}
      className="rounded border border-(--color-border) bg-(--color-surface) p-2"
    />
  );
}
```

- [ ] **Step 2: Verify gate (lint + типы + сборка + все тесты)**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. (Ранее `CanvasDetail` был `async`; вызовы `<CanvasDetail data=... />` в `src/app/canvases/[id]/page.tsx` и `src/features/canvas/ui/canvas-revisions.tsx` работают и с синхронным компонентом — RSC рендерит оба.)

- [ ] **Step 3: Браузер-QA (локальный стек: бэк :8090 `make run-local`, фронт `pnpm dev` :3001; dev/admin12345)**

Проверить вручную и подтвердить вывод:
- [ ] `/canvases/[id]` (публичный, непустой граф): колесо `ctrl/cmd`+wheel → зум у курсора; обычное колесо → пан; `shift`+колесо → гориз.
- [ ] Drag мышью по фону → панорама; курсор grab.
- [ ] Тулбар: `+`/`−` зумят к центру; `NN%` → 100%; `⤢` → весь граф влез. `NN%` обновляется.
- [ ] Тач-устройство/эмуляция: один палец → пан; два пальца → пинч-зум.
- [ ] Модалка ревизий (`/canvases/[id]?revision=N`): тот же интерактив внутри снапшота.
- [ ] no-JS (DevTools → Disable JavaScript), перезагрузка: граф виден целиком и скроллится (статичный SVG), тулбара нет.
- [ ] view-source страницы: внутри HTML присутствует `<svg ... viewBox=...>` с узлами (SSR).
- [ ] RTL (переключить локаль `ar`): тулбар у логического конца (`end`), жесты не зеркалятся некорректно.
- [ ] Пустой граф: показывается «Граф пуст.», без тулбара/ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/features/canvas/ui/canvas-detail.tsx
git commit -m "feat(canvas): подключить интерактивный CanvasViewer в CanvasDetail (+ревизии)"
```

---

## Task 5: Refactor `CanvasEditor` onto `usePanZoom` (единый источник истины)

> ⚠️ **Высокий риск, без юнит-тестов** (`canvas-editor.tsx` тестами не покрыт по конвенции). Гейт — `pnpm lint && pnpm test && pnpm build` + ПОЛНЫЙ браузер-регресс. Делать строго после задач 1–4 (фича для пользователя уже доставлена). **Fallback:** если рефактор регрессирует жесты редактора и быстро не чинится — откатить ТОЛЬКО коммит задачи 5 (`git revert <sha>`); viewer и хук остаются рабочими, хук просто используется одним потребителем.

**Files:**
- Modify: `src/features/canvas/ui/canvas-editor.tsx`

**Interfaces:**
- Consumes: `usePanZoom` (`../editor`), уже импортируемые `resolveBackgroundGesture`/`resolveNodeGesture`/`hitTest`/`applyZoomAtPoint`/`screenToWorld`.
- Produces: поведение редактора без изменений (1:1 жесты), wheel/drag-пан теперь идут через `usePanZoom`.

- [ ] **Step 1: Import the hook** — в блоке импортов из `../editor` (строки 13–17) добавить `usePanZoom`:

```ts
import {
  canvasReducer, initEditorState, NODE_DEFAULT_SIZE, canvasDataToRenderData,
  screenToWorld, applyZoomAtPoint, fitViewport, centerViewport, snapPoint, validateGraph, hitTestNode, hitTest, marqueeHits, newId,
  resolveBackgroundGesture, resolveNodeGesture, resolveWheel, resolveNudge,
  usePanZoom,
} from "../editor";
```

`resolveWheel` остаётся импортированным (он теперь используется ВНУТРИ хука, не здесь) — после правок проверить `pnpm lint` на «unused»; если ESLint ругнётся на `resolveWheel`, убрать его из этого импорта.

- [ ] **Step 2: Remove the `"pan"` drag variant** — в типе `Drag` (строки 40–46) удалить строку pan:

Было:
```ts
type Drag =
  | { kind: "pan"; startScreen: Point; startVp: { x: number; y: number } }
  | { kind: "move"; lastWorld: Point }
```
Стало:
```ts
type Drag =
  | { kind: "move"; lastWorld: Point }
```
(остальные варианты `resize|marquee|edge|null` без изменений).

- [ ] **Step 3: Delete `startPan` and rewrite the pointerdown** — удалить функцию `startPan` (строки 177–181) и заменить `onSurfacePointerDown` (строки 183–237) на пару «предикат пана + не-пановый обработчик». Вставить ВМЕСТО старого `onSurfacePointerDown`:

```ts
  // ---- pan-предикат для usePanZoom: hit-test + резолв жеста ----
  // Возвращает true, когда pointerdown должен начать ПАН (хук возьмёт его на себя).
  const enablePanDrag = (e: PointerEvent): boolean => {
    const world = eventWorld(e);
    const hit = hitTest(world, { nodes: renderData.nodes, edges: renderData.edges, nodesById, singleSelectedNodeId });
    const g = { tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey };
    if (hit.kind === "node") return resolveNodeGesture(g) === "pan";
    if (hit.kind === "background") return resolveBackgroundGesture(g) === "pan";
    return false; // resize-handle / port / edge — никогда не пан
  };

  /** Не-пановый pointerdown (хук уже отсеял пан): select/marquee/resize/edge. */
  const onPointerDownOther = (e: PointerEvent) => {
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const world = eventWorld(e);
    const hit = hitTest(world, { nodes: renderData.nodes, edges: renderData.edges, nodesById, singleSelectedNodeId });
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
        if (!selectedNodeIds.has(hit.nodeId)) {
          dispatch({ type: "selectNode", nodeId: hit.nodeId, additive });
        } else if (additive) {
          dispatch({ type: "selectNode", nodeId: hit.nodeId, additive: true });
        }
        dragRef.current = { kind: "move", lastWorld: world };
        capture();
        return;
      }
      case "edge":
        dispatch({ type: "selectEdge", edgeId: hit.edgeId, additive });
        return;
      case "background":
        if (!additive) dispatch({ type: "clearSelection" });
        dragRef.current = { kind: "marquee", startWorld: world, currentWorld: world, additive };
        capture();
        return;
    }
  };
```

Примечание: `eventWorld` (строки 162–168) уже принимает `{ clientX, clientY }` — работает и с нативным `PointerEvent`. Хит-тест считается и в предикате, и в `onPointerDownOther` (pointerdown редок — двойной hit-test приемлем).

- [ ] **Step 4: Remove the pan branch from `onPointerMove`** — в `onPointerMove` (строки 266–309) удалить ветку `case "pan": { … }` (строки 280–285). Остальные ветки (`move/resize/marquee/edge`) и hover-логика — без изменений. (После удаления `vp` может стать «не используется» в этой функции — это нормально, `vp` используется в других местах.)

- [ ] **Step 5: Delete the wheel machinery** — удалить ОБА wheel-эффекта и `onWheelRef` (строки 345–369 целиком: от `const onWheelRef = useRef…` до конца второго `useEffect` с `el.addEventListener("wheel", …)`). Их заменяет хук.

- [ ] **Step 6: Wire `usePanZoom`** — вставить вызов хука СРАЗУ ПОСЛЕ определений `enablePanDrag`/`onPointerDownOther` из Step 3 (т.е. там, где раньше заканчивался `onSurfacePointerDown`, ~строка 237).

```ts
  // Единый клей жестов pan/zoom (общий с CanvasViewer). Wheel + drag-пан + пинч.
  // Стейт вьюпорта остаётся в reducer; не-пановый pointerdown ведёт редактор сам.
  usePanZoom(surfaceRef, {
    viewport: state.viewport,
    onViewportChange: (next) => { dispatch({ type: "setViewport", viewport: next }); },
    enablePanDrag,
    onPointerDownOther,
  });
```

⚠️ ПОРЯДОК КРИТИЧЕН: `enablePanDrag`/`onPointerDownOther` — `const`-стрелки (НЕ хойстятся). Вызов `usePanZoom` ДОЛЖЕН идти ПОСЛЕ их объявления, иначе TDZ-`ReferenceError` в рантайме (не просто lint). Хук вызывается безусловно в теле компонента (rules-of-hooks соблюдены — не в ветке).

- [ ] **Step 7: Remove the React `onPointerDown` from the surface div** — в JSX `ContextMenu.Trigger`'s `<div ref={surfaceRef} …>` (строки 668–682) удалить проп `onPointerDown={onSurfacePointerDown}` (хук вешает pointerdown сам). Оставить `onPointerMove={onPointerMove}` и `onPointerUp={onPointerUp}` (ведут не-пановые drag'и). `touchAction: "none"` уже стоит — пинч заработает.

- [ ] **Step 8: Verify gate**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: зелёное. Починить любые «unused» (`resolveWheel`, `vp` в onPointerMove) и `no-use-before-define`, как отмечено выше.

- [ ] **Step 9: Браузер-регресс редактора (`/canvases/new` и `/canvases/[id]/edit`)** — подтвердить КАЖДЫЙ пункт:
- [ ] Зум: `ctrl/cmd`+колесо → у курсора; обычное колесо → пан; `shift`+колесо → гориз.
- [ ] Пан: средняя кнопка мыши; зажатый `Space` (курсор grab); инструмент Hand (`H`); один палец на тач.
- [ ] Тач: два пальца → пинч-зум (бонус от хука).
- [ ] Select-инструмент: клик по узлу выделяет; drag узла двигает; `Shift/Cmd`-клик — аддитивно.
- [ ] Маркиза: drag по фону (select-tool) рисует рамку и выделяет узлы; аддитивная с Shift.
- [ ] Resize: тянуть ручки выделенного узла.
- [ ] Рёбра: тянуть от порта к другому узлу — ребро создаётся, подсветка цели.
- [ ] Двойной клик по text/shape → инлайн-редактор; Esc/blur.
- [ ] Контекст-меню (правый клик по узлу): «Центрировать», z-order, удалить; по фону — не открывается.
- [ ] Клавиши: Delete/Backspace, Undo/Redo (`Cmd+Z`/`Cmd+Shift+Z`), стрелки-nudge, `Cmd+]`/`Cmd+[`, `Shift+1` (fit), `Shift+R` (линейки), `V`/`H`.
- [ ] Тулбар «Показать всё» (fit) и линейки.
- [ ] Сохранение (create POST + edit PUT) и dirty-guard работают.

- [ ] **Step 10: Commit**

```bash
git add src/features/canvas/ui/canvas-editor.tsx
git commit -m "refactor(canvas): редактор на общий usePanZoom (единый источник жестов)"
```

---

## Self-Review

**Spec coverage:**
- Подход B (CanvasViewer + сохранённый CanvasRender) → Tasks 1, 3, 4. ✔
- `CanvasScene` извлечение → Task 1. ✔
- `usePanZoom` общий, controlled, wheel+drag+пинч → Task 2. ✔
- Статичная ветка = текущий SSR (no-JS фолбэк, без mismatch) → Task 3 (Step 4 + тест «-24 -24 148 148»). ✔
- Мини-тулбар `[−][NN%][+][⤢]`, kit-only → Task 3 (Step 4, IconButton/Button). ✔
- Начальный fit, лимиты/шаг из coords, без персиста → Task 3. ✔
- Применяется на /canvases/[id] и в ревизиях → Task 4 (единая точка CanvasDetail; QA обоих). ✔
- Рефактор редактора на хук + браузер-регресс → Task 5. ✔
- i18n клиентский (как редактор), без сериализации → Task 3/4. ✔
- Бэкенд не трогаем → нет задач по бэку. ✔

**Placeholder scan:** нет TBD/«handle errors»/«similar to»; весь код приведён целиком; команды и ожидаемый вывод указаны. i18n ar/zh — явный стопгап (en-значения) с пометкой на вычитку, не плейсхолдер. ✔

**Type consistency:** `Viewport` един во всех задачах (из `editor-types`); `UsePanZoomOptions.viewport: Viewport | null`, `onViewportChange: (Viewport)=>void` совпадают с вызовами в CanvasViewer и редакторе; `CanvasSceneProps` совпадает между Task 1 (объявление) и Task 3 (использование); `CANVAS_MARGIN` экспортируется в Task 1 и импортируется в Task 3; `fitViewport(bbox, size)` сигнатура совпадает с coords. ✔
