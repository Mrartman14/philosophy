# Координаты камеры карты/графа в URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Камера (вид) карты смыслов и графа ссылок отражается в URL — ссылка шарится и переживает рефреш.

**Architecture:** URL — единый источник истины для *сериализуемого* вида (`m`=режим, `c`=координаты); живую камеру владеет рендерер. Чтение — на сервере (`searchParams` → `initialView` проп); запись — на клиенте через нативный `window.history.replaceState` (shallow, без рефетча RSC). Вся гонко-опасная механика тайминга (settle-watch + таймер) живёт внутри рендерера и чистится в `applyMode`/`destroy`, поэтому смена режима и размонтирование автоматически отменяют отложенную запись.

**Tech Stack:** Next.js App Router (server components + `dynamic ssr:false`), React 19, Three.js (`OrbitControls`), TypeScript, vitest, pnpm.

**Спека:** [docs/superpowers/specs/2026-06-24-scene-camera-url-state-design.md](../specs/2026-06-24-scene-camera-url-state-design.md)

## Global Constraints

- **Тулчейн — pnpm** (не npm; `npm install` ломает тулчейн). Тесты: `pnpm test`, гейт: `pnpm lint && pnpm test && pnpm build`.
- **Параллельные агенты:** НЕ `git stash`/`reset`/`checkout`/`clean`; НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени. Передать это субагентам.
- **Каждый commit** заканчивается строкой `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (показано в шагах через heredoc).
- **Именование** файлов в `src/` — kebab-case.
- **scene-3d — НЕ frozen-зона** (это Guardrail 9: фундамент не импортит `@/features/*`); правится нормально, пока направление фича→фундамент сохранено. Реальные frozen-зоны (`schema.ts`, `app/layout.tsx`, `globals.css`, `ui/*`, `package.json`) — НЕ трогаем.
- **Новые публичные символы scene-3d** экспортируются ТОЛЬКО через `src/components/scene-3d/index.ts` (слайсы импортируют из барреля).
- **Бэкенд-зависимостей нет** — чистый FE.
- **Round-trip сериализации лоссовый** (округление) — тесты сверяют с допуском, не побайтово.

---

## File Structure

**Создаём:**
- `src/components/scene-3d/url-view.ts` — чистый модуль: тип `CameraState` re-export, `ParsedView`, `parseView`, `formatView`, `writeViewToUrl`.
- `src/components/scene-3d/url-view.test.ts` — юнит-тесты модуля.
- `src/components/scene-3d/three-scene-renderer-camera.test.ts` — тесты `getCamera`/`applyCamera`/settle-watch (изолированный enhanced-mock OrbitControls).

**Модифицируем:**
- `src/components/scene-3d/scene-renderer.ts` — тип `CameraState` + 3 метода в порт `SceneRenderer`.
- `src/components/scene-3d/three-scene-renderer.ts` — реализация `getCamera`/`applyCamera`/`onSettle` + settle-watch (поля, `armSettle`/`clearSettle`, слушатели в `applyMode`, чистка в `destroy`).
- `src/components/scene-3d/index.ts` — экспорт новых символов.
- `src/app/map/page.tsx` — парс `m`/`c`, проброс `initialView`.
- `src/features/semantic-map/ui/semantic-map.tsx` — проброс `initialView` в View.
- `src/features/semantic-map/ui/semantic-map-view.tsx` — init режима из URL, restore + settle-write + mode-write.
- `src/app/graph/page.tsx` — приём `searchParams`, парс, проброс `initialView`.
- `src/features/reference-graph/ui/graph.tsx` — проброс `initialView`.
- `src/features/reference-graph/ui/graph-view.tsx` — то же, что у карты (с учётом более широких deps эффекта).

---

## Task 1: Чистый модуль url-view (CameraState + parseView/formatView/writeViewToUrl)

**Files:**
- Modify: `src/components/scene-3d/scene-renderer.ts` (добавить тип `CameraState`)
- Create: `src/components/scene-3d/url-view.ts`
- Create: `src/components/scene-3d/url-view.test.ts`
- Modify: `src/components/scene-3d/index.ts`

**Interfaces:**
- Produces:
  - `type CameraState = { mode: SceneRenderMode; values: number[] }` (2d: `[tx,ty,zoom]`; 3d: `[px,py,pz,tx,ty,tz]`) — в `scene-renderer.ts`.
  - `interface ParsedView { mode: SceneRenderMode | null; camera: CameraState | null }`
  - `parseView(params: { m?: string; c?: string }): ParsedView`
  - `formatView(state: CameraState): { m: string; c: string }`
  - `writeViewToUrl(state: CameraState): void`

- [ ] **Step 1: Добавить тип `CameraState` в порт**

В `src/components/scene-3d/scene-renderer.ts` после строки `export type SceneRenderMode = "2d" | "3d";` добавить:

```ts
/** Сериализуемый снимок камеры. 2d: [tx,ty,zoom]; 3d: [px,py,pz,tx,ty,tz]. */
export type CameraState = { mode: SceneRenderMode; values: number[] };
```

- [ ] **Step 2: Написать падающие тесты модуля**

Создать `src/components/scene-3d/url-view.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";

import { parseView, formatView, writeViewToUrl } from "./url-view";

describe("parseView", () => {
  it("валидный 2D: m+c (3 числа)", () => {
    const r = parseView({ m: "2d", c: "1.5,-2,3" });
    expect(r.mode).toBe("2d");
    expect(r.camera).toEqual({ mode: "2d", values: [1.5, -2, 3] });
  });
  it("валидный 3D: m+c (6 чисел)", () => {
    const r = parseView({ m: "3d", c: "1,2,3,4,5,6" });
    expect(r.mode).toBe("3d");
    expect(r.camera).toEqual({ mode: "3d", values: [1, 2, 3, 4, 5, 6] });
  });
  it("m-only: режим есть, камера null", () => {
    expect(parseView({ m: "3d" })).toEqual({ mode: "3d", camera: null });
  });
  it("битый режим → mode null, camera null", () => {
    expect(parseView({ m: "4d", c: "1,2,3" })).toEqual({ mode: null, camera: null });
  });
  it("c без m → camera null", () => {
    expect(parseView({ c: "1,2,3" })).toEqual({ mode: null, camera: null });
  });
  it("неверная длина c → camera null, mode сохранён", () => {
    expect(parseView({ m: "2d", c: "1,2" })).toEqual({ mode: "2d", camera: null });
  });
  it("NaN/не-finite → camera null", () => {
    expect(parseView({ m: "2d", c: "1,x,3" }).camera).toBeNull();
    expect(parseView({ m: "3d", c: "1,2,3,4,5,Infinity" }).camera).toBeNull();
  });
  it("2D zoom <= 0 → camera null (защита от деления на ноль)", () => {
    expect(parseView({ m: "2d", c: "1,2,0" }).camera).toBeNull();
    expect(parseView({ m: "2d", c: "1,2,-1" }).camera).toBeNull();
  });
});

describe("formatView", () => {
  it("2D: координаты до 4 знаков, zoom до 3", () => {
    expect(formatView({ mode: "2d", values: [1.123456, -2.987654, 3.14159] }))
      .toEqual({ m: "2d", c: "1.1235,-2.9877,3.142" });
  });
  it("3D: все 6 значений до 4 знаков", () => {
    expect(formatView({ mode: "3d", values: [1.111111, 2, 3, 4, 5, 6] }).c)
      .toBe("1.1111,2,3,4,5,6");
  });
  it("нормализует -0 → 0", () => {
    expect(formatView({ mode: "2d", values: [-0.00001, 0, 1] }).c).toBe("0,0,1");
  });
});

describe("round-trip format→parse (с допуском под округление)", () => {
  it("3D round-trip", () => {
    const src = { mode: "3d" as const, values: [1.23456, 0.4, 2.1, 0.1, 0, -0.5] };
    const { m, c } = formatView(src);
    const back = parseView({ m, c }).camera!;
    back.values.forEach((v, i) => expect(v).toBeCloseTo(src.values[i]!, 4));
  });
});

describe("writeViewToUrl", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("мёржит m/c, сохраняя q и hash", () => {
    window.history.replaceState({}, "", "/map?q=foo#sec");
    const spy = vi.spyOn(window.history, "replaceState");
    writeViewToUrl({ mode: "2d", values: [1, 2, 3] });
    const url = String(spy.mock.calls[0]![2]);
    expect(url).toContain("q=foo");
    expect(url).toContain("m=2d");
    expect(url).toContain("c=1%2C2%2C3"); // запятые URL-кодируются
    expect(url).toContain("#sec");
  });
});
```

- [ ] **Step 3: Прогнать — убедиться, что падает**

Run: `pnpm test url-view`
Expected: FAIL — `Cannot find module './url-view'`.

- [ ] **Step 4: Реализовать модуль**

Создать `src/components/scene-3d/url-view.ts`:

```ts
// src/components/scene-3d/url-view.ts
// Чистая сериализация ВИДА сцены (камера ↔ URL-параметры m/c) — общая для карты и графа.
// Живёт в scene-3d (не @/utils): это shared-сериализация именно вида сцены; Guardrail 9
// запрещает фиче владеть общим кодом. Единственная impure-функция — writeViewToUrl (window.history).
import type { CameraState, SceneRenderMode } from "./scene-renderer";

export type { CameraState } from "./scene-renderer";

export interface ParsedView {
  mode: SceneRenderMode | null;
  camera: CameraState | null;
}

/** `m` и `c` парсятся НЕЗАВИСИМО: валидный `m` без `c` — легитимная ссылка «открыть в режиме, авто-fit». */
export function parseView(params: { m?: string; c?: string }): ParsedView {
  const mode: SceneRenderMode | null =
    params.m === "2d" || params.m === "3d" ? params.m : null;
  let camera: CameraState | null = null;
  if (mode && params.c) {
    const values = params.c.split(",").map(Number);
    const expected = mode === "2d" ? 3 : 6;
    const lengthOk = values.length === expected;
    const allFinite = values.every((n) => Number.isFinite(n));
    // 2D zoom — values[2]; <=0 даст деление на ноль в орто-проекции.
    const zoomOk = mode === "3d" || (values[2] ?? 0) > 0;
    if (lengthOk && allFinite && zoomOk) camera = { mode, values };
  }
  return { mode, camera };
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  const v = Math.round(n * f) / f;
  return Object.is(v, -0) ? 0 : v;
}

export function formatView(state: CameraState): { m: string; c: string } {
  const vals =
    state.mode === "2d"
      ? [round(state.values[0] ?? 0, 4), round(state.values[1] ?? 0, 4), round(state.values[2] ?? 1, 3)]
      : state.values.map((n) => round(n, 4));
  return { m: state.mode, c: vals.join(",") };
}

/** Shallow-запись вида в URL: мёрж в текущий search (сохраняя q и прочее) + сохранение hash. */
export function writeViewToUrl(state: CameraState): void {
  const { m, c } = formatView(state);
  const params = new URLSearchParams(window.location.search);
  params.set("m", m);
  params.set("c", c);
  const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}
```

- [ ] **Step 5: Прогнать — зелено**

Run: `pnpm test url-view`
Expected: PASS (все describe-блоки).

- [ ] **Step 6: Экспортировать через баррель**

В `src/components/scene-3d/index.ts`:
- в строке экспорта типов порта добавить `CameraState`:
  ```ts
  export type { SceneRenderer, SceneRenderMode, CameraState } from "./scene-renderer";
  ```
- добавить новую строку:
  ```ts
  export { parseView, formatView, writeViewToUrl, type ParsedView } from "./url-view";
  ```

- [ ] **Step 7: Линт + коммит**

Run: `pnpm lint`
Expected: без ошибок в новых файлах.

```bash
git add src/components/scene-3d/url-view.ts src/components/scene-3d/url-view.test.ts \
  src/components/scene-3d/scene-renderer.ts src/components/scene-3d/index.ts
git commit -F - <<'EOF'
feat(scene-3d): url-view — сериализация вида камеры в URL (m/c)

CameraState + parseView (m/c независимо, finite + zoom>0, m-only)
+ formatView (4/3 знака, -0→0) + writeViewToUrl (shallow merge, hash).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 2: getCamera/applyCamera в рендерере (порт + база)

**Files:**
- Modify: `src/components/scene-3d/scene-renderer.ts` (2 метода в интерфейс)
- Modify: `src/components/scene-3d/three-scene-renderer.ts` (реализация)
- Create: `src/components/scene-3d/three-scene-renderer-camera.test.ts`

**Interfaces:**
- Consumes: `CameraState` (Task 1).
- Produces (на `SceneRenderer` и `ThreeSceneRenderer`):
  - `getCamera(): CameraState | null` — `null` если disposed / нет controls / нет модели.
  - `applyCamera(state: CameraState): void` — игнор при `state.mode !== this.mode`.

- [ ] **Step 1: Написать падающие тесты камеры (enhanced-mock)**

Создать `src/components/scene-3d/three-scene-renderer-camera.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Enhanced-mock: реальный target с x/y/z + реестр слушателей + dispatch (для Task 3).
vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    enableDamping = true;
    enableRotate = true;
    mouseButtons: Record<string, unknown> = {};
    target = {
      x: 0, y: 0, z: 0,
      set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; },
    };
    listeners: Record<string, Array<() => void>> = {};
    update = vi.fn();
    addEventListener = (type: string, cb: () => void) => {
      (this.listeners[type] ||= []).push(cb);
    };
    dispatch(type: string) { (this.listeners[type] || []).forEach((cb) => cb()); }
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

import type { SceneRenderModel } from "./scene-render-model";
import { ThreeSceneRenderer } from "./three-scene-renderer";

function pickCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 200, clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}
function model1(): SceneRenderModel {
  return {
    count: 1,
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 1, 1]),
    ids: ["pt-A"],
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  };
}

describe("getCamera/applyCamera", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("getCamera = null до модели и после destroy", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    expect(r.getCamera()).toBeNull(); // нет модели
    r.setModel(model1());
    expect(r.getCamera()).not.toBeNull();
    r.destroy();
    expect(r.getCamera()).toBeNull(); // disposed
  });

  it("2D round-trip: applyCamera → getCamera", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1()); // mode по умолчанию 2d, fit → центр (0,0), zoom 1
    r.applyCamera({ mode: "2d", values: [5, 6, 2] });
    expect(r.getCamera()).toEqual({ mode: "2d", values: [5, 6, 2] });
    r.destroy();
  });

  it("3D round-trip: applyCamera → getCamera", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    r.setMode("3d");
    r.applyCamera({ mode: "3d", values: [1, 2, 3, 4, 5, 6] });
    expect(r.getCamera()).toEqual({ mode: "3d", values: [1, 2, 3, 4, 5, 6] });
    r.destroy();
  });

  it("mode-guard: applyCamera с чужим режимом — no-op", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1()); // 2d
    r.applyCamera({ mode: "2d", values: [5, 6, 2] });
    r.applyCamera({ mode: "3d", values: [9, 9, 9, 9, 9, 9] }); // игнор
    expect(r.getCamera()).toEqual({ mode: "2d", values: [5, 6, 2] });
    r.destroy();
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm test three-scene-renderer-camera`
Expected: FAIL — `r.getCamera is not a function`.

- [ ] **Step 3: Добавить методы в порт**

В `src/components/scene-3d/scene-renderer.ts` импортный тип уже есть (`CameraState` в этом же файле). В интерфейс `SceneRenderer` добавить перед `destroy()`:

```ts
  /** Текущая камера → сериализуемый снимок. null если disposed/нет controls/нет модели. */
  getCamera(): CameraState | null;
  /** Применить сохранённый снимок. Игнор, если state.mode не совпал с текущим режимом. */
  applyCamera(state: CameraState): void;
```

- [ ] **Step 4: Реализовать в базе**

В `src/components/scene-3d/three-scene-renderer.ts`:
- обновить импорт типов: `import type { CameraState, SceneRenderer, SceneRenderMode } from "./scene-renderer";`
- добавить методы (например, сразу после `getViewProjection()`):

```ts
  getCamera(): CameraState | null {
    if (this.disposed || !this.controls || !this.model) return null;
    const t = this.controls.target;
    if (this.mode === "2d") {
      return { mode: "2d", values: [t.x, t.y, this.ortho.zoom] };
    }
    const p = this.persp.position;
    return { mode: "3d", values: [p.x, p.y, p.z, t.x, t.y, t.z] };
  }

  applyCamera(state: CameraState): void {
    if (this.disposed || !this.controls || state.mode !== this.mode) return;
    if (state.mode === "2d") {
      const [tx, ty, zoom] = state.values as [number, number, number];
      this.ortho.position.set(tx, ty, 10);
      this.ortho.up.set(0, 1, 0);
      this.ortho.zoom = zoom;
      this.ortho.lookAt(tx, ty, 0);
      this.ortho.updateProjectionMatrix();
      this.controls.target.set(tx, ty, 0);
    } else {
      const [px, py, pz, tx, ty, tz] = state.values as [number, number, number, number, number, number];
      this.persp.position.set(px, py, pz);
      this.persp.lookAt(tx, ty, tz);
      this.persp.updateProjectionMatrix();
      this.controls.target.set(tx, ty, tz);
    }
    this.controls.update();
    this.dirty = true;
  }
```

- [ ] **Step 5: Прогнать — зелено**

Run: `pnpm test three-scene-renderer-camera`
Expected: PASS (4 теста).

- [ ] **Step 6: Линт + коммит**

Run: `pnpm lint`

```bash
git add src/components/scene-3d/scene-renderer.ts \
  src/components/scene-3d/three-scene-renderer.ts \
  src/components/scene-3d/three-scene-renderer-camera.test.ts
git commit -F - <<'EOF'
feat(scene-3d): getCamera/applyCamera на базовом рендерере

2D=[tx,ty,zoom] / 3D=[pos+target]; guard по disposed/model и
по mode-mismatch. Round-trip покрыт тестами (enhanced-mock OrbitControls).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 3: onSettle + settle-watch (порт + база)

**Files:**
- Modify: `src/components/scene-3d/scene-renderer.ts` (метод `onSettle`)
- Modify: `src/components/scene-3d/three-scene-renderer.ts` (поля + armSettle/clearSettle + слушатели в applyMode + чистка в destroy)
- Modify: `src/components/scene-3d/three-scene-renderer-camera.test.ts` (тесты settle)

**Interfaces:**
- Produces: `onSettle(cb: () => void): void` — `cb` зовётся по ОСЕДАНИЮ камеры после пользовательского жеста (`'end'` + idle ~200мс с ре-армом на `'change'`-глайде). Программные движения (`fitToBounds`/`applyCamera`) `cb` НЕ вызывают. Таймер чистится в `applyMode` (смена режима) и `destroy()` (teardown).

- [ ] **Step 1: Дописать падающие тесты settle-watch**

В конец `src/components/scene-3d/three-scene-renderer-camera.test.ts` добавить блок:

```ts
describe("onSettle / settle-watch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  type Ctl = { dispatch(type: string): void };
  const ctl = (r: ThreeSceneRenderer): Ctl =>
    (r as unknown as { controls: Ctl }).controls;

  it("'end' → idle 200мс → settleCb один раз", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    const cb = vi.fn();
    r.onSettle(cb);
    ctl(r).dispatch("end");
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalledTimes(1);
    r.destroy();
  });

  it("'change'-глайд ре-армит таймер (запись после оседания)", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    const cb = vi.fn();
    r.onSettle(cb);
    ctl(r).dispatch("end");
    vi.advanceTimersByTime(150);
    ctl(r).dispatch("change"); // ре-арм
    vi.advanceTimersByTime(150); // 150 < 200 c последнего change
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(1);
    r.destroy();
  });

  it("программный 'change' без 'end' НЕ пишет", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    const cb = vi.fn();
    r.onSettle(cb);
    ctl(r).dispatch("change"); // нет awaitingSettle
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
    r.destroy();
  });

  it("смена режима отменяет отложенный settle (E1)", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    const cb = vi.fn();
    r.onSettle(cb);
    ctl(r).dispatch("end");
    r.setMode("3d"); // applyMode → clearSettle
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
    r.destroy();
  });

  it("destroy отменяет отложенный settle (A1)", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    const cb = vi.fn();
    r.onSettle(cb);
    ctl(r).dispatch("end");
    r.destroy();
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm test three-scene-renderer-camera`
Expected: FAIL — `r.onSettle is not a function`.

- [ ] **Step 3: Добавить `onSettle` в порт**

В `src/components/scene-3d/scene-renderer.ts`, рядом с `getCamera`/`applyCamera`:

```ts
  /** Колбэк по оседанию камеры после жеста (для записи вида в URL). */
  onSettle(cb: () => void): void;
```

- [ ] **Step 4: Реализовать settle-watch в базе**

В `src/components/scene-3d/three-scene-renderer.ts`:

(а) Поля рядом с `private changeCb` (около строки 36):

```ts
  private settleCb: (() => void) | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingSettle = false;
```

И константа idle рядом с верхними константами файла (около строки 10):

```ts
const SETTLE_IDLE_MS = 200; // тишина после последнего change → камера осела
```

(б) Метод `onSettle` рядом с `onChange`:

```ts
  onSettle(cb: () => void): void {
    this.settleCb = cb;
  }

  private armSettle(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.awaitingSettle = false;
      this.settleCb?.();
    }, SETTLE_IDLE_MS);
  }

  private clearSettle(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.awaitingSettle = false;
  }
```

(в) В `applyMode()` — в самом начале метода (первой строкой) добавить `this.clearSettle();`, а блок установки слушателей заменить так, чтобы `change` ре-армил глайд и появился `end`:

```ts
      this.controls.addEventListener("change", () => {
        this.dirty = true;
        if (this.awaitingSettle) this.armSettle(); // ре-арм на инерции damping
      });
      this.controls.addEventListener("end", () => {
        this.awaitingSettle = true;
        this.armSettle();
      });
```

(г) В `destroy()` — после `this.disposed = true;` добавить `this.clearSettle();`.

- [ ] **Step 5: Прогнать — зелено**

Run: `pnpm test three-scene-renderer-camera`
Expected: PASS (4 камера-теста + 5 settle-тестов).

- [ ] **Step 6: Регресс существующих тестов рендерера**

Run: `pnpm test three-scene-renderer`
Expected: PASS — старый `three-scene-renderer.test.ts` не сломан (его mock не вызывает `end`/`change`, settle-таймер не взводится).

- [ ] **Step 7: Линт + коммит**

```bash
git add src/components/scene-3d/scene-renderer.ts \
  src/components/scene-3d/three-scene-renderer.ts \
  src/components/scene-3d/three-scene-renderer-camera.test.ts
git commit -F - <<'EOF'
feat(scene-3d): onSettle + settle-watch в рендерере

Запись по оседанию камеры ('end' + idle 200мс, ре-арм на change-глайде);
таймер чистится в applyMode (E1) и destroy (A1); программные движения
не пишут. Тайминг изолирован в рендерере, гонки закрыты на уровне базы.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 4: Обвязка карты (page → wrapper → view)

**Files:**
- Modify: `src/app/map/page.tsx`
- Modify: `src/features/semantic-map/ui/semantic-map.tsx`
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx`

**Interfaces:**
- Consumes: `parseView`, `writeViewToUrl`, `type ParsedView`, `CameraState`/`getCamera`/`applyCamera`/`onSettle` (Tasks 1–3).
- Produces: карта читает `?m=&c=`, восстанавливает камеру и режим, пишет вид по оседанию и по тоглу режима.

- [ ] **Step 1: page.tsx — парс m/c → initialView**

В `src/app/map/page.tsx`:
- расширить тип searchParams: `searchParams: Promise<{ q?: string; m?: string; c?: string }>;`
- импорт: `import { ... , parseView } from "@/components/scene-3d";` (рядом с другими импортами компонента)
- после `const q = sp.q?.trim();` добавить: `const initialView = parseView({ m: sp.m, c: sp.c });`
- в JSX-рендер `<SemanticMap ... />` добавить проп `initialView={initialView}` (в обеих ветках, где рендерится `SemanticMap` — здесь она одна, строка ~50):
  ```tsx
  <SemanticMap data={result.map} initialView={initialView} {...(overlay !== undefined ? { overlay } : {})} />
  ```

- [ ] **Step 2: wrapper — пробросить initialView**

В `src/features/semantic-map/ui/semantic-map.tsx`:
- импорт типа: `import type { ParsedView } from "@/components/scene-3d";`
- сигнатуру и проброс:
  ```tsx
  export function SemanticMap({
    data, overlay, initialView,
  }: { data: MapData; overlay?: MapOverlay; initialView: ParsedView }) {
    return <View data={data} initialView={initialView} {...(overlay !== undefined ? { overlay } : {})} />;
  }
  ```

- [ ] **Step 3: view — init режима из URL + restore + write**

В `src/features/semantic-map/ui/semantic-map-view.tsx`:

(а) импорты из `@/components/scene-3d` дополнить `writeViewToUrl` и типом `ParsedView`:
```ts
import { SceneCanvasIsolation, readSavedMode, writeViewToUrl, type ParsedView } from "@/components/scene-3d";
```

(б) сигнатура и init состояния:
```ts
export default function SemanticMapView({
  data, overlay, initialView,
}: { data: MapData; overlay?: MapOverlay; initialView: ParsedView }) {
```
заменить инициализацию режима (строки с `useState`/`modeRef`):
```ts
  const [mode, setMode] = useState<RenderMode>(() => initialView.mode ?? readSavedMode(MODE_KEY));
  const modeRef = useRef<RenderMode>(initialView.mode ?? readSavedMode(MODE_KEY));
```

(в) ref на initialView (рядом с matchedRef/reduceRef), чтобы lifecycle-эффект читал актуальное без добавления в deps:
```ts
  const initialViewRef = useRef(initialView);
  initialViewRef.current = initialView;
```

(г) внутри lifecycle-эффекта `[model]`: подписать settle-write сразу после `r.onChange(updateLabels);`:
```ts
    r.onSettle(() => {
      const v = r.getCamera();
      if (v) writeViewToUrl(v);
    });
```
и применить restore ПОСЛЕДНИМ камера-шагом — после `setOverlay` (в самом конце блока установки, перед `const ro = new ResizeObserver`):
```ts
    const cam0 = initialViewRef.current.camera;
    if (cam0) r.applyCamera(cam0);
```

(д) ref-страж первого прогона mode-эффекта (рядом с остальными useRef):
```ts
  const modeWriteSkip = useRef(true);
```
и mode-эффект дополнить записью с пропуском первого прогона:
```ts
  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
    if (modeWriteSkip.current) {
      modeWriteSkip.current = false;
      return;
    }
    const v = rendererRef.current?.getCamera();
    if (v) writeViewToUrl(v);
  }, [mode]);
```

- [ ] **Step 4: Линт + типы + сборка**

Run: `pnpm lint`
Expected: без ошибок (react-hooks/exhaustive-deps не ругается — `initialView` читается только в инициализаторах/через ref).

Run: `pnpm build`
Expected: успешная сборка (типы page↔wrapper↔view согласованы).

- [ ] **Step 5: Коммит**

```bash
git add src/app/map/page.tsx src/features/semantic-map/ui/semantic-map.tsx \
  src/features/semantic-map/ui/semantic-map-view.tsx
git commit -F - <<'EOF'
feat(semantic-map): вид камеры в URL (restore + write)

page парсит m/c → initialView; режим инициализируется из URL
(URL > localStorage, фикс H1); restore последним камера-шагом;
settle-write по оседанию; mode-write с пропуском первого прогона.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 5: Обвязка графа (page → wrapper → view)

**Files:**
- Modify: `src/app/graph/page.tsx`
- Modify: `src/features/reference-graph/ui/graph.tsx`
- Modify: `src/features/reference-graph/ui/graph-view.tsx`

**Interfaces:**
- Consumes: то же, что Task 4.
- Produces: граф читает `?m=&c=`, восстанавливает камеру/режим, пишет вид. **Внимание:** эффект graph-view имеет deps `[model, labelNodes, typeById, router]` — settle/restore вешаются на ЭТОТ эффект (его lifecycle покрывает все пересоздания рендерера; `destroy()` чистит settle-таймер).

- [ ] **Step 1: page.tsx — приём searchParams + initialView**

В `src/app/graph/page.tsx`:
- импорт: добавить `parseView` к импорту из `@/components/scene-3d`:
  ```ts
  import { SceneStatePanel, parseView } from "@/components/scene-3d";
  ```
- сигнатура (страница уже динамическая — зовёт `getGraph()` на запрос, static→dynamic регрессии нет):
  ```ts
  export default async function GraphPage({
    searchParams,
  }: {
    searchParams: Promise<{ m?: string; c?: string }>;
  }) {
    const sp = await searchParams;
    const initialView = parseView({ m: sp.m, c: sp.c });
    const result = await getGraph();
  ```
- в JSX `<Graph data={result.graph} />` → `<Graph data={result.graph} initialView={initialView} />`

- [ ] **Step 2: wrapper — пробросить initialView**

В `src/features/reference-graph/ui/graph.tsx`:
- импорт типа: `import type { ParsedView } from "@/components/scene-3d";`
- сигнатура:
  ```tsx
  export function Graph({ data, initialView }: { data: GraphData; initialView: ParsedView }) {
    return <View data={data} initialView={initialView} />;
  }
  ```

- [ ] **Step 3: view — init режима из URL + restore + write**

В `src/features/reference-graph/ui/graph-view.tsx`:

(а) импорт дополнить `writeViewToUrl` и типом `ParsedView`:
```ts
import {
  SceneCanvasIsolation,
  SceneModeToggle,
  SceneRegionLabels,
  readSavedMode,
  writeViewToUrl,
  projectToScreen,
  type ParsedView,
  type ProjectedLabel,
  type SceneRenderer,
  type SceneRenderMode,
} from "@/components/scene-3d";
```

(б) сигнатура + init режима:
```ts
export default function GraphView({ data, initialView }: { data: GraphData; initialView: ParsedView }) {
```
заменить инициализацию режима:
```ts
  const [mode, setMode] = useState<SceneRenderMode>(() => initialView.mode ?? readSavedMode(MODE_KEY));
  const modeRef = useRef<SceneRenderMode>(initialView.mode ?? readSavedMode(MODE_KEY));
```

(в) ref на initialView и страж mode-записи (рядом с reduceRef):
```ts
  const initialViewRef = useRef(initialView);
  initialViewRef.current = initialView;
  const modeWriteSkip = useRef(true);
```

(г) в lifecycle-эффекте (deps `[model, labelNodes, typeById, router]`) после `r.onChange(updateLabels);` добавить:
```ts
    r.onSettle(() => {
      const v = r.getCamera();
      if (v) writeViewToUrl(v);
    });
```
и restore последним камера-шагом — после `r.setReducedMotion(reduceRef.current);`, перед `const ro = new ResizeObserver`:
```ts
    const cam0 = initialViewRef.current.camera;
    if (cam0) r.applyCamera(cam0);
```

(д) mode-эффект дополнить записью с пропуском первого прогона:
```ts
  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
    if (modeWriteSkip.current) {
      modeWriteSkip.current = false;
      return;
    }
    const v = rendererRef.current?.getCamera();
    if (v) writeViewToUrl(v);
  }, [mode]);
```

- [ ] **Step 4: Линт + сборка**

Run: `pnpm lint`
Expected: без ошибок.

Run: `pnpm build`
Expected: успешная сборка.

- [ ] **Step 5: Коммит**

```bash
git add src/app/graph/page.tsx src/features/reference-graph/ui/graph.tsx \
  src/features/reference-graph/ui/graph-view.tsx
git commit -F - <<'EOF'
feat(reference-graph): вид камеры в URL (restore + write)

graph/page начинает читать searchParams (m/c) → initialView; режим
из URL; restore/settle-write/mode-write — на широком lifecycle-эффекте
графа (deps model+labelNodes+typeById+router).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 6: Финальная верификация (гейт + ручная браузер-QA)

**Files:** нет правок — только проверка.

- [ ] **Step 1: Полный зелёный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное; новые тесты `url-view` и `three-scene-renderer-camera` в прогоне.

- [ ] **Step 2: Ручная браузер-QA (локальный стек: бек :8090, фронт `pnpm dev` :3001)**

Чек-лист (отметить факт прохождения):
- [ ] `/map`: подвигать камеру (pan/zoom) → URL обновляется `?m=&c=` ПОСЛЕ оседания (не на каждый кадр).
- [ ] Скопировать ссылку, открыть в новой вкладке → камера ровно та же.
- [ ] **Шаринг с другим режимом (H1):** в одной вкладке выставить 3D и подвигать; во второй вкладке (где локально был 2D) открыть ссылку → открывается 3D с тем же ракурсом, тогл показывает 3D.
- [ ] F5 на `/map` с непустым `?m=&c=` → камера восстановлена, не сброшена на «весь кадр».
- [ ] Тогл 2D⇄3D → URL обновился (новый `m` + fitted-камера); рефреш сохраняет режим.
- [ ] **A1:** подвигать камеру и в течение ~0.2с кликнуть узел графа (переход на `/documents/...`) → на целевой странице в URL НЕТ чужих `m/c`.
- [ ] **E1:** быстро: pan, затем сразу тогл режима → в URL согласованные `m`/`c` (длина 3 для 2d, 6 для 3d), страница не мигает на дефолтный вид.
- [ ] Битый URL (`/map?m=3d&c=oops`) → страница грузится, камера на авто-fit, без ошибок в консоли.
- [ ] `?q=...` на карте: запись камеры не сносит `q` (оверлей поиска остаётся).
- [ ] `/graph`: те же проверки (без `?q=`).
- [ ] То же на reduced-motion (appearance → motion reduced): запись срабатывает, инерции нет.

- [ ] **Step 3: Отметить выполнение**

Если все пункты QA зелёные — функционал готов. Незакрытые пункты вынести в follow-up.

---

## Self-Review

**1. Покрытие спеки:**
- §3 формат `m`/`c`, округление 4/3, finite, zoom>0 → Task 1 (parseView/formatView + тесты).
- §4.1 getCamera/applyCamera (+guard disposed/model/mode) → Task 2; onSettle + settle-watch (арм/ре-арм/чистка в applyMode+destroy) → Task 3.
- §4.2 url-view (parseView m/c независимо, writeViewToUrl merge+hash) + экспорт через index.ts → Task 1.
- §5.1 IN: парс на сервере, init режима `initialView.mode ?? localStorage` (H1), restore последним шагом без restoredRef → Task 4/5.
- §5.2 OUT: onSettle→getCamera→writeViewToUrl → Task 4/5.
- §5.3 mode-write с пропуском первого прогона → Task 4/5.
- §6 edge: битый/частичный URL, m-only, A1/E1, q-merge, reduced-motion → Task 1 (unit) + Task 6 (QA).
- §7 тесты: pure + renderer-mock юнит + ручная QA → Tasks 1–3, 6.
- §8 объём/задачи (index.ts экспорт, ленивые обёртки, graph searchParams, широкие deps графа) → Tasks 1,4,5.

**2. Плейсхолдеры:** нет TBD/TODO; весь код приведён целиком; команды с ожидаемым выводом.

**3. Согласованность типов:** `CameraState`/`ParsedView`/`parseView`/`formatView`/`writeViewToUrl`/`getCamera`/`applyCamera`/`onSettle` — имена и сигнатуры идентичны во всех тасках. `MapRenderer extends SceneRenderer`, `ThreeMapRenderer`/`ThreeGraphRenderer extends ThreeSceneRenderer` — методы базы доступны обеим поверхностям без отдельных правок портов. Эффект графа использует фактические deps `[model, labelNodes, typeById, router]` (не `[model]`).

**4. Порядок задач:** каждая оставляет билд зелёным (интерфейс и реализация добавляются в одной задаче); 1→2→3 фундамент, 4/5 независимые обвязки, 6 — гейт.
