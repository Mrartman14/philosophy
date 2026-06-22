# Reference Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать публичную страницу `/graph` — вторую 3D-визуализацию корпуса рядом с картой смыслов: облако узлов (документы + термины глоссария) по PCA-координатам + направленные взвешенные рёбра явных ссылок, режимы 2D/3D, навигация по клику на узел в `/documents/{id}`|`/glossary/{id}`. Попутно вынести общий Three-каркас рендера карты в foundation-модуль и мигрировать рендерер карты на него — ноль дублирования каркаса.

**Architecture:** Рендерер карты (`ThreeMapRenderer`) делится на ~80% общего каркаса (WebGL/сцена/орто+перспектива камеры/OrbitControls/`resize` aspect-only/`fitToBounds`/`getViewProjection` с ручным inverse/render-loop/`onPick`+drag-suppress/облако точек) и ~20% карто-дельты (`setOverlay` поиска + ring-`marker`). Каркас выносится в foundation-модуль `src/components/scene-3d/` (вне слайсов — ESLint запрещает cross-feature/deep-импорты, так что общая база не может жить в слайсе `semantic-map`): порт `SceneRenderer`, общая модель `SceneRenderModel`, базовый класс `ThreeSceneRenderer`, pure-хелперы `project`/`camera-fit`/`pick`/`palette`, обобщённые UI-шеллы `scene-state-panel`/`scene-mode-toggle`/`scene-region-labels`. Карта мигрирует: `ThreeMapRenderer extends ThreeSceneRenderer`, оставляя ТОЛЬКО `setOverlay`+marker. Граф — новый слайс `src/features/reference-graph/` по `_template`: `ThreeGraphRenderer extends ThreeSceneRenderer` добавляет слой рёбер (`LineSegments`); узлы красятся по `type` в pure-`to-graph-render-model`; клик → `router.push(nodeHref(type, id))`. three.js скрыт за портом — view три-агностичен.

**Tech Stack:** Next.js App Router, TypeScript, three.js (за портом), openapi-fetch, next-intl, vitest + @testing-library/react, pnpm.

**Спека:** [docs/superpowers/specs/2026-06-22-reference-graph-design.md](../specs/2026-06-22-reference-graph-design.md)

## Global Constraints
- pnpm only; green `pnpm lint && pnpm test && pnpm build` before PR.
- kebab-case filenames in src/.
- Foundation-zone: creating src/components/scene-3d/ + migrating semantic-map/renderer is coordinated; the map MUST NOT change behavior (its tests are the regression net).
- No cross-feature imports; the graph slice gets all shared rendering from src/components/scene-3d/ (shared infra), never from features/semantic-map.
- git add ONLY named files (`git commit --only`); no add -A/. , no stash/reset/checkout ./clean; don't touch other agents' changes.
- Each commit ends with: Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Контекст контракта бэкенда (verbatim, из `src/api/schema.ts`)

```ts
"refgraph.Graph":  { bounds?: refgraph.Bounds; dims?: number; edges?: refgraph.Edge[];
                     layout_version?: string; nodes?: refgraph.Node[] }
"refgraph.Node":   { coords?: number[]; degree?: number; id?: string; title?: string; type?: string }
"refgraph.Edge":   { kind?: string; source?: refgraph.NodeRef; target?: refgraph.NodeRef; weight?: number }
"refgraph.NodeRef":{ id?: string; type?: string }
"refgraph.Bounds": { max?: number[]; min?: number[] }
```

`GET /api/graph`: 200 `httputil.Response & { data?: refgraph.Graph }`, 304, 401 (optional-auth), 503 `GRAPH_NOT_READY`. Все поля контракта optional — устойчивость живёт в `to-graph-render-model`.

**FE-стопгап (открытый бэк-аск, спека §99–107):** трактуем `node.type` как `"document" | "glossary"`, `edge.kind` как `*_ref`; неизвестный `type` → узел без навигации (onPick no-op на нём) + нейтральный цвет. Помечаем TODO в `node-route.ts`/`to-graph-render-model.ts` со ссылкой на бэк-аск.

---

## File Structure

**Создаём (foundation `src/components/scene-3d/`):**
- `scene-renderer.ts` — порт `SceneRenderer` + `SceneRenderMode`.
- `scene-render-model.ts` — общая форма `SceneRenderModel`.
- `three-scene-renderer.ts` — базовый Three-класс.
- `three-scene-renderer.test.ts` — тест каркаса базы (мок three, как у карты).
- `ui/scene-state-panel.tsx` — обобщённая панель «строится/ошибка» (label-props).
- `ui/scene-mode-toggle.tsx` — обобщённый тоггл 2D/3D + `storageKey`-проп.
- `ui/scene-mode-toggle.test.tsx` — тест тоггла.
- `ui/scene-region-labels.tsx` — обобщённые проецируемые подписи.
- `index.ts` — публичный barrel модуля.

**Перемещаем (move + re-point, `semantic-map/renderer/*` → `scene-3d/*`):**
- `renderer/project.ts`(+`.test.ts`) → `scene-3d/project.ts`(+`.test.ts`).
- `renderer/camera-fit.ts`(+`.test.ts`) → `scene-3d/camera-fit.ts`(+`.test.ts`).
- `renderer/pick.ts`(+`.test.ts`) → `scene-3d/pick.ts`(+`.test.ts`).
- `palette.ts`(+`.test.ts`) → `scene-3d/palette.ts`(+`.test.ts`).

**Изменяем (миграция карты, без смены поведения):**
- `src/features/semantic-map/renderer/three-map-renderer.ts` — `extends ThreeSceneRenderer`, оставляет только `setOverlay`+marker.
- `src/features/semantic-map/renderer/map-renderer.ts` — `MapRenderer extends SceneRenderer` + `setOverlay`.
- `src/features/semantic-map/renderer/index.ts` — реэкспорты переезжают на `scene-3d`.
- `src/features/semantic-map/types.ts` — `RenderModel = SceneRenderModel & { docs; clusters }`.
- `src/features/semantic-map/to-render-model.ts` — импорт `palette` из `scene-3d`.
- `src/features/semantic-map/overlay/match-overlay.ts` — тип `RenderModel` (без правок логики, но проверить компиляцию).
- `src/features/semantic-map/ui/semantic-map-view.tsx` — импорты `projectToScreen`/шеллов переезжают на `scene-3d`; `SceneModeToggle`/`SceneRegionLabels`/`SceneStatePanel` с label-props.
- `src/features/semantic-map/ui/map-mode-toggle.tsx`, `ui/map-region-labels.tsx`, `ui/map-state-panel.tsx` — становятся тонкими адаптерами над `scene-3d`-шеллами (передают semanticMap-лейблы) ЛИБО удаляются с заменой call-site (см. Task 4, выбран адаптерный путь — низкий churn).
- `src/features/semantic-map/index.ts` — `MapStatePanel` остаётся в публичном API (адаптер).
- `*.test.ts(x)` карты — обновляются ТОЛЬКО пути импортов; ассерты не трогаем.

**Создаём (граф-слайс `src/features/reference-graph/`):**
- `api.ts`(+`.test.ts`) — `getGraph(): Promise<GraphResult>`.
- `types.ts` — сужения `refgraph.*` + `GraphRenderModel`.
- `to-graph-render-model.ts`(+`.test.ts`) — pure `refgraph.Graph → GraphRenderModel`.
- `node-route.ts`(+`.test.ts`) — pure `nodeHref(type, id)`.
- `ui/three-graph-renderer.ts`(+`.test.ts`) — `extends ThreeSceneRenderer` + рёбра.
- `ui/graph-view.tsx`(+`.test.tsx`) — lifecycle + mode-toggle + region-labels + onPick→navigate.
- `ui/graph.tsx` — lazy client-обёртка.
- `index.ts` — публичный barrel слайса.
- `src/app/graph/page.tsx` — server-страница.
- `src/i18n/messages/ru/referenceGraph.ts`, `src/i18n/messages/en/referenceGraph.ts` — namespace.

**Изменяем (i18n регистрация):**
- `src/i18n/messages/ru/index.ts`, `src/i18n/messages/en/index.ts` — импорт + ключ `referenceGraph`.
- `src/i18n/messages/ru/pages.ts`, `src/i18n/messages/en/pages.ts` — `graphTitle`.

---

# Phase 1 — Foundation (`scene-3d`) + миграция карты

> Каждая Task этой фазы завершается ЗЕЛЁНЫМ полным набором тестов карты — это регресс-сеть миграции. Поведение карты обязано сохраниться байт-в-байт; меняем ТОЛЬКО пути импортов и наследование, не ассерты.

---

### Task 1: Перенос pure-хелперов и `palette` в `scene-3d` + re-point карты

**Files:**
- Move: `src/features/semantic-map/renderer/project.ts` → `src/components/scene-3d/project.ts`
- Move: `src/features/semantic-map/renderer/project.test.ts` → `src/components/scene-3d/project.test.ts`
- Move: `src/features/semantic-map/renderer/camera-fit.ts` → `src/components/scene-3d/camera-fit.ts`
- Move: `src/features/semantic-map/renderer/camera-fit.test.ts` → `src/components/scene-3d/camera-fit.test.ts`
- Move: `src/features/semantic-map/renderer/pick.ts` → `src/components/scene-3d/pick.ts`
- Move: `src/features/semantic-map/renderer/pick.test.ts` → `src/components/scene-3d/pick.test.ts`
- Move: `src/features/semantic-map/palette.ts` → `src/components/scene-3d/palette.ts`
- Move: `src/features/semantic-map/palette.test.ts` → `src/components/scene-3d/palette.test.ts`
- Create: `src/components/scene-3d/index.ts`
- Modify: `src/features/semantic-map/to-render-model.ts` (импорт `palette` из `@/components/scene-3d`)
- Modify: `src/features/semantic-map/renderer/three-map-renderer.ts` (импорт `fit2D`/`fit3D`/`pickNearestPoint` из `@/components/scene-3d`)
- Modify: `src/features/semantic-map/renderer/index.ts` (реэкспорт `projectToScreen`/`pickNearestPoint` из `@/components/scene-3d`)
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx` (импорт `projectToScreen` из `@/components/scene-3d`)

**Interfaces:**
- Produces (перенос без смены сигнатур):
  - `scene-3d/project.ts`: `projectToScreen(p: [number,number,number], viewProj: ArrayLike<number>, width: number, height: number): { x: number; y: number; visible: boolean }`
  - `scene-3d/camera-fit.ts`: `fit2D(min, max, aspect, pad?): Frame2D`, `fit3D(min, max, fovDeg, pad?): Frame3D`, типы `Frame2D`/`Frame3D`
  - `scene-3d/pick.ts`: `pickNearestPoint(positions, count, viewProj, width, height, px, py, threshold): number`
  - `scene-3d/palette.ts`: `clusterColor(id: number, explicit?: string | null): string`, `hexToRgb01(hex: string): [number,number,number]`
  - `scene-3d/index.ts` реэкспортит всё перечисленное.
- Consumes: карта импортит их из `@/components/scene-3d` (это `src/components/*` — shared infra, не cross-feature импорт).

Спека §57–65, §128–130: pure-хелперы переезжают со своими тестами; `palette` обобщается (имена `clusterColor`/`hexToRgb01` сохраняем — граф зовёт `hexToRgb01`, карта — оба).

- [ ] **Step 1: Физически переместить файлы (git mv) — содержимое не меняем**

```bash
mkdir -p src/components/scene-3d
git mv src/features/semantic-map/renderer/project.ts        src/components/scene-3d/project.ts
git mv src/features/semantic-map/renderer/project.test.ts   src/components/scene-3d/project.test.ts
git mv src/features/semantic-map/renderer/camera-fit.ts      src/components/scene-3d/camera-fit.ts
git mv src/features/semantic-map/renderer/camera-fit.test.ts src/components/scene-3d/camera-fit.test.ts
git mv src/features/semantic-map/renderer/pick.ts            src/components/scene-3d/pick.ts
git mv src/features/semantic-map/renderer/pick.test.ts       src/components/scene-3d/pick.test.ts
git mv src/features/semantic-map/palette.ts                  src/components/scene-3d/palette.ts
git mv src/features/semantic-map/palette.test.ts             src/components/scene-3d/palette.test.ts
```

Внутри `scene-3d/pick.ts` импорт `projectToScreen` остаётся относительным (`./project`) — оба файла теперь в `scene-3d`, путь не меняется. `pick.test.ts`/`project.test.ts`/`camera-fit.test.ts`/`palette.test.ts` импортят соседей через `./…` — после перемещения пути корректны без правок.

- [ ] **Step 2: Создать barrel `scene-3d/index.ts`**

```ts
// src/components/scene-3d/index.ts
// Публичный API foundation-модуля 3D-сцены: pure-хелперы + (после Task 2-3) база/порт/шеллы.
// Слайсы импортируют отсюда (src/components/* — shared infra, не cross-feature).
export { projectToScreen } from "./project";
export { pickNearestPoint } from "./pick";
export { fit2D, fit3D, type Frame2D, type Frame3D } from "./camera-fit";
export { clusterColor, hexToRgb01 } from "./palette";
```

- [ ] **Step 3: Re-point импортов карты на новые пути**

`src/features/semantic-map/to-render-model.ts` — строка `import { clusterColor, hexToRgb01 } from "./palette";` → `from "@/components/scene-3d";`

`src/features/semantic-map/renderer/three-map-renderer.ts`:
- `import { fit2D, fit3D } from "./camera-fit";` → `from "@/components/scene-3d";`
- `import { pickNearestPoint } from "./pick";` → `from "@/components/scene-3d";`

`src/features/semantic-map/renderer/index.ts` — `projectToScreen`/`pickNearestPoint` теперь реэкспортятся из `scene-3d` (барреля рендерера карта потребляет в view):

```ts
// src/features/semantic-map/renderer/index.ts
export type { MapRenderer, RenderMode } from "./map-renderer";
export { ThreeMapRenderer } from "./three-map-renderer";
export { projectToScreen } from "@/components/scene-3d";
export { pickNearestPoint } from "@/components/scene-3d";
```

`src/features/semantic-map/ui/semantic-map-view.tsx` — импорт `projectToScreen` (строка 10 `import { ThreeMapRenderer, projectToScreen } from "../renderer";`) оставляем как есть: рендерер-барелл уже реэкспортит `projectToScreen` из `scene-3d`. Правок в view на этом шаге НЕ требуется.

- [ ] **Step 4: Прогнать перенесённые тесты на новом месте — убедиться, что зелено**

Run: `pnpm exec vitest run src/components/scene-3d/project.test.ts src/components/scene-3d/camera-fit.test.ts src/components/scene-3d/pick.test.ts src/components/scene-3d/palette.test.ts`
Expected: PASS (тесты переехали без правок — это та же математика, новый путь).

- [ ] **Step 5: Прогнать регресс-сеть карты — убедиться, что зелено**

Run: `pnpm exec vitest run src/features/semantic-map`
Expected: PASS — карта теперь тянет helpers/palette из `scene-3d`, ассерты не менялись. Если красно — починить путь импорта, НЕ ассерт.

- [ ] **Step 6: Commit**

```bash
git add src/components/scene-3d/project.ts src/components/scene-3d/project.test.ts \
  src/components/scene-3d/camera-fit.ts src/components/scene-3d/camera-fit.test.ts \
  src/components/scene-3d/pick.ts src/components/scene-3d/pick.test.ts \
  src/components/scene-3d/palette.ts src/components/scene-3d/palette.test.ts \
  src/components/scene-3d/index.ts \
  src/features/semantic-map/to-render-model.ts \
  src/features/semantic-map/renderer/three-map-renderer.ts \
  src/features/semantic-map/renderer/index.ts
git commit -m "refactor(scene-3d): вынести pure-хелперы рендера (project/camera-fit/pick/palette) в foundation

Карта re-pointит импорты на @/components/scene-3d; поведение и тесты неизменны.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Порт `SceneRenderer` + модель `SceneRenderModel` + базовый класс `ThreeSceneRenderer`

**Files:**
- Create: `src/components/scene-3d/scene-renderer.ts`
- Create: `src/components/scene-3d/scene-render-model.ts`
- Create: `src/components/scene-3d/three-scene-renderer.ts`
- Create: `src/components/scene-3d/three-scene-renderer.test.ts`
- Modify: `src/components/scene-3d/index.ts` (реэкспорт нового)

**Interfaces:**
- Produces:
  - `scene-render-model.ts`:
    ```ts
    export interface SceneRenderModel {
      count: number;
      positions: Float32Array;  // count*3
      colors: Float32Array;     // count*3, RGB 0..1
      ids: string[];
      bounds: { min: [number, number, number]; max: [number, number, number] };
    }
    ```
  - `scene-renderer.ts`:
    ```ts
    export type SceneRenderMode = "2d" | "3d";
    export interface SceneRenderer {
      mount(canvas: HTMLCanvasElement): void;
      setModel(model: SceneRenderModel): void;
      setMode(mode: SceneRenderMode): void;
      fitToBounds(): void;
      resize(width: number, height: number, dpr: number): void;
      getViewProjection(): Float32Array | null;
      onChange(cb: () => void): void;
      onPick?(cb: (id: string | null) => void): void;
      setReducedMotion(reduce: boolean): void;
      destroy(): void;
    }
    ```
    > Это текущий `MapRenderer` МИНУС `setOverlay`. `setOverlay` остаётся карто-дельтой (Task 3).
  - `three-scene-renderer.ts`: `export class ThreeSceneRenderer implements SceneRenderer` — владеет сценой/орто+перспектива камерами/OrbitControls/mount(+pointer-листенеры)/resize(aspect-only)/fitToBounds/getViewProjection/render-loop/onChange/onPick(+pickNearestPoint+drag-suppress+toLocal)/облаком точек в `setModel`. Protected-доступ для подклассов: `scene`, `model`, `colorAttr`, `baseColors`, `requestRender()`, хук `onModelApplied()`, хук `disposeLayers()`.
- Consumes: `three`, `OrbitControls`, `fit2D`/`fit3D`/`pickNearestPoint` из `./camera-fit`/`./pick`.

Спека §57–60: база НЕ знает про overlay/рёбра; подклассы добавляют слои через protected `scene` + хук(и). Тонкости, ради которых не дублируем: ручной inverse в `getViewProjection`, aspect-only resize, drag-suppress в onPick.

- [ ] **Step 1: Написать падающий тест базы (мок three, по образцу three-map-renderer.test.ts)**

```ts
// src/components/scene-3d/three-scene-renderer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    enableDamping = true;
    enableRotate = true;
    mouseButtons: Record<string, unknown> = {};
    target = { set: vi.fn() };
    update = vi.fn();
    addEventListener = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock("three", async (importActual) => {
  const actual = await importActual<typeof import("three")>();
  class FakeWebGLRenderer {
    domElement = {} as HTMLCanvasElement;
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import { ThreeSceneRenderer } from "./three-scene-renderer";
import type { SceneRenderModel } from "./scene-render-model";

function pickCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 200,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function model1(): SceneRenderModel {
  return {
    count: 1,
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 1, 1]),
    ids: ["pt-A"],
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  };
}

function down(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: x, clientY: y }));
}
function up(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: x, clientY: y }));
}

interface WithControls {
  controls: { enableDamping: boolean } | null;
}

describe("ThreeSceneRenderer base scaffolding", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("setReducedMotion до mount не бросает; после mount правит damping", () => {
    const r = new ThreeSceneRenderer();
    expect(() => { r.setReducedMotion(true); }).not.toThrow();
    r.mount(pickCanvas());
    expect((r as unknown as WithControls).controls?.enableDamping).toBe(false);
    r.setReducedMotion(false);
    expect((r as unknown as WithControls).controls?.enableDamping).toBe(true);
    r.destroy();
  });

  it("клик по точке → onPick(point.id)", () => {
    const r = new ThreeSceneRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 100, 50);
    up(canvas, 100, 50);
    expect(cb).toHaveBeenCalledWith("pt-A");
    r.destroy();
  });

  it("драг (смещение > порога) НЕ триггерит pick", () => {
    const r = new ThreeSceneRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 100, 50);
    up(canvas, 140, 80);
    expect(cb).not.toHaveBeenCalled();
    r.destroy();
  });

  it("onModelApplied вызывается после setModel (хук для подклассов)", () => {
    const hook = vi.fn();
    class Probe extends ThreeSceneRenderer {
      protected override onModelApplied(): void { hook(); }
    }
    const r = new Probe();
    r.mount(pickCanvas());
    r.setModel(model1());
    expect(hook).toHaveBeenCalledOnce();
    r.destroy();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/components/scene-3d/three-scene-renderer.test.ts`
Expected: FAIL — `Cannot find module "./three-scene-renderer"` (и `./scene-render-model`).

- [ ] **Step 3: Реализовать модель и порт**

```ts
// src/components/scene-3d/scene-render-model.ts
// Общая форма облака точек для базового рендерера. Доменные модели расширяют её:
// карта — { docs; clusters }, граф — { edges; edgeAlphas; types }.
export interface SceneRenderModel {
  count: number;
  /** count*3, всегда 3 координаты (z=0 при dims<3). */
  positions: Float32Array;
  /** count*3, RGB 0..1. */
  colors: Float32Array;
  /** id узла/точки — ключ для onPick. */
  ids: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
}
```

```ts
// src/components/scene-3d/scene-renderer.ts
// Порт базового 3D-рендерера: способность нарисовать облако точек + камеры/режимы/picking.
// three.js скрыт в реализации; UI-слой знает только этот интерфейс. = MapRenderer МИНУС setOverlay
// (overlay — карто-дельта, объявлена на собственном интерфейсе/классе карты).
import type { SceneRenderModel } from "./scene-render-model";

export type SceneRenderMode = "2d" | "3d";

export interface SceneRenderer {
  /** Привязать к <canvas> и запустить render-loop. */
  mount(canvas: HTMLCanvasElement): void;
  /** Загрузить/заменить данные (строит буферы, подгоняет камеру). */
  setModel(model: SceneRenderModel): void;
  /** Переключить 2D⇄3D на тех же буферах. */
  setMode(mode: SceneRenderMode): void;
  /** Подогнать камеру под bounds текущей модели. */
  fitToBounds(): void;
  /** Сообщить новый размер вьюпорта (CSS-пиксели) и DPR. */
  resize(width: number, height: number, dpr: number): void;
  /** Column-major 4×4 view-projection активной камеры (для overlay-подписей). null до mount/model. */
  getViewProjection(): Float32Array | null;
  /** Подписка на каждый отрисованный кадр (для синхронизации HTML-overlay подписей). */
  onChange(cb: () => void): void;
  /** Click-picking: cb с id ближайшей точки либо null. */
  onPick?(cb: (id: string | null) => void): void;
  /** Уменьшить движение: выключает инерцию камеры (OrbitControls damping). */
  setReducedMotion(reduce: boolean): void;
  /** Освободить GPU-ресурсы и остановить loop. */
  destroy(): void;
}
```

- [ ] **Step 4: Реализовать базовый класс (перенести весь каркас из `ThreeMapRenderer`)**

```ts
// src/components/scene-3d/three-scene-renderer.ts
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { fit2D, fit3D } from "./camera-fit";
import { pickNearestPoint } from "./pick";
import type { SceneRenderModel } from "./scene-render-model";
import type { SceneRenderer, SceneRenderMode } from "./scene-renderer";

const PICK_THRESHOLD_PX = 10; // радиус попадания по точке
const DRAG_SUPPRESS_PX = 5; // смещение, выше которого жест — драг, не клик

/**
 * Базовый Three-рендерер облака точек: сцена, орто/перспектива камеры (2D/3D),
 * OrbitControls, mount/resize (aspect-only), fitToBounds, getViewProjection (ручной inverse),
 * render-loop, onPick (drag-suppress) и слой точек. Доменные рендереры НАСЛЕДУЮТ его и
 * добавляют свои слои через protected `scene` + хуки `onModelApplied`/`disposeLayers`.
 */
export class ThreeSceneRenderer implements SceneRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  protected readonly scene = new THREE.Scene();
  private readonly ortho: THREE.OrthographicCamera;
  private readonly persp: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private points: THREE.Points | null = null;
  protected model: SceneRenderModel | null = null;
  private mode: SceneRenderMode = "2d";
  private width = 1;
  private height = 1;
  private dpr = 1;
  /** Полу-высота ортокадра (мировые ед.) — для aspect-only ресайза без перекадрирования. */
  private orthoHalfH = 1;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private changeCb: (() => void) | null = null;
  /** Рабочий буфер цвета атрибута (мутируется подклассом-overlay'ем). */
  protected baseColors: Float32Array | null = null;
  protected colorAttr: THREE.BufferAttribute | null = null;
  private reducedMotion = false;
  private canvas: HTMLCanvasElement | null = null;
  private pickCb: ((id: string | null) => void) | null = null;
  private downAt: { x: number; y: number } | null = null;

  constructor() {
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    this.persp = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
  }

  mount(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.applyMode();
    this.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1);
    this.dirty = true;
    this.loop();
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
  }

  setModel(model: SceneRenderModel): void {
    this.model = model;
    if (this.points) {
      this.scene.remove(this.points);
      disposePoints(this.points);
      this.points = null;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(model.positions, 3));
    const working = model.colors.slice(); // рабочий буфер (подкласс может перекрасить)
    const colorAttr = new THREE.BufferAttribute(working, 3);
    geom.setAttribute("color", colorAttr);
    this.colorAttr = colorAttr;
    this.baseColors = model.colors; // неизменяемая база (read-only для overlay подкласса)
    const mat = new THREE.PointsMaterial({
      size: 3,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.points = new THREE.Points(geom, mat);
    this.scene.add(this.points);
    this.onModelApplied(); // хук подкласса: пересобрать доменные слои (карта: marker; граф: рёбра)
    this.fitToBounds();
  }

  /** Хук жизненного цикла: вызывается в конце setModel. Подкласс перестраивает свои слои. */
  protected onModelApplied(): void {}

  /** Хук уборки: подкласс освобождает свои меши. Вызывается из destroy() ДО базового teardown. */
  protected disposeLayers(): void {}

  /** Подкласс просит перерисовку (после мутации цвета/слоёв). */
  protected requestRender(): void {
    this.dirty = true;
  }

  setMode(mode: SceneRenderMode): void {
    if (mode === this.mode && this.controls) return;
    this.mode = mode;
    this.applyMode();
  }

  setReducedMotion(reduce: boolean): void {
    this.reducedMotion = reduce;
    if (this.controls) {
      this.controls.enableDamping = !reduce;
      this.dirty = true;
    }
  }

  private applyMode(): void {
    if (this.controls) this.controls.dispose();
    const cam = this.activeCamera();
    if (this.renderer) {
      this.controls = new OrbitControls(cam, this.renderer.domElement);
      this.controls.enableDamping = !this.reducedMotion;
      this.controls.enableRotate = this.mode === "3d";
      if (this.mode === "2d") {
        this.controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
      }
      this.controls.addEventListener("change", () => {
        this.dirty = true;
      });
    }
    this.fitToBounds();
  }

  private activeCamera(): THREE.Camera {
    return this.mode === "3d" ? this.persp : this.ortho;
  }

  fitToBounds(): void {
    if (!this.model) return;
    const { min, max } = this.model.bounds;
    const aspect = this.width / this.height || 1;
    if (this.mode === "2d") {
      const f = fit2D(min, max, aspect);
      this.orthoHalfH = f.halfH;
      this.ortho.left = -f.halfH * aspect;
      this.ortho.right = f.halfH * aspect;
      this.ortho.top = f.halfH;
      this.ortho.bottom = -f.halfH;
      this.ortho.zoom = 1;
      this.ortho.position.set(f.centerX, f.centerY, 10);
      this.ortho.up.set(0, 1, 0);
      this.ortho.lookAt(f.centerX, f.centerY, 0);
      this.ortho.updateProjectionMatrix();
      if (this.controls) {
        this.controls.target.set(f.centerX, f.centerY, 0);
        this.controls.update();
      }
    } else {
      const f = fit3D(min, max, this.persp.fov, 1.3);
      this.persp.position.set(
        f.center[0] + f.distance * 0.6,
        f.center[1] + f.distance * 0.4,
        f.center[2] + f.distance * 0.8,
      );
      this.persp.lookAt(f.center[0], f.center[1], f.center[2]);
      this.persp.updateProjectionMatrix();
      if (this.controls) {
        this.controls.target.set(f.center[0], f.center[1], f.center[2]);
        this.controls.update();
      }
    }
    this.dirty = true;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = Math.min(dpr, 2);
    if (this.renderer) {
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.width, this.height, false);
    }
    const aspect = this.width / this.height;
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
    this.ortho.left = -this.orthoHalfH * aspect;
    this.ortho.right = this.orthoHalfH * aspect;
    this.ortho.top = this.orthoHalfH;
    this.ortho.bottom = -this.orthoHalfH;
    this.ortho.updateProjectionMatrix();
    this.dirty = true;
  }

  getViewProjection(): Float32Array | null {
    if (!this.renderer) return null;
    const cam = this.activeCamera() as THREE.OrthographicCamera | THREE.PerspectiveCamera;
    cam.updateMatrixWorld();
    const viewInverse = cam.matrixWorld.clone().invert();
    const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, viewInverse);
    return new Float32Array(m.elements);
  }

  onChange(cb: () => void): void {
    this.changeCb = cb;
  }

  onPick(cb: (id: string | null) => void): void {
    this.pickCb = cb;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.downAt = this.toLocal(e);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const down = this.downAt;
    this.downAt = null;
    if (!down || !this.pickCb) return;
    const up = this.toLocal(e);
    if (Math.hypot(up.x - down.x, up.y - down.y) > DRAG_SUPPRESS_PX) return;
    if (!this.model || this.model.count === 0) {
      this.pickCb(null);
      return;
    }
    const vp = this.getViewProjection();
    if (!vp) {
      this.pickCb(null);
      return;
    }
    const idx = pickNearestPoint(
      this.model.positions,
      this.model.count,
      vp,
      this.width,
      this.height,
      up.x,
      up.y,
      PICK_THRESHOLD_PX,
    );
    this.pickCb(idx >= 0 ? this.model.ids[idx] ?? null : null);
  };

  /** clientX/Y → canvas-local пиксели (CSS-пиксели, как width/height рендерера). */
  private toLocal(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas?.getBoundingClientRect();
    return rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : { x: e.clientX, y: e.clientY };
  }

  private readonly loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.controls?.enableDamping) this.controls.update();
    if (!this.dirty || !this.renderer) return;
    this.renderer.render(this.scene, this.activeCamera());
    this.dirty = false;
    this.changeCb?.();
  };

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
    }
    this.canvas = null;
    this.pickCb = null;
    this.downAt = null;
    this.controls?.dispose();
    this.disposeLayers(); // подкласс освобождает свои меши ДО базового teardown
    if (this.points) disposePoints(this.points);
    this.points = null;
    this.colorAttr = null;
    this.baseColors = null;
    this.renderer?.dispose();
    this.renderer = null;
  }
}

function disposePoints(p: THREE.Points): void {
  p.geometry.dispose();
  const m = p.material;
  if (Array.isArray(m)) m.forEach((x) => { x.dispose(); });
  else m.dispose();
}
```

- [ ] **Step 5: Реэкспорт нового в barrel**

В `src/components/scene-3d/index.ts` добавить:

```ts
export type { SceneRenderer, SceneRenderMode } from "./scene-renderer";
export type { SceneRenderModel } from "./scene-render-model";
export { ThreeSceneRenderer } from "./three-scene-renderer";
```

- [ ] **Step 6: Запустить тест базы — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/scene-3d/three-scene-renderer.test.ts`
Expected: PASS (4 теста: setReducedMotion, pick-hit, drag-suppress, onModelApplied).

- [ ] **Step 7: Commit**

```bash
git add src/components/scene-3d/scene-renderer.ts src/components/scene-3d/scene-render-model.ts \
  src/components/scene-3d/three-scene-renderer.ts src/components/scene-3d/three-scene-renderer.test.ts \
  src/components/scene-3d/index.ts
git commit -m "feat(scene-3d): порт SceneRenderer + SceneRenderModel + базовый ThreeSceneRenderer

Каркас сцены/камер/контролов/loop/resize/fit/getViewProjection/onPick/облако точек
с protected-хуками onModelApplied/disposeLayers/requestRender для подклассов.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Миграция `ThreeMapRenderer` на базу (оставить только `setOverlay` + marker)

**Files:**
- Modify: `src/features/semantic-map/renderer/map-renderer.ts`
- Modify: `src/features/semantic-map/renderer/three-map-renderer.ts`
- Modify: `src/features/semantic-map/types.ts`

**Interfaces:**
- Produces:
  - `map-renderer.ts`: `RenderMode = SceneRenderMode`; `MapRenderer extends SceneRenderer` + `setOverlay(overlay: MapOverlayState | null): void`; `MapOverlayState { highlightIds: Set<string>; marker: [number,number,number] | null }`.
  - `three-map-renderer.ts`: `ThreeMapRenderer extends ThreeSceneRenderer implements MapRenderer` — добавляет `setOverlay` (recolor через protected `colorAttr`/`baseColors`), `marker`, `updateMarker`, `makeRingTexture`; `override onModelApplied()` прячет устаревший marker; `override disposeLayers()` освобождает marker.
  - `types.ts`: `RenderModel = SceneRenderModel & { docs: string[]; clusters: RenderCluster[] }`.
- Consumes: `ThreeSceneRenderer`, `SceneRenderer`, `SceneRenderMode`, `SceneRenderModel` из `@/components/scene-3d`.

Спека §67–68: карта оставляет ТОЛЬКО дельту. Поведение байт-в-байт — старые тесты `three-map-renderer.test.ts` зелёные без правок ассертов.

- [ ] **Step 1: Переопределить `RenderModel` через `SceneRenderModel`**

`src/features/semantic-map/types.ts` — НЕ трогаем существующие type-алиасы (`MapBounds`/`MapPoint`/`MapTreeNode`/`MapData`/`MapPointDetail` из `semmap.*`) и `MapOverlay`; добавляем импорт `SceneRenderModel` и переписываем ТОЛЬКО `interface RenderModel` → `type RenderModel`. Итоговый вид нового импорта + блока `RenderCluster`/`RenderModel`:

```ts
import type { SceneRenderModel } from "@/components/scene-3d";
// (существующий `import type { components } from "@/api/schema";` и алиасы MapBounds/MapPoint/… остаются)

export interface RenderCluster {
  id: number;
  label: string;
  color: string;
  size: number;
  centroid: [number, number, number];
}

/** Модель карты = общая форма облака + карто-специфика (docs для матча оверлея, clusters для подписей). */
export type RenderModel = SceneRenderModel & {
  /** point.doc — ключ матча оверлея поиска (хиты несут id документов, точки — чанки). */
  docs: string[];
  clusters: RenderCluster[];
};
```

> `count`/`positions`/`colors`/`ids`/`bounds` теперь приходят из `SceneRenderModel` — `to-render-model.ts` уже их заполняет, форма совместима.

- [ ] **Step 2: Переопределить порт карты через `SceneRenderer`**

`src/features/semantic-map/renderer/map-renderer.ts`:

```ts
// src/features/semantic-map/renderer/map-renderer.ts
// Порт рендерера карты = базовый SceneRenderer + карто-дельта setOverlay.
import type { SceneRenderer, SceneRenderMode } from "@/components/scene-3d";

export type RenderMode = SceneRenderMode;

/** Состояние overlay поиска: какие точки подсветить (по id) + позиция маркера-центроида. */
export interface MapOverlayState {
  highlightIds: Set<string>;
  marker: [number, number, number] | null;
}

export interface MapRenderer extends SceneRenderer {
  /** Overlay поиска: подсветить точки (по id) + маркер. null — снять overlay. */
  setOverlay(overlay: MapOverlayState | null): void;
}
```

- [ ] **Step 3: Сократить `ThreeMapRenderer` до дельты (наследование)**

Заменить весь `src/features/semantic-map/renderer/three-map-renderer.ts`:

```ts
// src/features/semantic-map/renderer/three-map-renderer.ts
import * as THREE from "three";

import { ThreeSceneRenderer } from "@/components/scene-3d";

import type { RenderModel } from "../types";

import type { MapOverlayState, MapRenderer } from "./map-renderer";

/** Карто-рендерер: общий каркас из ThreeSceneRenderer + дельта (overlay поиска + ring-marker). */
export class ThreeMapRenderer extends ThreeSceneRenderer implements MapRenderer {
  private marker: THREE.Sprite | null = null;

  setOverlay(overlay: MapOverlayState | null): void {
    const model = this.model as RenderModel | null;
    if (!model || !this.colorAttr || !this.baseColors) return;
    const ids = model.ids;
    const arr = this.colorAttr.array as Float32Array;
    const DIM = 0.18;
    if (!overlay || overlay.highlightIds.size === 0) {
      arr.set(this.baseColors); // восстановить полные цвета
    } else {
      for (let i = 0; i < ids.length; i++) {
        const hit = overlay.highlightIds.has(ids[i] ?? "");
        const k = hit ? 1 : DIM;
        arr[i * 3] = (this.baseColors[i * 3] ?? 0) * k;
        arr[i * 3 + 1] = (this.baseColors[i * 3 + 1] ?? 0) * k;
        arr[i * 3 + 2] = (this.baseColors[i * 3 + 2] ?? 0) * k;
      }
    }
    this.colorAttr.needsUpdate = true;
    this.updateMarker(overlay?.marker ?? null);
    this.requestRender();
  }

  /** Смена модели прячет устаревший marker; overlay реаплаит call-site (как раньше). */
  protected override onModelApplied(): void {
    this.updateMarker(null);
  }

  protected override disposeLayers(): void {
    if (this.marker) {
      this.scene.remove(this.marker);
      this.marker.material.map?.dispose();
      this.marker.material.dispose();
    }
    this.marker = null;
  }

  private updateMarker(pos: [number, number, number] | null): void {
    if (!pos) {
      if (this.marker) this.marker.visible = false;
      this.requestRender();
      return;
    }
    if (!this.marker) {
      const mat = new THREE.SpriteMaterial({ map: makeRingTexture(), transparent: true, depthTest: false });
      this.marker = new THREE.Sprite(mat);
      this.scene.add(this.marker);
    }
    const { min, max } = this.model?.bounds ?? { min: [-1, -1, -1], max: [1, 1, 1] };
    const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
    const s = diag * 0.06;
    this.marker.scale.set(s, s, 1);
    this.marker.position.set(pos[0], pos[1], pos[2]);
    this.marker.visible = true;
    this.requestRender();
  }
}

function makeRingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
```

> `scene`, `model`, `colorAttr`, `baseColors`, `requestRender()` — protected из базы. `onModelApplied`/`disposeLayers` — override-хуки. Весь каркас (mount/resize/fit/getViewProjection/onPick/loop/setModel/setMode/setReducedMotion) приходит из базы; здесь его НЕТ.

- [ ] **Step 4: Прогнать регресс-сеть карты — байт-в-байт поведение**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/three-map-renderer.test.ts src/features/semantic-map/to-render-model.test.ts src/features/semantic-map/overlay/match-overlay.test.ts src/features/semantic-map/ui/semantic-map-view.test.tsx`
Expected: PASS — те же ассерты (`setReducedMotion`, onPick-hit/null/drag, overlay-wiring, view-wiring), теперь через наследование. Ассерты НЕ менять; красное → починить миграцию, не тест.

- [ ] **Step 5: Прогнать весь слайс карты целиком**

Run: `pnpm exec vitest run src/features/semantic-map`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/renderer/map-renderer.ts \
  src/features/semantic-map/renderer/three-map-renderer.ts \
  src/features/semantic-map/types.ts
git commit -m "refactor(semantic-map): ThreeMapRenderer наследует ThreeSceneRenderer

Карта оставляет только дельту (setOverlay поиска + ring-marker); весь каркас — из базы.
RenderModel = SceneRenderModel & { docs; clusters }. Поведение и тесты неизменны.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Обобщить UI-шеллы (`scene-state-panel`/`scene-mode-toggle`/`scene-region-labels`) + перевести карту на адаптеры

**Files:**
- Create: `src/components/scene-3d/ui/scene-state-panel.tsx`
- Create: `src/components/scene-3d/ui/scene-mode-toggle.tsx`
- Create: `src/components/scene-3d/ui/scene-mode-toggle.test.tsx`
- Create: `src/components/scene-3d/ui/scene-region-labels.tsx`
- Modify: `src/components/scene-3d/index.ts`
- Modify: `src/features/semantic-map/ui/map-state-panel.tsx` (адаптер)
- Modify: `src/features/semantic-map/ui/map-mode-toggle.tsx` (адаптер)
- Modify: `src/features/semantic-map/ui/map-region-labels.tsx` (адаптер)
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx` (`storageKey`-проп тоггла)

**Interfaces:**
- Produces (i18n-namespace-agnostic — шеллы читают ПЕРЕДАННЫЕ label-props, не namespace):
  - `scene-state-panel.tsx`: `SceneStatePanel({ reason: "building" | "error"; buildingText: string; errorText: string }): JSX` — server-компонент (без хуков).
  - `scene-mode-toggle.tsx`: `SceneModeToggle({ mode: SceneRenderMode; onChange: (m: SceneRenderMode) => void; ariaLabel: string; storageKey: string }): JSX` — client; `storageKey` различает персист карты vs графа (карта — `"semantic-map:mode"`, граф — `"reference-graph:mode"`). `readSavedMode(storageKey)` экспортируется хелпером.
  - `scene-region-labels.tsx`: `SceneRegionLabels({ labels: ProjectedLabel[] }): JSX`; `ProjectedLabel { id: number; label: string; color: string; x: number; y: number }`.
- Consumes: `SceneRenderMode`, `@/components/ui` `Button`.

> **Решение по churn (спека §65, «pick the lower-churn path and state it»): адаптерный путь.** Карта сохраняет имена `MapStatePanel`/`MapModeToggle`/`MapRegionLabels` как тонкие адаптеры, читающие namespace `semanticMap` и прокидывающие label-props в `scene-3d`-шеллы. Так публичный API карты (`index.ts` экспортит `MapStatePanel`) и call-sites view не переписываются массово, а i18n-строки остаются в namespace карты. Шеллы `scene-3d` остаются namespace-agnostic.

- [ ] **Step 1: Написать падающий тест тоггла (label-props + storageKey)**

```tsx
// src/components/scene-3d/ui/scene-mode-toggle.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

// kit Button замокан простым <button> — проверяем проводку, не стили.
vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, "aria-pressed": pressed }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-pressed"?: boolean;
  }) => (
    <button onClick={onClick} aria-pressed={pressed}>{children}</button>
  ),
}));

afterEach(cleanup);

import { SceneModeToggle } from "./scene-mode-toggle";

describe("SceneModeToggle", () => {
  it("рендерит 2D/3D и помечает активный режим", () => {
    render(
      <SceneModeToggle mode="2d" onChange={vi.fn()} ariaLabel="Размерность" storageKey="k" />,
    );
    const group = screen.getByRole("group", { name: "Размерность" });
    expect(group).toBeInTheDocument();
    expect(screen.getByText("2D")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3D")).toHaveAttribute("aria-pressed", "false");
  });

  it("клик по 3D зовёт onChange('3d')", () => {
    const onChange = vi.fn();
    render(
      <SceneModeToggle mode="2d" onChange={onChange} ariaLabel="A" storageKey="k" />,
    );
    fireEvent.click(screen.getByText("3D"));
    expect(onChange).toHaveBeenCalledWith("3d");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/components/scene-3d/ui/scene-mode-toggle.test.tsx`
Expected: FAIL — `Cannot find module "./scene-mode-toggle"`.

- [ ] **Step 3: Реализовать шеллы `scene-3d`**

```tsx
// src/components/scene-3d/ui/scene-state-panel.tsx
// Server-компонент: состояние сцены «строится»/«ошибка». i18n-agnostic — тексты приходят пропами.
export function SceneStatePanel({
  reason,
  buildingText,
  errorText,
}: {
  reason: "building" | "error";
  buildingText: string;
  errorText: string;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-(--color-fg-muted)">
      {reason === "building" ? buildingText : errorText}
    </div>
  );
}
```

```tsx
"use client";
// src/components/scene-3d/ui/scene-mode-toggle.tsx
import { Button } from "@/components/ui";

import type { SceneRenderMode } from "../scene-renderer";

/** Восстановить сохранённый режим по storageKey (клиент). Дефолт — "2d". */
export function readSavedMode(storageKey: string): SceneRenderMode {
  const saved =
    typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
  return saved === "2d" || saved === "3d" ? saved : "2d";
}

export function SceneModeToggle({
  mode,
  onChange,
  ariaLabel,
  storageKey: _storageKey,
}: {
  mode: SceneRenderMode;
  onChange: (m: SceneRenderMode) => void;
  ariaLabel: string;
  /** Различает персист карты vs графа; читает/пишет вызывающий через readSavedMode. */
  storageKey: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-md bg-(--color-surface) p-1 shadow"
    >
      {(["2d", "3d"] as const).map((m) => (
        <Button
          key={m}
          compact
          tone={mode === m ? "primary" : "quiet"}
          aria-pressed={mode === m}
          onClick={() => { onChange(m); }}
        >
          {m.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
```

```tsx
"use client";
// src/components/scene-3d/ui/scene-region-labels.tsx
export interface ProjectedLabel {
  id: number;
  label: string;
  color: string;
  x: number;
  y: number;
}

export function SceneRegionLabels({ labels }: { labels: ProjectedLabel[] }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {labels.map((l) => (
        <span
          key={l.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium"
          style={{
            left: l.x,
            top: l.y,
            color: l.color,
            background: "color-mix(in oklch, var(--color-surface) 80%, transparent)",
          }}
        >
          {l.label}
        </span>
      ))}
    </div>
  );
}
```

В `src/components/scene-3d/index.ts` добавить:

```ts
export { SceneStatePanel } from "./ui/scene-state-panel";
export { SceneModeToggle, readSavedMode } from "./ui/scene-mode-toggle";
export { SceneRegionLabels, type ProjectedLabel } from "./ui/scene-region-labels";
```

- [ ] **Step 4: Перевести карто-шеллы на адаптеры (namespace `semanticMap` → label-props)**

`src/features/semantic-map/ui/map-state-panel.tsx`:

```tsx
// src/features/semantic-map/ui/map-state-panel.tsx
// Адаптер: тянет namespace semanticMap и прокидывает label-props в общий SceneStatePanel.
import { SceneStatePanel } from "@/components/scene-3d";
import { getT } from "@/i18n";

export async function MapStatePanel({ reason }: { reason: "building" | "error" }) {
  const t = await getT("semanticMap");
  return <SceneStatePanel reason={reason} buildingText={t("building")} errorText={t("loadError")} />;
}
```

`src/features/semantic-map/ui/map-mode-toggle.tsx`:

```tsx
"use client";
// src/features/semantic-map/ui/map-mode-toggle.tsx
// Адаптер: namespace semanticMap + storageKey карты → общий SceneModeToggle.
import { SceneModeToggle } from "@/components/scene-3d";
import { useT } from "@/i18n/client";

import type { RenderMode } from "../renderer";

export function MapModeToggle({
  mode,
  onChange,
}: {
  mode: RenderMode;
  onChange: (m: RenderMode) => void;
}) {
  const t = useT("semanticMap");
  return (
    <SceneModeToggle
      mode={mode}
      onChange={onChange}
      ariaLabel={t("dimensionAriaLabel")}
      storageKey="semantic-map:mode"
    />
  );
}
```

`src/features/semantic-map/ui/map-region-labels.tsx`:

```tsx
"use client";
// src/features/semantic-map/ui/map-region-labels.tsx
// Реэкспорт общего шелла под прежним именем (нулевая логика, чтобы call-sites/тесты не менялись).
export { SceneRegionLabels as MapRegionLabels, type ProjectedLabel } from "@/components/scene-3d";
```

> `semantic-map-view.tsx` импортит `MapRegionLabels, type ProjectedLabel` из `./map-region-labels` — реэкспорт сохраняет оба. `MapModeToggle`/`map-point-panel` импорты не меняются. Внутренний `MODE_KEY = "semantic-map:mode"` во view уже совпадает с переданным `storageKey` — поведение персиста идентично.

- [ ] **Step 5: Запустить тест тоггла + регресс карты**

Run: `pnpm exec vitest run src/components/scene-3d/ui/scene-mode-toggle.test.tsx`
Expected: PASS (2 теста).

Run: `pnpm exec vitest run src/features/semantic-map`
Expected: PASS — view рендерит те же подписи/тоггл/панель через адаптеры; `semantic-map-view.test.tsx` не меняли.

- [ ] **Step 6: Финальная верификация Phase 1 (карта зелёная целиком + сборка)**

Run: `pnpm exec vitest run src/components/scene-3d src/features/semantic-map`
Expected: PASS.

Run: `pnpm build`
Expected: успешная сборка (нет битых импортов после переездов).

- [ ] **Step 7: Commit**

```bash
git add src/components/scene-3d/ui/scene-state-panel.tsx \
  src/components/scene-3d/ui/scene-mode-toggle.tsx src/components/scene-3d/ui/scene-mode-toggle.test.tsx \
  src/components/scene-3d/ui/scene-region-labels.tsx \
  src/components/scene-3d/index.ts \
  src/features/semantic-map/ui/map-state-panel.tsx \
  src/features/semantic-map/ui/map-mode-toggle.tsx \
  src/features/semantic-map/ui/map-region-labels.tsx
git commit -m "refactor(scene-3d): обобщить UI-шеллы (state-panel/mode-toggle/region-labels)

i18n-agnostic шеллы на label-props + storageKey; карта — тонкие адаптеры под прежними именами.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — слайс reference-graph

> Foundation готова. Граф строится поверх `scene-3d` (shared infra), без единого импорта из `features/semantic-map`.

---

### Task 5: API-слой графа (`getGraph`)

**Files:**
- Create: `src/features/reference-graph/api.ts`
- Create: `src/features/reference-graph/api.test.ts`
- Create: `src/features/reference-graph/types.ts`

**Interfaces:**
- Produces:
  - `types.ts`:
    ```ts
    export type GraphData = components["schemas"]["refgraph.Graph"];
    export type GraphNode = components["schemas"]["refgraph.Node"];
    export type GraphEdge = components["schemas"]["refgraph.Edge"];
    export type GraphBounds = components["schemas"]["refgraph.Bounds"];
    ```
  - `api.ts`: `getGraph(): Promise<GraphResult>`; `GraphResult = { ok: true; graph: GraphData } | { ok: false; reason: "building" | "error" }`.
- Consumes: `createApiClient` (`@/api/client`), `React.cache`. Зеркало `semantic-map/api.ts`.

Спека §73: 503 GRAPH_NOT_READY → `{ ok:false, reason:"building" }`, иначе ошибка; optional-auth (createApiClient приложит JWT), срез публичный.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/reference-graph/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ createApiClient: () => Promise.resolve({ GET }) }));

import { getGraph } from "./api";

beforeEach(() => { vi.clearAllMocks(); });

describe("getGraph", () => {
  it("200 + data → { ok:true, graph }", async () => {
    GET.mockResolvedValue({ data: { data: { nodes: [], edges: [] } }, error: undefined, response: { status: 200 } });
    expect(await getGraph()).toEqual({ ok: true, graph: { nodes: [], edges: [] } });
  });

  it("503 → { ok:false, reason:'building' }", async () => {
    GET.mockResolvedValue({ data: undefined, error: {}, response: { status: 503 } });
    expect(await getGraph()).toEqual({ ok: false, reason: "building" });
  });

  it("прочая ошибка → { ok:false, reason:'error' }", async () => {
    GET.mockResolvedValue({ data: undefined, error: {}, response: { status: 500 } });
    expect(await getGraph()).toEqual({ ok: false, reason: "error" });
  });

  it("200 без data → error", async () => {
    GET.mockResolvedValue({ data: { data: undefined }, error: undefined, response: { status: 200 } });
    expect(await getGraph()).toEqual({ ok: false, reason: "error" });
  });

  it("исключение клиента → error", async () => {
    GET.mockRejectedValue(new Error("boom"));
    expect(await getGraph()).toEqual({ ok: false, reason: "error" });
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/reference-graph/api.test.ts`
Expected: FAIL — `Cannot find module "./api"`.

- [ ] **Step 3: Реализовать types + api**

```ts
// src/features/reference-graph/types.ts
// Контракт /api/graph — сужено из сгенерированной схемы (refgraph.*).
// Все поля optional (реальность ручки); устойчивость — в to-graph-render-model.ts.
import type { components } from "@/api/schema";

import type { SceneRenderModel } from "@/components/scene-3d";

export type GraphData = components["schemas"]["refgraph.Graph"];
export type GraphNode = components["schemas"]["refgraph.Node"];
export type GraphEdge = components["schemas"]["refgraph.Edge"];
export type GraphBounds = components["schemas"]["refgraph.Bounds"];

/**
 * Внутренняя форма графа для рендерера: общее облако точек + рёбра + типы узлов.
 * edges — буфер пар вершин (2 точки/ребро, count_edges*6 чисел); edgeAlphas — альфа на ВЕРШИНУ
 * (count_edges*2), weight→прозрачность; types — node.type на индекс узла (для node-route).
 */
export type GraphRenderModel = SceneRenderModel & {
  edges: Float32Array;
  edgeAlphas: Float32Array;
  types: string[];
};
```

```ts
// src/features/reference-graph/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { GraphData } from "./types";

/** Результат загрузки графа: готов / ещё строится (503 GRAPH_NOT_READY) / ошибка. */
export type GraphResult =
  | { ok: true; graph: GraphData }
  | { ok: false; reason: "building" | "error" };

/**
 * Граф связности корпуса. Read-only, optional-auth (createApiClient приложит JWT из cookie —
 * бэк скоупит срез по видимости, но граф анонимно-публичный). ETag/304 в v1 не используем.
 */
export const getGraph = cache(async (): Promise<GraphResult> => {
  try {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/graph");
    if (error) {
      if (response.status === 503) return { ok: false, reason: "building" };
      return { ok: false, reason: "error" };
    }
    const graph = data.data;
    if (!graph) return { ok: false, reason: "error" };
    return { ok: true, graph };
  } catch {
    return { ok: false, reason: "error" };
  }
});
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/reference-graph/api.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/reference-graph/api.ts src/features/reference-graph/api.test.ts src/features/reference-graph/types.ts
git commit -m "feat(reference-graph): getGraph + типы (503 GRAPH_NOT_READY → building)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Маршрут узла (`node-route.ts`)

**Files:**
- Create: `src/features/reference-graph/node-route.ts`
- Create: `src/features/reference-graph/node-route.test.ts`

**Interfaces:**
- Produces: `nodeHref(type: string | undefined, id: string | undefined): string | null` — `"document"` → `/documents/{id}`, `"glossary"` → `/glossary/{id}`, неизвестный type / пустой id → `null` (узел не навигируем).
- Consumes: ничего (pure).

Спека §76, §104, §107: FE-стопгап — неизвестный `type` → `null` (onPick no-op), TODO со ссылкой на бэк-аск.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/reference-graph/node-route.test.ts
import { describe, it, expect } from "vitest";

import { nodeHref } from "./node-route";

describe("nodeHref", () => {
  it("document → /documents/{id}", () => {
    expect(nodeHref("document", "abc")).toBe("/documents/abc");
  });
  it("glossary → /glossary/{id}", () => {
    expect(nodeHref("glossary", "xyz")).toBe("/glossary/xyz");
  });
  it("неизвестный type → null (узел не навигируем — FE-стопгап)", () => {
    expect(nodeHref("lecture", "id")).toBeNull();
    expect(nodeHref(undefined, "id")).toBeNull();
  });
  it("пустой/отсутствующий id → null", () => {
    expect(nodeHref("document", "")).toBeNull();
    expect(nodeHref("document", undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/reference-graph/node-route.test.ts`
Expected: FAIL — `Cannot find module "./node-route"`.

- [ ] **Step 3: Реализовать**

```ts
// src/features/reference-graph/node-route.ts
// Чистая маршрутизация узла графа → путь сущности. Узел = документ или термин глоссария.
// FE-стопгап (открытый бэк-аск, см. spec §99–107): известные type — "document"/"glossary";
// неизвестный type → null (узел не навигируем, onPick no-op). TODO: сузить при ответе бэка.
export function nodeHref(type: string | undefined, id: string | undefined): string | null {
  if (!id) return null;
  switch (type) {
    case "document":
      return `/documents/${id}`;
    case "glossary":
      return `/glossary/${id}`;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/reference-graph/node-route.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/reference-graph/node-route.ts src/features/reference-graph/node-route.test.ts
git commit -m "feat(reference-graph): nodeHref (type→route, неизвестный type→null)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Нормализация `refgraph.Graph → GraphRenderModel` (`to-graph-render-model.ts`)

**Files:**
- Create: `src/features/reference-graph/to-graph-render-model.ts`
- Create: `src/features/reference-graph/to-graph-render-model.test.ts`

**Interfaces:**
- Produces: `toGraphRenderModel(data: GraphData): GraphRenderModel` — pure: узлы → `positions`/`ids`/`types`/`colors`(по `type`)/`bounds`; рёбра → `edges`(буфер пар координат через map `NodeRef.id`→индекс, неразрешимые молча пропускаются) + `edgeAlphas`(из `weight`). Экспортит `edgeAlpha(weight: number | undefined): number` для отдельного теста.
- Consumes: `hexToRgb01` (`@/components/scene-3d`), типы из `./types`.

Спека §75, §85–86: цвет по `type` (document vs glossary — два тона), `bounds` как у карты (фолбэк из точек), `weight`→прозрачность, id вне набора узлов → ребро пропущено.

- [ ] **Step 1: Написать падающий тест**

```ts
/* eslint-disable testing-library/render-result-naming-convention --
   toGraphRenderModel — доменная нормализация, не RTL render(); правило ложно матчит «render» в имени. */
// src/features/reference-graph/to-graph-render-model.test.ts
import { describe, it, expect } from "vitest";

import { toGraphRenderModel, edgeAlpha } from "./to-graph-render-model";
import type { GraphData } from "./types";

describe("toGraphRenderModel — узлы", () => {
  it("маппит coords→positions, id→ids, type→types", () => {
    const data: GraphData = {
      dims: 3,
      nodes: [
        { id: "d1", type: "document", coords: [1, 2, 3] },
        { id: "g1", type: "glossary", coords: [4, 5, 6] },
      ],
      edges: [],
    };
    const m = toGraphRenderModel(data);
    expect(m.count).toBe(2);
    expect(Array.from(m.positions)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(m.ids).toEqual(["d1", "g1"]);
    expect(m.types).toEqual(["document", "glossary"]);
  });

  it("document и glossary окрашены разными тонами; неизвестный type — нейтральный", () => {
    const data: GraphData = {
      nodes: [
        { id: "d", type: "document", coords: [0, 0, 0] },
        { id: "g", type: "glossary", coords: [0, 0, 0] },
        { id: "u", type: "weird", coords: [0, 0, 0] },
      ],
      edges: [],
    };
    const m = toGraphRenderModel(data);
    const doc = Array.from(m.colors.slice(0, 3));
    const glo = Array.from(m.colors.slice(3, 6));
    const unk = Array.from(m.colors.slice(6, 9));
    expect(doc).not.toEqual(glo);
    expect(unk).not.toEqual(doc);
    expect(unk).not.toEqual(glo);
  });

  it("dims<3 кладёт z=0", () => {
    const data: GraphData = { dims: 2, nodes: [{ id: "a", type: "document", coords: [7, 8] }], edges: [] };
    const m = toGraphRenderModel(data);
    expect(Array.from(m.positions)).toEqual([7, 8, 0]);
  });

  it("bounds из контракта; фолбэк — расчёт из точек при отсутствии", () => {
    const withB = toGraphRenderModel({
      nodes: [{ id: "a", type: "document", coords: [0, 0, 0] }],
      bounds: { min: [-2, -2, -2], max: [2, 2, 2] },
      edges: [],
    });
    expect(withB.bounds).toEqual({ min: [-2, -2, -2], max: [2, 2, 2] });

    const noB = toGraphRenderModel({
      nodes: [
        { id: "a", type: "document", coords: [-1, -1, -1] },
        { id: "b", type: "document", coords: [3, 3, 3] },
      ],
      edges: [],
    });
    expect(noB.bounds.min).toEqual([-1, -1, -1]);
    expect(noB.bounds.max).toEqual([3, 3, 3]);
  });
});

describe("toGraphRenderModel — рёбра", () => {
  const data: GraphData = {
    nodes: [
      { id: "a", type: "document", coords: [0, 0, 0] },
      { id: "b", type: "document", coords: [10, 0, 0] },
    ],
    edges: [
      { source: { id: "a" }, target: { id: "b" }, weight: 1 },
      { source: { id: "a" }, target: { id: "ghost" }, weight: 1 }, // неразрешимое → пропуск
    ],
  };

  it("разрешённое ребро → 6 чисел (2 вершины × xyz) по координатам узлов", () => {
    const m = toGraphRenderModel(data);
    expect(Array.from(m.edges)).toEqual([0, 0, 0, 10, 0, 0]);
  });

  it("неразрешимое ребро (id вне набора) молча пропущено", () => {
    const m = toGraphRenderModel(data);
    expect(m.edges.length).toBe(6); // только первое ребро
    expect(m.edgeAlphas.length).toBe(2); // альфа на вершину
  });
});

describe("edgeAlpha", () => {
  it("больший weight → больше альфы, в пределах [мин,1]", () => {
    expect(edgeAlpha(1)).toBeGreaterThan(edgeAlpha(0.1));
    expect(edgeAlpha(100)).toBeLessThanOrEqual(1);
    expect(edgeAlpha(0)).toBeGreaterThan(0);
    expect(edgeAlpha(undefined)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/reference-graph/to-graph-render-model.test.ts`
Expected: FAIL — `Cannot find module "./to-graph-render-model"`.

- [ ] **Step 3: Реализовать**

```ts
// src/features/reference-graph/to-graph-render-model.ts
// Чистая нормализация GraphData → GraphRenderModel (типизированные массивы, один draw-call на слой).
// Здесь живёт устойчивость к контракту: все поля refgraph.* optional, рёбра с неразрешимыми
// концами пропускаются. Цвет узла — по type (FE-стопгап: document/glossary известны, см. spec §107).
import { hexToRgb01 } from "@/components/scene-3d";

import type { GraphBounds, GraphData, GraphRenderModel } from "./types";

// Два тона + нейтральный для неизвестного type. TODO(бэк-аск spec §103): сузить Node.type до
// enum — тогда «нейтральный» станет недостижим.
const COLOR_DOCUMENT = "#5B8FF9";
const COLOR_GLOSSARY = "#F6BD16";
const COLOR_UNKNOWN = "#65789B";

function nodeColor(type: string | undefined): string {
  if (type === "document") return COLOR_DOCUMENT;
  if (type === "glossary") return COLOR_GLOSSARY;
  return COLOR_UNKNOWN;
}

const ALPHA_MIN = 0.15;
/** weight (может отсутствовать) → альфа линии в [ALPHA_MIN, 1]. Насыщение мягкое (1 - e^-w). */
export function edgeAlpha(weight: number | undefined): number {
  const w = Number.isFinite(weight) ? Math.max(0, weight as number) : 0;
  return ALPHA_MIN + (1 - ALPHA_MIN) * (1 - Math.exp(-w));
}

export function toGraphRenderModel(data: GraphData): GraphRenderModel {
  const dims = data.dims ?? 3;
  const nodes = data.nodes ?? [];
  const rawEdges = data.edges ?? [];
  const count = nodes.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ids: string[] = [];
  const types: string[] = [];
  const indexById = new Map<string, number>();

  nodes.forEach((n, i) => {
    const co = n.coords ?? [];
    const x = co[0] ?? 0;
    const y = co[1] ?? 0;
    const z = dims >= 3 ? co[2] ?? 0 : 0;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const [r, g, b] = hexToRgb01(nodeColor(n.type));
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    const id = n.id ?? "";
    ids[i] = id;
    types[i] = n.type ?? "";
    if (id) indexById.set(id, i);
  });

  // Рёбра: резолвим source/target в индексы узлов; неразрешимые молча пропускаем.
  const edgeCoords: number[] = [];
  const alphas: number[] = [];
  for (const e of rawEdges) {
    const si = e.source?.id ? indexById.get(e.source.id) : undefined;
    const ti = e.target?.id ? indexById.get(e.target.id) : undefined;
    if (si === undefined || ti === undefined) continue;
    edgeCoords.push(
      positions[si * 3] ?? 0, positions[si * 3 + 1] ?? 0, positions[si * 3 + 2] ?? 0,
      positions[ti * 3] ?? 0, positions[ti * 3 + 1] ?? 0, positions[ti * 3 + 2] ?? 0,
    );
    const a = edgeAlpha(e.weight);
    alphas.push(a, a); // альфа на вершину (2 вершины/ребро)
  }

  return {
    count,
    positions,
    colors,
    ids,
    types,
    edges: new Float32Array(edgeCoords),
    edgeAlphas: new Float32Array(alphas),
    bounds: computeBounds(data.bounds, positions, count),
  };
}

function computeBounds(
  b: GraphBounds | undefined,
  positions: Float32Array,
  count: number,
): { min: [number, number, number]; max: [number, number, number] } {
  if (b?.min && b.max && b.min.length >= 2 && b.max.length >= 2 && Number.isFinite(b.min[0])) {
    return {
      min: [b.min[0] ?? -1, b.min[1] ?? -1, b.min[2] ?? -1],
      max: [b.max[0] ?? 1, b.max[1] ?? 1, b.max[2] ?? 1],
    };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < 3; d++) {
      const v = positions[i * 3 + d] ?? 0;
      if (v < (min[d] ?? Infinity)) min[d] = v;
      if (v > (max[d] ?? -Infinity)) max[d] = v;
    }
  }
  if (!Number.isFinite(min[0])) return { min: [-1, -1, -1], max: [1, 1, 1] };
  return { min, max };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/reference-graph/to-graph-render-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reference-graph/to-graph-render-model.ts src/features/reference-graph/to-graph-render-model.test.ts
git commit -m "feat(reference-graph): toGraphRenderModel (узлы по type + рёбра с пропуском неразрешимых)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Граф-рендерер (`ThreeGraphRenderer` + слой рёбер)

**Files:**
- Create: `src/features/reference-graph/ui/three-graph-renderer.ts`
- Create: `src/features/reference-graph/ui/three-graph-renderer.test.ts`

**Interfaces:**
- Produces: `class ThreeGraphRenderer extends ThreeSceneRenderer` — `override setModel(model: GraphRenderModel)` (вызывает `super.setModel`, затем строит `LineSegments` из `model.edges`/`model.edgeAlphas`); `override onModelApplied()` (rebuild слоя рёбер); `override disposeLayers()` (освободить меш рёбер). Цвета узлов уже в `model.colors` — рендерер только рисует.
- Consumes: `ThreeSceneRenderer` (`@/components/scene-3d`), `GraphRenderModel` (`../types`), `three`.

Спека §77: слой рёбер (`LineSegments`, weight→прозрачность через vertex-alpha), наследует базу; node-цвета precomputed.

- [ ] **Step 1: Написать падающий тест (мок three, по образцу базы)**

```ts
// src/features/reference-graph/ui/three-graph-renderer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    enableDamping = true;
    enableRotate = true;
    mouseButtons: Record<string, unknown> = {};
    target = { set: vi.fn() };
    update = vi.fn();
    addEventListener = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock("three", async (importActual) => {
  const actual = await importActual<typeof import("three")>();
  class FakeWebGLRenderer {
    domElement = {} as HTMLCanvasElement;
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import * as THREE from "three";

import { ThreeGraphRenderer } from "./three-graph-renderer";
import type { GraphRenderModel } from "../types";

function fakeCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 100,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

function model(): GraphRenderModel {
  return {
    count: 2,
    positions: new Float32Array([0, 0, 0, 10, 0, 0]),
    colors: new Float32Array([1, 0, 0, 0, 1, 0]),
    ids: ["a", "b"],
    types: ["document", "glossary"],
    edges: new Float32Array([0, 0, 0, 10, 0, 0]),
    edgeAlphas: new Float32Array([1, 1]),
    bounds: { min: [0, 0, 0], max: [10, 0, 0] },
  };
}

// Достать меш рёбер из приватной сцены (тонкий доступ для проверки слоя).
function lineSegments(r: ThreeGraphRenderer): THREE.LineSegments | undefined {
  const scene = (r as unknown as { scene: THREE.Scene }).scene;
  return scene.children.find((c): c is THREE.LineSegments => c instanceof THREE.LineSegments);
}

describe("ThreeGraphRenderer edges layer", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("setModel строит LineSegments из model.edges", () => {
    const r = new ThreeGraphRenderer();
    r.mount(fakeCanvas());
    r.setModel(model());
    const seg = lineSegments(r);
    expect(seg).toBeDefined();
    const pos = seg?.geometry.getAttribute("position");
    expect(pos?.count).toBe(2); // 2 вершины = 1 ребро
    r.destroy();
  });

  it("повторный setModel пересобирает рёбра (нет дубля в сцене)", () => {
    const r = new ThreeGraphRenderer();
    r.mount(fakeCanvas());
    r.setModel(model());
    r.setModel(model());
    const scene = (r as unknown as { scene: THREE.Scene }).scene;
    const segs = scene.children.filter((c) => c instanceof THREE.LineSegments);
    expect(segs.length).toBe(1);
    r.destroy();
  });

  it("клик по узлу → onPick(node.id) через базовый picking", () => {
    const r = new ThreeGraphRenderer();
    const canvas = fakeCanvas();
    r.mount(canvas);
    r.setModel(model());
    const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    // точка "a" в центре мира → экранный центр (50,50) при identity vp на 100×100.
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 50, clientY: 50 }));
    expect(cb).toHaveBeenCalledWith("a");
    r.destroy();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/reference-graph/ui/three-graph-renderer.test.ts`
Expected: FAIL — `Cannot find module "./three-graph-renderer"`.

- [ ] **Step 3: Реализовать**

```ts
// src/features/reference-graph/ui/three-graph-renderer.ts
import * as THREE from "three";

import { ThreeSceneRenderer } from "@/components/scene-3d";

import type { GraphRenderModel } from "../types";

/**
 * Граф-рендерер: общий каркас из ThreeSceneRenderer + слой рёбер (LineSegments, weight→прозрачность
 * через vertex-alpha). Цвета узлов уже precomputed в model.colors (по type) — база рисует облако,
 * этот класс только дорисовывает рёбра.
 */
export class ThreeGraphRenderer extends ThreeSceneRenderer {
  private edges: THREE.LineSegments | null = null;
  private edgeModel: GraphRenderModel | null = null;

  override setModel(model: GraphRenderModel): void {
    this.edgeModel = model; // запомнить для onModelApplied (база зовёт его в конце super.setModel)
    super.setModel(model); // строит облако точек + вызывает onModelApplied → rebuild рёбер
  }

  /** База позвала после применения модели → (пере)собрать слой рёбер. */
  protected override onModelApplied(): void {
    this.disposeEdges();
    const m = this.edgeModel;
    if (!m || m.edges.length === 0) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(m.edges, 3));
    // Альфа на вершину → один LineSegments-меш с per-vertex прозрачностью.
    const alpha = new Float32Array(m.edgeAlphas); // count_edges*2
    geom.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.LineBasicMaterial({
      color: 0x8899aa,
      transparent: true,
      opacity: 0.5, // базовая полупрозрачность; per-vertex alpha варьирует weight'ом через shader-hook ниже
      depthWrite: false,
    });
    // weight→прозрачность: подмешиваем vertex-alpha в фрагментный цвет линии.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float alpha;\nvarying float vAlpha;\n" +
        shader.vertexShader.replace("void main() {", "void main() {\n  vAlpha = alpha;");
      shader.fragmentShader = shader.fragmentShader
        .replace("varying", "varying float vAlpha;\nvarying")
        .replace(
          "vec4( outgoingLight, diffuseColor.a )",
          "vec4( outgoingLight, diffuseColor.a * vAlpha )",
        );
    };
    this.edges = new THREE.LineSegments(geom, mat);
    this.scene.add(this.edges);
    this.requestRender();
  }

  protected override disposeLayers(): void {
    this.disposeEdges();
  }

  private disposeEdges(): void {
    if (this.edges) {
      this.scene.remove(this.edges);
      this.edges.geometry.dispose();
      const m = this.edges.material;
      if (Array.isArray(m)) m.forEach((x) => { x.dispose(); });
      else m.dispose();
    }
    this.edges = null;
  }
}
```

> Примечание по шейдер-хуку: если в QA per-vertex alpha не возьмётся (версия three/материала), фолбэк-стопгап — равномерная `opacity` без `onBeforeCompile`; weight-варьирование тогда переносим в Future. Юнит проверяет лишь СТРУКТУРУ слоя (наличие/пересборка/picking), не GPU-вывод.

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/reference-graph/ui/three-graph-renderer.test.ts`
Expected: PASS (3 теста: построение рёбер, пересборка без дубля, picking узла).

- [ ] **Step 5: Commit**

```bash
git add src/features/reference-graph/ui/three-graph-renderer.ts src/features/reference-graph/ui/three-graph-renderer.test.ts
git commit -m "feat(reference-graph): ThreeGraphRenderer (наследует базу + слой рёбер LineSegments)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: View графа (`graph-view.tsx`) — lifecycle + mode-toggle + region-labels + навигация по клику

**Files:**
- Create: `src/features/reference-graph/ui/graph-view.tsx`
- Create: `src/features/reference-graph/ui/graph-view.test.tsx`

**Interfaces:**
- Produces: `export default function GraphView({ data }: { data: GraphData }): JSX` — монтирует `ThreeGraphRenderer` (через порт `SceneRenderer`), читает/пишет режим (`storageKey="reference-graph:mode"`), рисует `SceneModeToggle` + `SceneRegionLabels` (top-N по `degree`), на `onPick(id)` → `router.push(nodeHref(type, id))` (no-op при `null`-href).
- Consumes: `ThreeGraphRenderer` (`./three-graph-renderer`), `SceneModeToggle`/`SceneRegionLabels`/`readSavedMode`/`projectToScreen`/`SceneRenderer`/`SceneRenderMode`/`type ProjectedLabel` (`@/components/scene-3d`), `toGraphRenderModel` (`../to-graph-render-model`), `nodeHref` (`../node-route`), `useReducedMotion` (`@/components/appearance`), `useT` (`@/i18n/client`), `useRouter` (`next/navigation`).

Спека §79, §88: region-labels — top-N узлов по `degree`; клик по узлу → навигация. Структура зеркалит `semantic-map-view.tsx`, но проще (нет overlay/panel/fetch).

- [ ] **Step 1: Написать падающий тест (мок рендерера + захват onPick → router.push)**

```tsx
// src/features/reference-graph/ui/graph-view.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rendererInstance = {
  mount: vi.fn(),
  setModel: vi.fn(),
  setMode: vi.fn(),
  fitToBounds: vi.fn(),
  resize: vi.fn(),
  getViewProjection: vi.fn(() => null),
  onChange: vi.fn(),
  onPick: vi.fn(),
  setReducedMotion: vi.fn(),
  destroy: vi.fn(),
};
vi.mock("./three-graph-renderer", () => ({
  ThreeGraphRenderer: vi.fn(function () {
    return rendererInstance;
  }),
}));
// Общие шеллы/хелперы scene-3d — тонкие заглушки.
vi.mock("@/components/scene-3d", () => ({
  SceneModeToggle: () => <div data-testid="mode-toggle" />,
  SceneRegionLabels: () => <div data-testid="region-labels" />,
  readSavedMode: () => "2d",
  projectToScreen: () => ({ visible: false, x: 0, y: 0 }),
}));
// Модель: два узла, у "a" известный type=document → href навигируем.
vi.mock("../to-graph-render-model", () => ({
  toGraphRenderModel: vi.fn(() => ({
    count: 2,
    positions: new Float32Array([0, 0, 0, 1, 1, 1]),
    colors: new Float32Array(6),
    ids: ["a", "b"],
    types: ["document", "weird"],
    edges: new Float32Array(),
    edgeAlphas: new Float32Array(),
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  })),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/appearance", () => ({ useReducedMotion: () => false }));

import GraphView from "./graph-view";

const DATA = {} as Parameters<typeof GraphView>[0]["data"];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GraphView navigation wiring", () => {
  type PickCb = (id: string | null) => void;
  function getPickCb(): PickCb {
    const calls = rendererInstance.onPick.mock.calls as PickCb[][];
    const cb = calls.at(-1)?.[0];
    if (typeof cb !== "function") throw new Error("onPick not registered");
    return cb;
  }

  it("подписывает onPick в lifecycle-эффекте", () => {
    render(<GraphView data={DATA} />);
    expect(rendererInstance.onPick).toHaveBeenCalled();
  });

  it("клик по document-узлу → router.push(/documents/{id})", () => {
    render(<GraphView data={DATA} />);
    getPickCb()("a");
    expect(push).toHaveBeenCalledWith("/documents/a");
  });

  it("клик по узлу с неизвестным type → навигации нет (href=null)", () => {
    render(<GraphView data={DATA} />);
    getPickCb()("b");
    expect(push).not.toHaveBeenCalled();
  });

  it("клик в пустоту (null) → навигации нет", () => {
    render(<GraphView data={DATA} />);
    getPickCb()(null);
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/reference-graph/ui/graph-view.test.tsx`
Expected: FAIL — `Cannot find module "./graph-view"`.

- [ ] **Step 3: Реализовать**

```tsx
"use client";
// src/features/reference-graph/ui/graph-view.tsx
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useReducedMotion } from "@/components/appearance";
import {
  SceneModeToggle,
  SceneRegionLabels,
  readSavedMode,
  projectToScreen,
  type ProjectedLabel,
  type SceneRenderer,
  type SceneRenderMode,
} from "@/components/scene-3d";
import { useT } from "@/i18n/client";

import { nodeHref } from "../node-route";
import { toGraphRenderModel } from "../to-graph-render-model";
import type { GraphData } from "../types";

import { ThreeGraphRenderer } from "./three-graph-renderer";

const MODE_KEY = "reference-graph:mode";
const LABEL_TOP_N = 12; // постоянные подписи только для топ-узлов по degree (ориентир в графе)

export default function GraphView({ data }: { data: GraphData }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Тип рефа — порт SceneRenderer (не конкретный ThreeGraphRenderer): своп рисовалки не трогает UI.
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [mode, setMode] = useState<SceneRenderMode>(() => readSavedMode(MODE_KEY));
  const modeRef = useRef<SceneRenderMode>(readSavedMode(MODE_KEY));
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);

  const model = useMemo(() => toGraphRenderModel(data), [data]);
  const t = useT("referenceGraph");
  const router = useRouter();

  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  // id→type (для nodeHref по клику). Стабилен на модель.
  const typeById = useMemo(() => {
    const m = new Map<string, string>();
    model.ids.forEach((id, i) => { if (id) m.set(id, model.types[i] ?? ""); });
    return m;
  }, [model]);

  // top-N узлов по degree — кандидаты на постоянную подпись (degree приходит из data.nodes).
  const labelNodes = useMemo(() => {
    const nodes = data.nodes ?? [];
    return [...nodes]
      .map((n, i) => ({ i, id: n.id ?? "", title: n.title ?? "", degree: n.degree ?? 0 }))
      .filter((n) => n.id && n.title)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, LABEL_TOP_N);
  }, [data]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const r: SceneRenderer = new ThreeGraphRenderer();
    rendererRef.current = r;

    const updateLabels = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const vp = r.getViewProjection();
      if (!vp || w === 0 || h === 0) return;
      const next: ProjectedLabel[] = [];
      for (const n of labelNodes) {
        const base = n.i * 3;
        const pos: [number, number, number] = [
          model.positions[base] ?? 0,
          model.positions[base + 1] ?? 0,
          model.positions[base + 2] ?? 0,
        ];
        const s = projectToScreen(pos, vp, w, h);
        if (s.visible) next.push({ id: n.i, label: n.title, color: "var(--color-fg)", x: s.x, y: s.y });
      }
      setLabels(next);
    };

    r.mount(canvas);
    r.resize(wrap.clientWidth || 1, wrap.clientHeight || 1, window.devicePixelRatio || 1);
    r.onChange(updateLabels); // ДО setModel — первый кадр обновит подписи

    // Клик по узлу → навигация на сущность. nodeHref=null (неизвестный type / нет id / клик в пустоту)
    // → no-op (FE-стопгап, см. spec §107).
    r.onPick?.((id) => {
      if (!id) return;
      const href = nodeHref(typeById.get(id), id);
      if (href) router.push(href);
    });

    r.setModel(model);
    r.setMode(modeRef.current);
    r.setReducedMotion(reduceRef.current);

    const ro = new ResizeObserver(() => {
      r.resize(wrap.clientWidth, wrap.clientHeight, window.devicePixelRatio || 1);
      updateLabels();
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      r.destroy();
      rendererRef.current = null;
    };
  }, [model, labelNodes, typeById, router]);

  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reduce);
  }, [reduce]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <SceneRegionLabels labels={labels} />
      <div className="absolute right-3 top-3">
        <SceneModeToggle
          mode={mode}
          onChange={setMode}
          ariaLabel={t("dimensionAriaLabel")}
          storageKey={MODE_KEY}
        />
      </div>
      {model.count === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-(--color-fg-muted)">
          {t("empty")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/reference-graph/ui/graph-view.test.tsx`
Expected: PASS (4 теста: onPick подписан, document→push, неизвестный type→no-op, null→no-op).

- [ ] **Step 5: Commit**

```bash
git add src/features/reference-graph/ui/graph-view.tsx src/features/reference-graph/ui/graph-view.test.tsx
git commit -m "feat(reference-graph): GraphView (lifecycle + mode-toggle + region-labels + клик→навигация)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Lazy-обёртка (`graph.tsx`) + barrel слайса (`index.ts`)

**Files:**
- Create: `src/features/reference-graph/ui/graph.tsx`
- Create: `src/features/reference-graph/index.ts`

**Interfaces:**
- Produces:
  - `graph.tsx`: `export function Graph({ data }: { data: GraphData }): JSX` — `next/dynamic` ssr:false вокруг `GraphView` со Skeleton-loading. Зеркало `semantic-map/ui/semantic-map.tsx`.
  - `index.ts`: публичный API слайса — `getGraph`, `GraphResult`, `Graph`.
- Consumes: `dynamic` (`next/dynamic`), `Skeleton` (`@/components/ui`), `GraphData` (`../types`).

Спека §78, §80: lazy client-обёртка; страница берёт `getGraph` + `Graph` из barrel. `SceneStatePanel` страница тянет напрямую из `scene-3d` (Task 11).

- [ ] **Step 1: Реализовать обёртку**

```tsx
"use client";
// src/features/reference-graph/ui/graph.tsx
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui";

import type { GraphData } from "../types";

const View = dynamic(() => import("./graph-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function Graph({ data }: { data: GraphData }) {
  return <View data={data} />;
}
```

- [ ] **Step 2: Реализовать barrel слайса**

```ts
// src/features/reference-graph/index.ts
// Public API слайса reference-graph: серверный fetcher + lazy client-обёртка графа.
export { getGraph, type GraphResult } from "./api";
export { Graph } from "./ui/graph";
export type { GraphData } from "./types";
```

- [ ] **Step 3: Проверить сборку (dynamic/SSR-границы корректны)**

Run: `pnpm build`
Expected: успешно (lazy import резолвится, типы протянуты).

- [ ] **Step 4: Commit**

```bash
git add src/features/reference-graph/ui/graph.tsx src/features/reference-graph/index.ts
git commit -m "feat(reference-graph): lazy-обёртка Graph + публичный barrel слайса

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: i18n namespace `referenceGraph` (ru/en) + регистрация + `graphTitle`

**Files:**
- Create: `src/i18n/messages/ru/referenceGraph.ts`
- Create: `src/i18n/messages/en/referenceGraph.ts`
- Modify: `src/i18n/messages/ru/index.ts`, `src/i18n/messages/en/index.ts`
- Modify: `src/i18n/messages/ru/pages.ts`, `src/i18n/messages/en/pages.ts`

**Interfaces:**
- Produces: namespace `referenceGraph` с ключами `dimensionAriaLabel`/`empty`/`building`/`loadError`; ключ `pages.graphTitle`. Паритет ru/en обязателен (ICU-parity тест сверяет наборы ключей).
- Consumes: используются в `graph-view.tsx` (`useT("referenceGraph")`), странице (`SceneStatePanel` тексты + `generateMetadata`).

Спека §81. `src/i18n/*` — foundation-зона; касаем только новый namespace + регистрацию + один ключ в `pages`.

- [ ] **Step 1: Создать namespace-файлы (зеркально ru/en)**

```ts
// src/i18n/messages/ru/referenceGraph.ts
// UI-строки слайса reference-graph (граф связности): client-компоненты + состояния страницы.
const referenceGraph = {
  // graph-view.tsx — группа переключателя размерности
  dimensionAriaLabel: "Размерность графа",
  // graph-view.tsx — пустой граф
  empty: "Граф пуст",
  // app/graph/page.tsx — состояния загрузки (через SceneStatePanel)
  building: "Граф ещё строится. Загляните чуть позже.",
  loadError: "Не удалось загрузить граф.",
};

export default referenceGraph;
```

```ts
// src/i18n/messages/en/referenceGraph.ts
const referenceGraph = {
  dimensionAriaLabel: "Graph dimension",
  empty: "The graph is empty",
  building: "The graph is still being built. Check back a little later.",
  loadError: "Failed to load the graph.",
};

export default referenceGraph;
```

- [ ] **Step 2: Зарегистрировать namespace в обоих index'ах**

В `src/i18n/messages/ru/index.ts` и `src/i18n/messages/en/index.ts`: добавить строку импорта `import referenceGraph from "./referenceGraph";` (в алфавитном порядке рядом с `preferences`/`search`) и ключ `referenceGraph,` в объект каталога (рядом с `preferences`/`search`).

- [ ] **Step 3: Добавить `graphTitle` в `pages` (ru/en)**

`src/i18n/messages/ru/pages.ts` — рядом с `mapTitle`:

```ts
  graphTitle: "Граф связности",
```

`src/i18n/messages/en/pages.ts` — рядом с `mapTitle`:

```ts
  graphTitle: "Reference graph",
```

- [ ] **Step 4: Проверить паритет + сборку**

Run: `pnpm exec vitest run src/i18n`
Expected: PASS (ICU-parity тест видит `referenceGraph` в ru и en с идентичным набором ключей; новый `graphTitle` в обоих `pages`).

Run: `pnpm build`
Expected: успешно (`tsc` по AppConfig не краснеет — ключи присутствуют в обеих локалях).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/messages/ru/referenceGraph.ts src/i18n/messages/en/referenceGraph.ts \
  src/i18n/messages/ru/index.ts src/i18n/messages/en/index.ts \
  src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts
git commit -m "feat(i18n): namespace referenceGraph (ru/en) + pages.graphTitle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Страница `/graph` + финальная верификация

**Files:**
- Create: `src/app/graph/page.tsx`

**Interfaces:**
- Produces: `GraphPage` (server) — `getGraph()` → при не-ok рендерит `SceneStatePanel` (тексты из namespace `referenceGraph`), иначе `<Graph data={…} />`; `generateMetadata` ставит `pages.graphTitle`.
- Consumes: `getGraph`/`Graph` (`@/features/reference-graph`), `SceneStatePanel` (`@/components/scene-3d`), `getT` (`@/i18n`). Зеркало `app/map/page.tsx` (минус search-overlay — вне объёма, спека §38).

- [ ] **Step 1: Реализовать страницу**

```tsx
// src/app/graph/page.tsx
import { SceneStatePanel } from "@/components/scene-3d";
import { getGraph, Graph } from "@/features/reference-graph";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("graphTitle") };
}

export default async function GraphPage() {
  const result = await getGraph();
  const t = await getT("referenceGraph");
  if (!result.ok) {
    return (
      <main className="h-[80vh] w-full">
        <SceneStatePanel
          reason={result.reason}
          buildingText={t("building")}
          errorText={t("loadError")}
        />
      </main>
    );
  }
  return (
    <main className="h-[80vh] w-full">
      <Graph data={result.graph} />
    </main>
  );
}
```

- [ ] **Step 2: Прогнать весь слайс графа + scene-3d + карту (полная регрессия фундамента и фичи)**

Run: `pnpm exec vitest run src/features/reference-graph src/components/scene-3d src/features/semantic-map src/i18n`
Expected: PASS — граф (api/node-route/to-graph-render-model/three-graph-renderer/graph-view), база, карта (регресс-сеть миграции), i18n-паритет.

- [ ] **Step 3: Финальная полная верификация**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Линт ловит cross-feature/deep-импорты — убедиться, что граф-слайс импортит общее ТОЛЬКО из `@/components/scene-3d`, ни одной строки из `@/features/semantic-map`.

- [ ] **Step 4: Ручной WebGL-QA (вне юнитов — спека §115)**

Открыть `/graph`: узлы + рёбра видны, 2D и 3D переключаются и персистят отдельно от карты; клик по узлу-документу → `/documents/{id}`, по термину → `/glossary/{id}`; drag (пан/орбита) НЕ навигирует; подписи top-N по degree. **Повторно** прогнать ручной QA карты `/map` (узлы/режимы/overlay-поиск/marker/point-panel) — рендерер мигрировал на базу, поведение должно остаться прежним.

- [ ] **Step 5: Commit**

```bash
git add src/app/graph/page.tsx
git commit -m "feat(reference-graph): публичная страница /graph (SceneStatePanel при не-ok, иначе Graph)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (каждая секция спеки → задача):
- Объём: публичная `/graph` облако+рёбра, 2D/3D, навигация (§31) → Tasks 8, 9, 12. ✔
- Вынос Three-базы + миграция карты (§31, §40–49) → Tasks 1–4. ✔
- `scene-renderer.ts`/`scene-render-model.ts`/`three-scene-renderer.ts` (§58–60) → Task 2. ✔
- `project`/`camera-fit`/`pick`/`palette` переезд (§61, §129) → Task 1. ✔
- `scene-state-panel`/`scene-mode-toggle`(+`storageKey`)/`scene-region-labels` (§63–65) → Task 4. ✔
- Карта-дельта `setOverlay`+marker остаётся (§68, §131) → Task 3. ✔
- `api.ts` getGraph (§73), `types.ts` GraphRenderModel (§74), `to-graph-render-model` (§75, §85–86), `node-route` (§76), `three-graph-renderer` рёбра (§77), `graph.tsx` (§78), `graph-view` (§79), `app/graph/page.tsx` (§80), i18n (§81) → Tasks 5–12. ✔
- Состояния/ошибки: 503→building, прочее→error, пустой граф (§91–96) → Tasks 5, 9, 12. ✔
- FE-стопгап: неизвестный type→нейтральный цвет + no-op + TODO (§107) → Tasks 6, 7, 9. ✔
- Стратегия тестов: pure-юниты, scene-база через мок, регресс карты, onclick-навигация (§109–114) → Tasks 1–12 (каждая Task — TDD; миграционные — «карта зелёная»). ✔
- Ego-граф / search-overlay / hover / стрелки / degree→size — НЕ реализованы (§35–38). ✔ (out of scope соблюдён)

**2. Placeholder-скан:** все шаги несут реальный код (тесты + реализация), реальные команды `pnpm exec vitest run <path>` + ожидаемый исход. Нет «TBD»/«similar to Task N»/«…». ✔

**3. Type-consistency (имена идентичны между тасками):**
- `SceneRenderer` / `SceneRenderMode` (`"2d"|"3d"`) — Task 2 определяет, Tasks 3, 9 потребляют. ✔
- `SceneRenderModel` `{ count; positions; colors; ids; bounds }` — Task 2; `RenderModel = SceneRenderModel & { docs; clusters }` (Task 3); `GraphRenderModel = SceneRenderModel & { edges; edgeAlphas; types }` (Tasks 5, 7, 8, 9). ✔
- `onModelApplied()` / `disposeLayers()` / `requestRender()` / protected `scene`/`model`/`colorAttr`/`baseColors` — Task 2 объявляет, Tasks 3, 8 override'ят теми же именами. ✔
- `nodeHref(type, id)` — Task 6 определяет, Task 9 зовёт. ✔
- `toGraphRenderModel` / `edgeAlpha` — Task 7; `getGraph`/`GraphResult`/`GraphData` — Task 5, реэкспорт Task 10, потребление Task 12. ✔
- `SceneStatePanel`(label-props) / `SceneModeToggle`(+storageKey) / `SceneRegionLabels`/`ProjectedLabel` / `readSavedMode(storageKey)` — Task 4 определяет, Tasks 9, 12 (и адаптеры карты) потребляют. ✔

**4. Phase-1 держит карту зелёной:** Task 1 Step 5, Task 3 Steps 4–5, Task 4 Steps 5–6 — каждая прогоняет регресс-сеть карты (`renderer/three-map-renderer.test.ts`, `to-render-model.test.ts`, `overlay/match-overlay.test.ts`, `ui/semantic-map-view.test.tsx`) и требует PASS без правки ассертов (только пути импортов). ✔

**5. Guardrails:** граф-слайс берёт общее ТОЛЬКО из `@/components/scene-3d` (Task 12 Step 3 явно проверяет отсутствие импортов из `@/features/semantic-map`); коммиты — `git add <named>` по именам; каждый коммит несёт Co-Authored-By. ✔

**Зависимость от бэка (открытый аск, спека §99–107):** `node.type`/`edge.kind` оставлены `string` в схеме; FE кодирует `document`/`glossary` как известные, неизвестный type → нейтральный цвет + no-op навигация (TODO в `node-route.ts` и `to-graph-render-model.ts`). При ответе бэка — точечная правка этих двух модулей, схема перегенерации не требует (`refgraph.*` уже в `src/api/schema.ts`).
