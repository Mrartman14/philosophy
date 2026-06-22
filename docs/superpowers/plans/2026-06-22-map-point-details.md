# Semantic Map Point Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить нетто-новую способность карты смыслов — детали точки-чанка по клику. Реализовать picking в рендерере (сейчас стаб), добавить server action `getMapPointDetails`, протянуть `Layout.documents` во view и показать overlay-карточку с заголовком документа, snippet'ом, chunk_ord и ссылкой на `/documents/[doc]`.

**Architecture:** Два слоя. (1) **Picking** — чистая попиксельная математика `pickNearestPoint` (проекция всех точек через существующий `projectToScreen` + ближайшая в пределах пиксельного порога) вынесена в `renderer/pick.ts`; `ThreeMapRenderer.onPick` вешает `pointerdown`/`pointerup` на canvas, отсекает драг и зовёт cb с `model.ids[index]` или `null`. three.js остаётся за портом `MapRenderer` — view три-агностичен. (2) **Данные+UI** — server action `getMapPointDetails(ids)` POST'ит `/api/map/points`, возвращает `Record<pointId, PointDetail>`; view по клику фетчит деталь одной точки и рисует overlay-карточку; заголовок резолвится из `MapData.documents[detail.doc]`.

**Tech Stack:** Next.js App Router, TypeScript, three.js (за портом), openapi-fetch, next-intl, vitest + @testing-library/react, pnpm.

**Спека:** [docs/superpowers/specs/2026-06-22-map-point-details-design.md](../specs/2026-06-22-map-point-details-design.md)

## Global Constraints

- Пакетный менеджер — **pnpm** (никогда npm). Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.
- Имена файлов в `src/` — **kebab-case**.
- `git add` — **только перечисленные файлы по имени**. Запрещены `git add -A/.`, `git stash/reset/checkout .//clean`. Не трогать чужие изменения.
- Каждый commit заканчивается строкой: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Ownership слайса semantic-map: порт `MapRenderer` НЕ должен протекать three.js во view. Picking реализуется внутри `ThreeMapRenderer`; наружу — только `onPick(cb)` из порта.
- Строится поверх уже отгруженных doc-keyed `RenderModel` + `matchOverlay`; overlay-фикс НЕ перепроектируем.
- `src/i18n/*` — foundation-зона: касаем только `messages/{ru,en}/semanticMap.ts` (добавление ключей в существующий namespace слайса), паритет ru/en обязателен.
- `point.id` ↔ `RenderModel.ids[i]`, координаты ↔ `RenderModel.positions[i*3..i*3+2]` — индекс точки общий для positions/ids/docs.

---

## File Structure

**Создаём:**
- `src/features/semantic-map/renderer/pick.ts` — чистая математика `pickNearestPoint`.
- `src/features/semantic-map/renderer/pick.test.ts` — тест математики.
- `src/features/semantic-map/actions.ts` — server action `getMapPointDetails`.
- `src/features/semantic-map/actions.test.ts` — тест action.
- `src/features/semantic-map/ui/map-point-panel.tsx` — overlay-карточка деталей.
- `src/features/semantic-map/ui/map-point-panel.test.tsx` — тест панели.

**Изменяем:**
- `src/features/semantic-map/renderer/three-map-renderer.ts` — реализация `onPick` + pointer-плумбинг.
- `src/features/semantic-map/renderer/index.ts` — экспорт `pickNearestPoint`.
- `src/features/semantic-map/types.ts` — экспорт типа `MapPointDetail`.
- `src/features/semantic-map/index.ts` — реэкспорт `getMapPointDetails`, `MapPointDetail`.
- `src/features/semantic-map/ui/semantic-map-view.tsx` — проброс `documents`, wire `onPick`, fetch, панель.
- `src/i18n/messages/ru/semanticMap.ts`, `src/i18n/messages/en/semanticMap.ts` — строки панели.

---

### Task 1: Чистая математика picking (`pick.ts`)

**Files:**
- Create: `src/features/semantic-map/renderer/pick.ts`
- Test: `src/features/semantic-map/renderer/pick.test.ts`

**Interfaces:**
- Consumes: `projectToScreen` (`./project`).
- Produces:
  - `pickNearestPoint(positions: Float32Array, count: number, viewProj: ArrayLike<number>, width: number, height: number, px: number, py: number, threshold: number): number` — индекс ближайшей ВИДИМОЙ точки в пределах `threshold` пикселей от `(px, py)`, либо `-1`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/semantic-map/renderer/pick.test.ts
import { describe, it, expect } from "vitest";

import { pickNearestPoint } from "./pick";

// Column-major identity 4x4 — projectToScreen: NDC=world, [0,0,0]→центр экрана.
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const W = 200;
const H = 100;

describe("pickNearestPoint", () => {
  it("точка в центре: клик ровно по ней → её индекс", () => {
    const positions = new Float32Array([0, 0, 0]); // → экранный центр (100,50)
    expect(pickNearestPoint(positions, 1, I, W, H, 100, 50, 8)).toBe(0);
  });

  it("клик дальше порога → -1", () => {
    const positions = new Float32Array([0, 0, 0]); // центр (100,50)
    expect(pickNearestPoint(positions, 1, I, W, H, 140, 50, 8)).toBe(-1);
  });

  it("две точки: берётся ближайшая по пикселям", () => {
    // p0 → (100,50); p1 (x=0.5) → ndcX=0.5 → sx=(0.75)*200=150, sy=50.
    const positions = new Float32Array([0, 0, 0, 0.5, 0, 0]);
    expect(pickNearestPoint(positions, 2, I, W, H, 148, 50, 20)).toBe(1);
    expect(pickNearestPoint(positions, 2, I, W, H, 104, 50, 20)).toBe(0);
  });

  it("невидимая точка (вне куба NDC) игнорируется", () => {
    const positions = new Float32Array([5, 0, 0]); // visible=false
    expect(pickNearestPoint(positions, 1, I, W, H, 100, 50, 1000)).toBe(-1);
  });

  it("пустое облако → -1", () => {
    expect(pickNearestPoint(new Float32Array(0), 0, I, W, H, 100, 50, 8)).toBe(-1);
  });

  it("на границе порога (==threshold) считается попаданием", () => {
    const positions = new Float32Array([0, 0, 0]); // центр (100,50)
    // клик на 8px вправо, threshold 8 → попадание.
    expect(pickNearestPoint(positions, 1, I, W, H, 108, 50, 8)).toBe(0);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/pick.test.ts`
Expected: FAIL — `Cannot find module "./pick"`.

- [ ] **Step 3: Реализовать модуль**

```ts
// src/features/semantic-map/renderer/pick.ts
// Чистая математика picking: какая точка облака ближе всего к клику (в пикселях).
// Переиспользует projectToScreen (та же проекция, что и подписи кластеров) —
// единый путь world→screen, без второго механизма через THREE.Raycaster.
// Размер точек пиксельный (sizeAttenuation:false), поэтому и порог — в пикселях.
import { projectToScreen } from "./project";

/**
 * Индекс ближайшей ВИДИМОЙ точки в пределах `threshold` пикселей от (px, py),
 * либо -1. positions — count*3 (x,y,z на точку), как RenderModel.positions.
 * viewProj — column-major 4x4 (MapRenderer.getViewProjection).
 */
export function pickNearestPoint(
  positions: Float32Array,
  count: number,
  viewProj: ArrayLike<number>,
  width: number,
  height: number,
  px: number,
  py: number,
  threshold: number,
): number {
  let best = -1;
  // Сравниваем квадраты расстояний — без sqrt в цикле.
  let bestSq = threshold * threshold;
  for (let i = 0; i < count; i++) {
    const s = projectToScreen(
      [positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0],
      viewProj,
      width,
      height,
    );
    if (!s.visible) continue;
    const dx = s.x - px;
    const dy = s.y - py;
    const sq = dx * dx + dy * dy;
    if (sq <= bestSq) {
      bestSq = sq;
      best = i;
    }
  }
  return best;
}
```

> `<=` на пороге: клик ровно на границе радиуса считается попаданием (см. тест «на границе»). При равенстве расстояний выигрывает последняя проверенная точка — детерминированно для одинаковых позиций, на практике несущественно.

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/pick.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Экспортировать из renderer-барреля**

В `src/features/semantic-map/renderer/index.ts` добавить строку:

```ts
export { pickNearestPoint } from "./pick";
```

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/renderer/pick.ts src/features/semantic-map/renderer/pick.test.ts src/features/semantic-map/renderer/index.ts
git commit -m "feat(semantic-map): чистая математика picking (screen-space nearest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Реализовать `onPick` в `ThreeMapRenderer`

**Files:**
- Modify: `src/features/semantic-map/renderer/three-map-renderer.ts` (поля + `mount` + `onPick` + `destroy`)
- Test: `src/features/semantic-map/renderer/three-map-renderer.test.ts` (дополнить)

**Interfaces:**
- Consumes: `pickNearestPoint` (Task 1), собственный `getViewProjection()`, `this.model.ids`/`positions`/`count`.
- Produces: `onPick(cb: (id: string | null) => void): void` — теперь реальный. По `pointerup` (если не было драга) проецирует клик, зовёт `cb(model.ids[idx] ?? null)` или `cb(null)` при промахе. Порт не меняется (сигнатура уже в `map-renderer.ts:30`).

Константы внутри класса: `PICK_THRESHOLD_PX = 10` (радиус попадания), `DRAG_SUPPRESS_PX = 5` (смещение, выше которого жест — драг, не клик).

- [ ] **Step 1: Дополнить тест (падающий)**

Добавить в `src/features/semantic-map/renderer/three-map-renderer.test.ts`. Фейковый canvas теперь должен уметь `getBoundingClientRect` и `addEventListener` (реальный EventTarget), и тест стаббит `getViewProjection`, чтобы проекция была предсказуемой (identity).

```ts
// --- добавить в конец файла ---

import { pickNearestPoint } from "./pick";

// Фейковый canvas с реальной шиной событий + rect.
function pickCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 200,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function model1() {
  // одна точка в центре мира → экранный центр (100,50) при identity vp.
  return {
    count: 1,
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 1, 1]),
    ids: ["pt-A"],
    docs: ["doc-1"],
    bounds: { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] },
    clusters: [],
  };
}

function down(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: x, clientY: y }));
}
function up(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: x, clientY: y }));
}

describe("ThreeMapRenderer.onPick", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("клик по точке → cb(point.id)", () => {
    const r = new ThreeMapRenderer();
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

  it("клик в пустоту → cb(null)", () => {
    const r = new ThreeMapRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 10, 10);
    up(canvas, 10, 10);
    expect(cb).toHaveBeenCalledWith(null);
    r.destroy();
  });

  it("драг (смещение > порога) НЕ триггерит pick", () => {
    const r = new ThreeMapRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 100, 50);
    up(canvas, 140, 80); // ушёл далеко → это пан/орбита, не клик
    expect(cb).not.toHaveBeenCalled();
    r.destroy();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/three-map-renderer.test.ts`
Expected: FAIL — `onPick` стаб игнорирует cb, ассерты `toHaveBeenCalledWith` падают.

- [ ] **Step 3: Реализовать picking в рендерере**

В `src/features/semantic-map/renderer/three-map-renderer.ts`:

1. Добавить импорт рядом с прочими `./`-импортами:

```ts
import { pickNearestPoint } from "./pick";
```

2. Добавить поля в класс (рядом с `private reducedMotion = false;`):

```ts
  private canvas: HTMLCanvasElement | null = null;
  private pickCb: ((id: string | null) => void) | null = null;
  /** Позиция pointerdown (canvas-local) — чтобы отличить клик от драга. */
  private downAt: { x: number; y: number } | null = null;
```

3. Добавить константы (модульного уровня, рядом с `disposePoints`/`makeRingTexture` внизу файла, либо как `private static readonly` — выбрать единый стиль; ниже модульные):

```ts
const PICK_THRESHOLD_PX = 10;  // радиус попадания по точке
const DRAG_SUPPRESS_PX = 5;    // смещение, выше которого жест — драг, не клик
```

4. В `mount(canvas)` сохранить canvas и навесить слушатели (после `this.loop();`):

```ts
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
```

5. Заменить стаб `onPick` и добавить обработчики (стрелочные поля — стабильная ссылка для remove в destroy):

```ts
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
    // Драг (пан/орбита) — не клик: гасим, чтобы навигация не открывала панель.
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
```

6. В `destroy()` снять слушатели и обнулить поля (рядом с `this.controls?.dispose();`):

```ts
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
    }
    this.canvas = null;
    this.pickCb = null;
    this.downAt = null;
```

> Примечание по координатам: `pickNearestPoint` работает в CSS-пикселях canvas (`this.width`/`this.height` — те же CSS-пиксели, что передаёт `resize` из `wrap.clientWidth`), а `projectToScreen` маппит NDC на `[0..width]×[0..height]`. Поэтому canvas-local координаты pointer'а и проекция точек в одной системе — согласованно. DPR не участвует (он лишь множит backing-store, не CSS-размер).

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/three-map-renderer.test.ts`
Expected: PASS (исходные 3 + новые 3 теста). Если jsdom `PointerEvent` недоступен — заменить в тесте на `new Event("pointerdown")` + `Object.assign` с `clientX/clientY` (как уже сделано в `down`/`up` хелперах), сигнатура обработчика принимает `PointerEvent`, но в рантайме читает только `clientX/clientY`.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/renderer/three-map-renderer.ts src/features/semantic-map/renderer/three-map-renderer.test.ts
git commit -m "feat(semantic-map): реальный onPick в ThreeMapRenderer (клик→point.id, drag-suppress)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Server action `getMapPointDetails`

**Files:**
- Create: `src/features/semantic-map/actions.ts`
- Test: `src/features/semantic-map/actions.test.ts`
- Modify: `src/features/semantic-map/types.ts` (экспорт `MapPointDetail`)

**Interfaces:**
- Consumes: `createApiClient` (`@/api/client`), `rethrowApiError` (`@/utils/api-error`), `createAction` (`@/utils/create-action`).
- Produces:
  - `MapPointDetail = components["schemas"]["semmap.PointDetail"]` (тип, из `types.ts`).
  - `getMapPointDetails(ids: string[]): Promise<ActionResult<Record<string, MapPointDetail>>>` — POST `/api/map/points` с `{ ids }`, возвращает `data` (карта `pointId → detail`) или `{}` если пусто; ошибки маппятся через `rethrowApiError`.

- [ ] **Step 1: Добавить тип `MapPointDetail` в `types.ts`**

В `src/features/semantic-map/types.ts` рядом с прочими `export type` из схемы:

```ts
export type MapPointDetail = components["schemas"]["semmap.PointDetail"];
```

- [ ] **Step 2: Написать падающий тест**

```ts
// src/features/semantic-map/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const post = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
}));
// getMe не нужен (optional-auth, без requireCapability), но createApiClient мокнут целиком.
vi.mock("@/i18n", async (orig) => {
  const o = await orig<typeof import("@/i18n")>();
  return { ...o, resolveErrorMessage: (k: string) => Promise.resolve(k) };
});

import { getMapPointDetails } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMapPointDetails", () => {
  it("200 + карта деталей → success с Record", async () => {
    post.mockResolvedValue({
      data: { data: { "pt-A": { doc: "doc-1", chunk_ord: 3, snippet: "hi" } }, error: undefined },
      error: undefined,
    });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res).toEqual({
      success: true,
      data: { "pt-A": { doc: "doc-1", chunk_ord: 3, snippet: "hi" } },
    });
    expect(post).toHaveBeenCalledWith("/api/map/points", { body: { ids: ["pt-A"] } });
  });

  it("неизвестный id просто отсутствует в карте", async () => {
    post.mockResolvedValue({ data: { data: {} }, error: undefined });
    const res = await getMapPointDetails(["nope"]);
    expect(res).toEqual({ success: true, data: {} });
  });

  it("пустой data → {}", async () => {
    post.mockResolvedValue({ data: {}, error: undefined });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res).toEqual({ success: true, data: {} });
  });

  it("413 REQUEST_BODY_TOO_LARGE → success:false", async () => {
    post.mockResolvedValue({ data: undefined, error: { code: "REQUEST_BODY_TOO_LARGE" } });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res.success).toBe(false);
  });

  it("422 с fields → success:false (validation)", async () => {
    post.mockResolvedValue({ data: undefined, error: { fields: { ids: "too many" } } });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/semantic-map/actions.test.ts`
Expected: FAIL — `Cannot find module "./actions"`.

- [ ] **Step 4: Реализовать action**

```ts
// src/features/semantic-map/actions.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { rethrowApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";

import type { MapPointDetail } from "./types";

/**
 * Детали точек карты по id (батч). Read-only, optional-auth, без Idempotency-Key.
 * Бэк резолвит ТОЛЬКО id из опубликованной публичной раскладки; неизвестные id
 * молча отсутствуют в ответе. v1 зовёт с одним id (клик), но сигнатура батчевая —
 * будущий вьюпорт-префетч (кэп 300) включается без смены контракта.
 */
export const getMapPointDetails = createAction(
  async (ids: string[]): Promise<Record<string, MapPointDetail>> => {
    const api = await createApiClient();
    const { data, error } = await api.POST("/api/map/points", { body: { ids } });
    if (error) rethrowApiError(error);
    return data?.data ?? {};
  },
  "getMapPointDetails",
);
```

> `createAction` оборачивает в `ActionResult`, маппит `ApiMessageError`/`Error` из `rethrowApiError` в `{ success:false, ... }`. Нет `requireCapability` — ручка optional-auth, публичная.

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/semantic-map/actions.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/actions.ts src/features/semantic-map/actions.test.ts src/features/semantic-map/types.ts
git commit -m "feat(semantic-map): server action getMapPointDetails (POST /api/map/points)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Протянуть `Layout.documents` через слайс наружу

**Files:**
- Modify: `src/features/semantic-map/index.ts` (реэкспорт action + тип)

**Interfaces:**
- Consumes: `getMapPointDetails` (Task 3), `MapPointDetail` (Task 3).
- Produces: публичный API слайса экспортирует `getMapPointDetails`, `MapPointDetail`. `Layout.documents` уже на `MapData` (тип контракта) — отдельного типа не нужно, view читает `data.documents` напрямую.

`MapData = semmap.Layout` уже несёт `documents?: { [docId]: string }` (см. `types.ts:8`, `schema.ts:16420`). Никакого нового поля городить не надо — нужно лишь сделать action и тип деталей доступными из `@/features/semantic-map` для page/view.

- [ ] **Step 1: Расширить публичный barrel**

В `src/features/semantic-map/index.ts` добавить:

```ts
export { getMapPointDetails } from "./actions";
export type { MapPointDetail } from "./types";
```

- [ ] **Step 2: Проверка типов/сборки (нет потребителей вне слайса пока — только экспорт)**

Run: `pnpm exec vitest run src/features/semantic-map`
Expected: PASS (существующие тесты слайса зелёные; новый экспорт не ломает).

Run: `pnpm exec tsc --noEmit`
Expected: успешно (action типизирован, реэкспорт валиден). Если tsc не настроен как отдельный скрипт — отложить проверку до `pnpm build` в Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/features/semantic-map/index.ts
git commit -m "feat(semantic-map): экспорт getMapPointDetails + MapPointDetail из слайса

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Панель деталей точки (`map-point-panel.tsx`) + i18n

**Files:**
- Create: `src/features/semantic-map/ui/map-point-panel.tsx`
- Test: `src/features/semantic-map/ui/map-point-panel.test.tsx`
- Modify: `src/i18n/messages/ru/semanticMap.ts`, `src/i18n/messages/en/semanticMap.ts`

**Interfaces:**
- Consumes: `MapPointDetail` (Task 3), `RouterLink`/`IconButton` (`@/components/ui`), `useT` (`@/i18n/client`).
- Produces:
  - `MapPointPanel({ detail, documents, onClose }: { detail: MapPointDetail; documents: Record<string, string>; onClose: () => void }): JSX` — overlay-карточка: заголовок (`documents[detail.doc]` или фолбэк `detail.doc`), snippet, chunk_ord, ссылка `/documents/[detail.doc]`, кнопка закрытия.

- [ ] **Step 1: Добавить строки в namespace `semanticMap` (ru)**

В `src/i18n/messages/ru/semanticMap.ts` добавить в объект:

```ts
  // map-point-panel.tsx — карточка деталей точки
  pointPanelClose: "Закрыть",
  pointPanelOpenDocument: "Открыть документ",
  pointPanelChunk: "Фрагмент №{ord}",
  pointPanelUntitled: "Документ",
```

В `src/i18n/messages/en/semanticMap.ts` тот же набор ключей:

```ts
  // map-point-panel.tsx — point detail card
  pointPanelClose: "Close",
  pointPanelOpenDocument: "Open document",
  pointPanelChunk: "Chunk #{ord}",
  pointPanelUntitled: "Document",
```

- [ ] **Step 2: Написать падающий тест**

```tsx
// src/features/semantic-map/ui/map-point-panel.test.tsx
// Кликаем через fireEvent из @testing-library/react — @testing-library/user-event
// в проекте НЕ установлен (см. history-tracking-toggle.test.tsx как образец).
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// useT возвращает ключ + простую подстановку {ord}.
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string, params?: Record<string, unknown>) =>
    params && "ord" in params ? `${key}:${String(params.ord)}` : key,
}));

import { MapPointPanel } from "./map-point-panel";

describe("MapPointPanel", () => {
  it("заголовок из documents[doc]", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-1", chunk_ord: 3, snippet: "текст" }}
        documents={{ "doc-1": "Бытие и время" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Бытие и время")).toBeInTheDocument();
    expect(screen.getByText("текст")).toBeInTheDocument();
  });

  it("фолбэк-заголовок, если документа нет в карте", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-x", snippet: "s" }}
        documents={{}}
        onClose={vi.fn()}
      />,
    );
    // фолбэк — сам id документа.
    expect(screen.getByText("doc-x")).toBeInTheDocument();
  });

  it("ссылка ведёт на /documents/[doc]", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-1", snippet: "s" }}
        documents={{ "doc-1": "T" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: "pointPanelOpenDocument" })).toHaveAttribute(
      "href",
      "/documents/doc-1",
    );
  });

  it("chunk_ord рендерится через ICU-параметр", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-1", chunk_ord: 7, snippet: "s" }}
        documents={{ "doc-1": "T" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("pointPanelChunk:7")).toBeInTheDocument();
  });

  it("кнопка закрытия зовёт onClose", () => {
    const onClose = vi.fn();
    render(
      <MapPointPanel detail={{ doc: "doc-1", snippet: "s" }} documents={{}} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "pointPanelClose" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/semantic-map/ui/map-point-panel.test.tsx`
Expected: FAIL — `Cannot find module "./map-point-panel"`.

- [ ] **Step 4: Реализовать компонент**

```tsx
"use client";
// src/features/semantic-map/ui/map-point-panel.tsx
import { IconButton, RouterLink } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { MapPointDetail } from "../types";

/**
 * Overlay-карточка деталей точки-чанка. Заголовок берём из MapData.documents
 * (ручка деталей заголовок не отдаёт), snippet рендерим как ТЕКСТ (React
 * экранирует — см. бэк-аск про markup; до подтверждения plaintext-only).
 */
export function MapPointPanel({
  detail,
  documents,
  onClose,
}: {
  detail: MapPointDetail;
  documents: Record<string, string>;
  onClose: () => void;
}) {
  const t = useT("semanticMap");
  const doc = detail.doc ?? "";
  const title = documents[doc] ?? doc ?? t("pointPanelUntitled");

  return (
    <div className="absolute bottom-3 left-3 max-w-sm rounded-md bg-(--color-surface) p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <IconButton aria-label={t("pointPanelClose")} compact onClick={onClose}>
          {"×"}
        </IconButton>
      </div>
      {typeof detail.chunk_ord === "number" && (
        <p className="mt-1 text-xs text-(--color-fg-muted)">
          {t("pointPanelChunk", { ord: detail.chunk_ord })}
        </p>
      )}
      {detail.snippet && (
        <p className="mt-2 line-clamp-4 text-sm text-(--color-fg)">{detail.snippet}</p>
      )}
      {doc && (
        <RouterLink href={`/documents/${doc}`} className="mt-2 inline-block text-sm underline">
          {t("pointPanelOpenDocument")}
        </RouterLink>
      )}
    </div>
  );
}
```

> `IconButton` (`icon-button.tsx`) принимает `aria-label` (required), `compact?: boolean`, `onClick` (через `ButtonHTMLAttributes`) — подтверждено. Символ закрытия — `×` (U+00D7), не текст «X». `className` у kit-leaf закрыт (Guardrail 8) — позиционирование карточки на обёртке `<div>`, не на `IconButton`.

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/semantic-map/ui/map-point-panel.test.tsx`
Expected: PASS (5 тестов).

Run: `pnpm exec vitest run src/i18n`
Expected: PASS (ICU-parity ru/en, если тест сверяет наборы ключей namespace `semanticMap`).

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/ui/map-point-panel.tsx src/features/semantic-map/ui/map-point-panel.test.tsx src/i18n/messages/ru/semanticMap.ts src/i18n/messages/en/semanticMap.ts
git commit -m "feat(semantic-map): панель деталей точки + строки i18n (ru/en)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire onPick во view → fetch → показать панель

**Files:**
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx`

**Interfaces:**
- Consumes: `getMapPointDetails` (`../actions`), `MapPointDetail` (`../types`), `MapPointPanel` (Task 5), порт `onPick` (Task 2).
- Produces: по клику view фетчит деталь одной точки и рендерит `<MapPointPanel>`; повторный pick→null или клик «закрыть» прячет панель; смена модели сбрасывает выбор.

- [ ] **Step 1: Добавить состояние выбора и подключить onPick**

В `src/features/semantic-map/ui/semantic-map-view.tsx`:

1. Импорты (рядом с прочими `../`):

```tsx
import { getMapPointDetails } from "../actions";
import type { MapPointDetail } from "../types";
import { MapPointPanel } from "./map-point-panel";
```

2. Состояние (рядом с `const [labels, setLabels] = useState…`):

```tsx
  const [selected, setSelected] = useState<MapPointDetail | null>(null);
  // documents (id→title) с контракта layout; фолбэк {} — поле optional.
  const documents = data.documents ?? {};
```

3. Внутри lifecycle-эффекта `[model]`, после `r.onChange(updateLabels);` и до/после `r.setModel(model)` — подписать picking. fetch вынесен в стабильный обработчик; гонку (быстрые клики) гасим request-id'ом:

```tsx
    let pickSeq = 0;
    r.onPick((id) => {
      const seq = ++pickSeq;
      if (!id) {
        setSelected(null);
        return;
      }
      void getMapPointDetails([id]).then((res) => {
        if (seq !== pickSeq) return; // устаревший ответ — игнор
        // id отсутствует в карте (приватный/неизвестный чанк) → деталь не показываем.
        setSelected(res.success ? res.data[id] ?? null : null);
      });
    });
```

> `onPick` зовётся внутри эффекта `[model]`, поэтому переживает пере-маунт рендерера при смене `data` (как `onChange`/`setOverlay`). `pickSeq` локален эффекту — на пере-маунте сбрасывается, что корректно.

4. Сбрасывать выбор при смене модели — добавить в начало эффекта `[model]` (или отдельным эффектом `[model]`):

```tsx
    setSelected(null);
```

5. Отрендерить панель в JSX (рядом с прочими overlay-карточками, перед закрывающим `</div>`):

```tsx
      {selected && (
        <MapPointPanel
          detail={selected}
          documents={documents}
          onClose={() => { setSelected(null); }}
        />
      )}
```

- [ ] **Step 2: Сборка + регрессия слайса**

Run: `pnpm exec vitest run src/features/semantic-map`
Expected: PASS (все тесты слайса).

Run: `pnpm build`
Expected: успешная сборка — типы протянуты (`data.documents` опционален → фолбэк `{}`; action-результат сужается по `res.success`).

- [ ] **Step 3: Ручная браузер-приёмка (WebGL, вне юнитов)**

Поднять стек (`make run-local` + `pnpm dev` на :3001 — см. local-dev-stack), открыть `/map`:
- клик по точке → панель с заголовком документа, snippet'ом, chunk_ord, ссылкой;
- ссылка ведёт на `/documents/<doc>`;
- клик «в пустоту» и крестик закрывают панель;
- pan/zoom-драг панель НЕ открывает;
- проверить и 2D, и 3D режим.

Отметить результат в PR-описании (юниты WebGL-проекцию на живой камере не покрывают — это сознательно ручной шаг, см. спеку «Стратегия тестирования»).

- [ ] **Step 4: Финальная верификация**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/ui/semantic-map-view.tsx
git commit -m "feat(semantic-map): клик по точке → fetch деталей → панель

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Слой 1 (picking): чистая математика `pickNearestPoint` → Task 1; реальный `onPick` в `ThreeMapRenderer` + drag-suppress → Task 2. ✔
- Слой 2 (данные+UI): `getMapPointDetails` (POST `/api/map/points`, error-map) → Task 3; экспорт из слайса → Task 4; панель (заголовок из `documents[doc]` + snippet + chunk_ord + `/documents/[doc]`) → Task 5; wire во view (fetch одной точки, гонка, сброс) → Task 6. ✔
- `Layout.documents` протянут через `MapData`→view→панель (Task 6 читает `data.documents`, передаёт в `MapPointPanel`). ✔
- Порт `MapRenderer` не протекает three.js во view: view знает только `onPick(cb)`; вся three-логика в `ThreeMapRenderer`. ✔
- Build-on overlay-фикс: используем `RenderModel.ids`/`positions`/`count`, не трогаем `matchOverlay`/`docs`. ✔
- i18n как foundation-зона: только `messages/{ru,en}/semanticMap.ts`, паритет ключей. ✔
- v1 = клик одной точки; hover/батч-префетч в Future (спека). ✔

**2. Placeholder scan:** все шаги содержат реальный код (тесты + реализация), точные пути и команды `pnpm exec vitest run …`. Единственная «проверь по факту» оговорка явная и обоснованная: `PointerEvent` vs `Event`+`Object.assign` в jsdom (Task 2 Step 4 — фолбэк прописан в хелперах `down`/`up`). Сигнатуры kit-примитивов (`IconButton.compact`, `RouterLink.href`) и `fireEvent` (не `user-event` — не установлен) сверены с кодом. Нет «TBD»/«similar to Task N». ✔

**3. Type consistency across tasks:** `pickNearestPoint(positions, count, viewProj, w, h, px, py, threshold): number` (Tasks 1↔2); `getMapPointDetails(ids: string[]): Promise<ActionResult<Record<string, MapPointDetail>>>` (Tasks 3↔4↔6); `MapPointDetail = semmap.PointDetail` (Tasks 3,5,6); `MapPointPanel({ detail, documents, onClose })` (Tasks 5↔6); `documents: Record<string,string>` ← `MapData.documents` (Tasks 4,6). Индекс `pickNearestPoint`→`model.ids[idx]` согласован с `RenderModel` (Task 2). ✔

**4. Бэк-зависимости:** типы `semmap.BatchPointsRequest`/`semmap.PointDetail`/`semmap.Layout.documents`/`semmap.Point.doc` уже в `src/api/schema.ts` (подтверждено: `schema.ts:11134`, `16410`, `16417`, `16436`, `16445`) — реген схемы НЕ требуется. Открытые бэк-аски (см. спеку): семантика `documents`, markup/длина `snippet`, гарантия публичной раскладки для `/api/map/points`.
