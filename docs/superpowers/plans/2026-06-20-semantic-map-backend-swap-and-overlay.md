# Карта смыслов — `/api/map` swap + overlay поиска: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить движок карты к реальному `/api/map` (чистый swap, без фолбэка) и добавить overlay поиска (`/map?q=` → подсветка хитов + фронтовый маркер-центроид).

**Architecture:** A — `getMap()` бьёт реальную ручку, возвращает дискриминированный `MapResult` (200/503-building/error); типы сужены из `@/api/schema` (`semmap.*`, all-optional → нормализатор толерантен); фикстуры/Zod удалены. B — страница `/map?q=` композит `getMap`+`getSearchResults` (page-level, фичи друг друга не импортят), слайс получает хиты пропом, подсвечивает точки по id и рисует score-взвешенный маркер.

**Tech Stack:** TypeScript, React 19, Next 16 (App Router), three.js, openapi-fetch (`@/api/client`), next-intl за `@/i18n`, Vitest.

**Spec:** [../specs/2026-06-20-semantic-map-backend-swap-and-overlay-design.md](../specs/2026-06-20-semantic-map-backend-swap-and-overlay-design.md)
**Движок (база):** [../specs/2026-06-20-semantic-map-frontend-engine-design.md](../specs/2026-06-20-semantic-map-frontend-engine-design.md)

## Global Constraints

- **pnpm only.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; точечный тест — `pnpm exec vitest run <file>`. CI гоняет `pnpm test:coverage` (пороги statements 41/branches 30/functions 40/lines 42).
- **Ветка `main`** (норма проекта; push заблокирован — НЕ пушить).
- **Git-дисциплина:** `git add` ТОЛЬКО свои файлы поимённо (НЕ `-A`/`.`); запрещены `stash`/`reset`/`checkout .`/`clean`; не трогать чужие изменения; передавать это под-субагентам.
- **Каждый commit** завершать trailer'ом: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Строгий TS/ESLint** (`noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `strictTypeChecked`): индекс-доступ через `?? fallback`/`forEach`; `??`/`&&`/`?.` только над реально-nullable. После каждой задачи — typecheck + `pnpm exec eslint src/features/semantic-map/` чисто.
- **i18n:** строки через `useT` (client, `@/i18n/client`) / `getT` (server, `@/i18n`); НЕ импортить `next-intl` напрямую; namespace `semanticMap` (client) — паритет ru/en (форсит `satisfies Messages`); заголовки — namespace `pages`.
- **Слайсы `semantic-map` и `search` НЕ импортируют друг друга** (ESLint-гард). Связь — URL `?q=` + проп + композиция на уровне `app/`.
- **three.js только внутри `renderer/`.** **Запретные зоны** (`eslint.config.mjs`, `package.json`, `tsconfig.json`, `@/components/ui/*`, `src/app/layout.tsx`) — НЕ трогать.
- **Именование** файлов в `src/` — kebab-case; тест-стиль `import { describe, it, expect } from "vitest";`, co-located.

---

### Task A1: Сузить типы из `@/api/schema` + нормализатор под all-optional

**Files:**
- Modify: `src/features/semantic-map/types.ts`
- Modify: `src/features/semantic-map/to-render-model.ts`
- Modify: `src/features/semantic-map/to-render-model.test.ts`

**Interfaces:**
- Produces: `MapData`/`MapBounds`/`MapCluster`/`MapPoint` = алиасы `semmap.*` (все поля optional). `toRenderModel(data: MapData): RenderModel` — толерантен к отсутствующим полям.

- [ ] **Step 1: Заменить `types.ts` (контрактные типы → из схемы)**

Заменить блок интерфейсов `MapBounds`/`MapCluster`/`MapPoint`/`MapData` (строки 1–33) на алиасы. `RenderCluster`/`RenderModel` (строки 35–57) НЕ трогать.

```ts
// Контракт /api/map — сужено из сгенерированной схемы бэкенда (semmap.*).
// Все поля optional (реальность ручки); устойчивость — в to-render-model.ts.
import type { components } from "@/api/schema";

export type MapBounds = components["schemas"]["semmap.Bounds"];
export type MapCluster = components["schemas"]["semmap.Cluster"];
export type MapPoint = components["schemas"]["semmap.Point"];
export type MapData = components["schemas"]["semmap.Layout"];
```

(оставить ниже без изменений: `export interface RenderCluster {…}` и `export interface RenderModel {…}`.)

- [ ] **Step 2: Обновить тест нормализатора под all-optional + добавить кейс «все поля отсутствуют»**

В `to-render-model.test.ts` функция `baseData` строит `MapData` с required-полями — это всё ещё валидно (предоставить все поля = удовлетворить optional). Удалить тест «без bounds — считает из точек», который делал `delete data.bounds` с `@ts-expect-error` (теперь `bounds` optional → `delete` не даёт ошибки типа → `@ts-expect-error` станет «unused»). Заменить на прямую передачу без bounds и добавить кейс пустого ответа.

Заменить тест `it("без bounds — считает из точек", …)` целиком на:

```ts
  it("без bounds — считает из точек", () => {
    const m = toRenderModel({
      layout_version: "v1",
      dims: 3,
      clusters: [{ id: 0, label: "A", size: 1 }],
      points: [
        { type: "document", id: "a", coords: [-2, 0, 0], cluster: 0 },
        { type: "document", id: "b", coords: [3, 1, -1], cluster: 0 },
      ],
    });
    expect(m.bounds.min[0]).toBe(-2);
    expect(m.bounds.max[0]).toBe(3);
  });

  it("пустой/частичный ответ (все поля отсутствуют) — не падает", () => {
    const m = toRenderModel({});
    expect(m.count).toBe(0);
    expect(m.clusters).toEqual([]);
    expect(m.bounds.min).toEqual([-1, -1, -1]);
    expect(m.bounds.max).toEqual([1, 1, 1]);
  });
```

- [ ] **Step 3: Запустить тест — убедиться, что падает (типы/поведение)**

Run: `pnpm exec vitest run src/features/semantic-map/to-render-model.test.ts`
Expected: FAIL (`toRenderModel({})` падает на `data.points.length` — `points` теперь `undefined`).

- [ ] **Step 4: Обновить `to-render-model.ts` под all-optional вход**

Заменить тело `toRenderModel` (строки 9–75) на версию с дефолтами (guard'ы теперь легитимны — поля реально optional). `computeBounds` (строки 77–105) — обновить условие на `b?.min`/`b?.max`.

```ts
export function toRenderModel(data: MapData): RenderModel {
  // Все поля контракта optional (semmap.*) — дефолтим; устойчивость к malformed/пустому.
  const dims = data.dims ?? 3;
  const pts = data.points ?? [];
  const cls = data.clusters ?? [];
  const count = pts.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ids: string[] = [];
  const typeCodes = new Uint8Array(count);

  const typeTable: string[] = [...KNOWN_TYPES, "other"];
  const genericIdx = typeTable.length - 1;
  const typeIndex = new Map<string, number>(KNOWN_TYPES.map((t, i) => [t, i]));

  const colorByCluster = new Map<number, string>();
  for (const c of cls) {
    const cid = c.id ?? 0;
    colorByCluster.set(cid, clusterColor(cid, c.color));
  }

  const agg = new Map<number, { x: number; y: number; z: number; n: number }>();

  pts.forEach((p, i) => {
    const co = p.coords ?? [];
    const x = co[0] ?? 0;
    const y = co[1] ?? 0;
    const z = dims >= 3 ? co[2] ?? 0 : 0;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const cl = p.cluster ?? 0;
    const hex = colorByCluster.get(cl) ?? clusterColor(cl);
    const [r, g, b] = hexToRgb01(hex);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    ids[i] = p.id ?? "";
    typeCodes[i] = typeIndex.get(p.type ?? "") ?? genericIdx;

    const a = agg.get(cl) ?? { x: 0, y: 0, z: 0, n: 0 };
    a.x += x;
    a.y += y;
    a.z += z;
    a.n += 1;
    agg.set(cl, a);
  });

  const clusters: RenderCluster[] = cls.map((c) => {
    const cid = c.id ?? 0;
    const a = agg.get(cid);
    const centroid: [number, number, number] =
      a?.n ? [a.x / a.n, a.y / a.n, a.z / a.n] : [0, 0, 0];
    return {
      id: cid,
      label: c.label ?? "",
      color: clusterColor(cid, c.color),
      size: c.size ?? a?.n ?? 0,
      centroid,
    };
  });

  return { count, positions, colors, ids, typeCodes, typeTable, bounds: computeBounds(data.bounds, positions, count), clusters };
}
```

И обновить `computeBounds` условие раннего branch (строка 86) — `b.min`/`b.max` теперь optional:

```ts
  if (b?.min && b.max && b.min.length >= 2 && b.max.length >= 2 && Number.isFinite(b.min[0])) {
```

(остальное тело `computeBounds` — без изменений.)

- [ ] **Step 5: Запустить тесты — зелёные**

Run: `pnpm exec vitest run src/features/semantic-map/to-render-model.test.ts`
Expected: PASS.

- [ ] **Step 6: Проверить типы/линт всего слайса (фикстуры/схемы ещё компилируются)**

Run: `pnpm typecheck && pnpm exec eslint src/features/semantic-map/`
Expected: чисто (fixtures/schemas всё ещё валидны — предоставляют все поля).

- [ ] **Step 7: Commit**

```bash
git add src/features/semantic-map/types.ts src/features/semantic-map/to-render-model.ts src/features/semantic-map/to-render-model.test.ts
git commit -m "refactor(semantic-map): narrow contract types from @/api/schema (semmap.*)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: `getMap` → реальный `/api/map` (MapResult) + страница + i18n

**Files:**
- Modify: `src/features/semantic-map/api.ts`
- Create: `src/features/semantic-map/ui/map-state-panel.tsx`
- Modify: `src/features/semantic-map/index.ts`
- Modify: `src/app/map/page.tsx`
- Modify: `src/i18n/messages/ru/semanticMap.ts`
- Modify: `src/i18n/messages/en/semanticMap.ts`

**Interfaces:**
- Consumes: `MapData` (Task A1); `createApiClient` из `@/api/client`; `getT` из `@/i18n`.
- Produces: `getMap(): Promise<MapResult>` где `MapResult = { ok: true; map: MapData } | { ok: false; reason: "building" | "error" }`; `MapStatePanel({ reason })` (server).

- [ ] **Step 1: Заменить `api.ts` (фикстура → реальная ручка + MapResult)**

```ts
// src/features/semantic-map/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { MapData } from "./types";

/** Результат загрузки карты: готова / ещё строится (503 MAP_NOT_READY) / ошибка. */
export type MapResult =
  | { ok: true; map: MapData }
  | { ok: false; reason: "building" | "error" };

/**
 * Карта смыслов. Read-only, optional-auth (createApiClient приложит JWT из cookie —
 * бэк скоупит срез по видимости). ETag/304 в v1 не используем (свежий запрос).
 */
export const getMap = cache(async (): Promise<MapResult> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/map");
  if (error) {
    if (response.status === 503) return { ok: false, reason: "building" };
    return { ok: false, reason: "error" };
  }
  const layout = data.data;
  if (!layout) return { ok: false, reason: "error" };
  return { ok: true, map: layout };
});
```

- [ ] **Step 2: Создать `ui/map-state-panel.tsx` (server-компонент)**

```tsx
// src/features/semantic-map/ui/map-state-panel.tsx
// Server-компонент: состояние карты «строится»/«ошибка» (когда getMap вернул !ok).
import { getT } from "@/i18n";

export async function MapStatePanel({ reason }: { reason: "building" | "error" }) {
  const t = await getT("semanticMap");
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-(--color-fg-muted)">
      {t(reason === "building" ? "building" : "loadError")}
    </div>
  );
}
```

- [ ] **Step 3: Экспортировать `MapStatePanel` + тип `MapResult` из `index.ts`**

```ts
// src/features/semantic-map/index.ts
// Public API слайса: серверный fetcher + lazy client-обёртка карты.
export { getMap, type MapResult } from "./api";
export { SemanticMap } from "./ui/semantic-map";
export { MapStatePanel } from "./ui/map-state-panel";
```

- [ ] **Step 4: Обновить страницу `/map` (ветвление MapResult, убрать `?n=`)**

```tsx
// src/app/map/page.tsx
import { getMap, MapStatePanel, SemanticMap } from "@/features/semantic-map";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("mapTitle") };
}

export default async function MapPage() {
  const result = await getMap();

  return (
    <main className="h-[80vh] w-full">
      {result.ok ? <SemanticMap data={result.map} /> : <MapStatePanel reason={result.reason} />}
    </main>
  );
}
```

- [ ] **Step 5: Добавить строки в `semanticMap.ts` (ru + en, паритет)**

В `src/i18n/messages/ru/semanticMap.ts` — добавить два ключа в объект `semanticMap`:

```ts
  // map-state-panel.tsx — состояния загрузки карты
  building: "Карта ещё строится. Загляните чуть позже.",
  loadError: "Не удалось загрузить карту.",
```

В `src/i18n/messages/en/semanticMap.ts` — зеркально:

```ts
  building: "The map is still being built. Check back shortly.",
  loadError: "Failed to load the map.",
```

- [ ] **Step 6: Проверить типы/линт/сборку + i18n-тесты**

Run: `pnpm typecheck && pnpm exec eslint src/features/semantic-map/ src/app/map/ && pnpm exec vitest run src/i18n`
Expected: чисто; i18n-тесты (паритет/server-only) зелёные.
(`fixtures.ts`/`schemas.ts` теперь не импортируются из `api.ts` — станут мёртвыми, удалим в A3.)

- [ ] **Step 7: Commit**

```bash
git add src/features/semantic-map/api.ts src/features/semantic-map/ui/map-state-panel.tsx src/features/semantic-map/index.ts src/app/map/page.tsx src/i18n/messages/ru/semanticMap.ts src/i18n/messages/en/semanticMap.ts
git commit -m "feat(semantic-map): swap getMap to real /api/map (MapResult + building state)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: Удалить мёртвый код (fixtures + schemas + `?n=`)

**Files:**
- Delete: `src/features/semantic-map/fixtures.ts`, `src/features/semantic-map/fixtures.test.ts`
- Delete: `src/features/semantic-map/schemas.ts`, `src/features/semantic-map/schemas.test.ts`

**Interfaces:** —

- [ ] **Step 1: Убедиться, что ничего не импортирует fixtures/schemas**

Run: `grep -rnE "from \"\\./fixtures\"|from \"\\./schemas\"|makeFixtureMap|parseMapResponse" src/`
Expected: только сами файлы fixtures/schemas (+ их тесты). Нет внешних потребителей (`api.ts` уже не импортит — Task A2).

- [ ] **Step 2: Удалить файлы**

```bash
git rm src/features/semantic-map/fixtures.ts src/features/semantic-map/fixtures.test.ts src/features/semantic-map/schemas.ts src/features/semantic-map/schemas.test.ts
```

- [ ] **Step 3: Проверить гейты**

Run: `pnpm typecheck && pnpm exec eslint src/features/semantic-map/ && pnpm exec vitest run src/features/semantic-map`
Expected: чисто; оставшиеся тесты слайса (palette/to-render-model/camera-fit/project) зелёные.

- [ ] **Step 4: Commit**

```bash
git add -u src/features/semantic-map/
git commit -m "chore(semantic-map): drop fixtures + dormant schemas after real /api/map swap" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Примечание: `git add -u src/features/semantic-map/` стейджит ТОЛЬКО удаления внутри слайса (твои файлы), не трогая чужое. Допустимое исключение из «add по имени» — удаления уже зафиксированы `git rm` в Step 2.

---

### Task B1: Чистая функция `weightedCentroid`

**Files:**
- Create: `src/features/semantic-map/overlay/weighted-centroid.ts`
- Test: `src/features/semantic-map/overlay/weighted-centroid.test.ts`

**Interfaces:**
- Produces: `weightedCentroid(items: { pos: [number, number, number]; weight: number }[]): [number, number, number] | null`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/semantic-map/overlay/weighted-centroid.test.ts
import { describe, it, expect } from "vitest";

import { weightedCentroid } from "./weighted-centroid";

describe("weightedCentroid", () => {
  it("пустой вход → null", () => {
    expect(weightedCentroid([])).toBeNull();
  });

  it("одна точка → она сама", () => {
    expect(weightedCentroid([{ pos: [1, 2, 3], weight: 0.5 }])).toEqual([1, 2, 3]);
  });

  it("взвешивает по весу", () => {
    const c = weightedCentroid([
      { pos: [0, 0, 0], weight: 1 },
      { pos: [10, 0, 0], weight: 3 },
    ]);
    expect(c).not.toBeNull();
    expect(c?.[0]).toBeCloseTo(7.5, 6); // (0*1 + 10*3) / 4
  });

  it("нулевые/отрицательные веса → равновес (среднее)", () => {
    const c = weightedCentroid([
      { pos: [0, 0, 0], weight: 0 },
      { pos: [4, 0, 0], weight: 0 },
    ]);
    expect(c?.[0]).toBeCloseTo(2, 6);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm exec vitest run src/features/semantic-map/overlay/weighted-centroid.test.ts`
Expected: FAIL (`Cannot find module './weighted-centroid'`).

- [ ] **Step 3: Реализовать `weighted-centroid.ts`**

```ts
// src/features/semantic-map/overlay/weighted-centroid.ts
// Чистая функция: score-взвешенный центроид позиций (маркер «центр результатов»).
type Vec3 = [number, number, number];

export function weightedCentroid(items: { pos: Vec3; weight: number }[]): Vec3 | null {
  if (items.length === 0) return null;
  let wx = 0;
  let wy = 0;
  let wz = 0;
  let total = 0;
  for (const { pos, weight } of items) {
    const w = weight > 0 ? weight : 0;
    wx += pos[0] * w;
    wy += pos[1] * w;
    wz += pos[2] * w;
    total += w;
  }
  // Все веса ≤0 → равновесное среднее (не делим на 0).
  if (total === 0) {
    const n = items.length;
    for (const { pos } of items) {
      wx += pos[0];
      wy += pos[1];
      wz += pos[2];
    }
    return [wx / n, wy / n, wz / n];
  }
  return [wx / total, wy / total, wz / total];
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm exec vitest run src/features/semantic-map/overlay/weighted-centroid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/overlay/weighted-centroid.ts src/features/semantic-map/overlay/weighted-centroid.test.ts
git commit -m "feat(semantic-map): weighted-centroid helper for query marker" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Рендерер — `setOverlay` (подсветка + маркер)

> Юнит-тестов нет (WebGL/jsdom). Гейт — `pnpm typecheck` + `pnpm exec eslint` + сборка; визуал — ручной smoke.

**Files:**
- Modify: `src/features/semantic-map/renderer/map-renderer.ts`
- Modify: `src/features/semantic-map/renderer/three-map-renderer.ts`

**Interfaces:**
- Consumes: `RenderModel.ids` (для матчинга id→буфер-индекс).
- Produces: `MapRenderer.setOverlay(overlay: MapOverlayState | null): void` где `MapOverlayState = { highlightIds: Set<string>; marker: [number, number, number] | null }`.

- [ ] **Step 1: Добавить тип + метод в порт `map-renderer.ts`**

Добавить экспорт типа и метод в интерфейс (перед `destroy()`):

```ts
/** Состояние overlay поиска: какие точки подсветить (по id) + позиция маркера-центроида. */
export interface MapOverlayState {
  highlightIds: Set<string>;
  marker: [number, number, number] | null;
}
```

И в `interface MapRenderer`, перед `onPick`:

```ts
  /** Overlay поиска: подсветить точки (по id) + маркер. null — снять overlay. */
  setOverlay(overlay: MapOverlayState | null): void;
```

- [ ] **Step 2: Реализовать overlay в `three-map-renderer.ts`**

(2.1) Импорт типа — обновить строку 8:

```ts
import type { MapOverlayState, MapRenderer, RenderMode } from "./map-renderer";
```

(2.2) Поля класса — добавить после `private changeCb` (строка 27):

```ts
  private baseColors: Float32Array | null = null;
  private colorAttr: THREE.BufferAttribute | null = null;
  private marker: THREE.Sprite | null = null;
```

(2.3) В `setModel` — сохранить базовые цвета и ссылку на атрибут. Заменить строки 51–53 (создание geom + position/color) на:

```ts
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(model.positions, 3));
    const colorAttr = new THREE.BufferAttribute(model.colors, 3);
    geom.setAttribute("color", colorAttr);
    this.colorAttr = colorAttr;
    this.baseColors = model.colors.slice(); // копия для восстановления при снятии overlay
```

(2.4) Реализовать `setOverlay` — добавить метод после `onPick` (после строки 176):

```ts
  setOverlay(overlay: MapOverlayState | null): void {
    if (!this.model || !this.colorAttr || !this.baseColors) return;
    const ids = this.model.ids;
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
    this.dirty = true;
  }

  private updateMarker(pos: [number, number, number] | null): void {
    if (!pos) {
      if (this.marker) this.marker.visible = false;
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
  }
```

(2.5) Диспоуз маркера — в `destroy()` добавить перед `this.renderer?.dispose()` (строка 193):

```ts
    if (this.marker) {
      this.marker.material.map?.dispose();
      this.marker.material.dispose();
    }
```

(2.6) Хелпер ring-текстуры — добавить в конец файла после `disposePoints`:

```ts
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

- [ ] **Step 3: Проверить типы/линт**

Run: `pnpm typecheck && pnpm exec eslint src/features/semantic-map/`
Expected: чисто.

- [ ] **Step 4: Commit**

```bash
git add src/features/semantic-map/renderer/map-renderer.ts src/features/semantic-map/renderer/three-map-renderer.ts
git commit -m "feat(semantic-map): renderer setOverlay — dim non-hits + centroid marker" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: View — проп `overlay`, матчинг, `setOverlay`; обёртка; экспорт типа

**Files:**
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx`
- Modify: `src/features/semantic-map/ui/semantic-map.tsx`
- Modify: `src/features/semantic-map/index.ts`
- Modify: `src/i18n/messages/ru/semanticMap.ts`, `src/i18n/messages/en/semanticMap.ts`

**Interfaces:**
- Consumes: `MapRenderer.setOverlay` + `MapOverlayState` (B2); `weightedCentroid` (B1).
- Produces: `MapOverlay = { query: string; hits: { id: string; type: string; score: number }[] }`; `SemanticMap({ data, overlay? })`.

- [ ] **Step 1: Объявить тип `MapOverlay` (в `types.ts`)**

Добавить в `src/features/semantic-map/types.ts` (после `RenderModel`):

```ts
/** Overlay поиска: запрос + хиты (из llmretrieval.Hit, спроецированные на форму карты). */
export interface MapOverlay {
  query: string;
  hits: { id: string; type: string; score: number }[];
}
```

- [ ] **Step 2: Обновить `semantic-map-view.tsx` — проп `overlay`, матч, setOverlay-эффект, заметка**

(2.1) Импорты — обновить строки 7–10:

```ts
import { ThreeMapRenderer, projectToScreen } from "../renderer";
import type { MapRenderer, RenderMode } from "../renderer";
import { weightedCentroid } from "../overlay/weighted-centroid";
import { toRenderModel } from "../to-render-model";
import type { MapData, MapOverlay } from "../types";
```

(2.2) Сигнатура + матч overlay — заменить строку 24 и добавить вычисление после `model` (строка 35):

```ts
export default function SemanticMapView({ data, overlay }: { data: MapData; overlay?: MapOverlay }) {
```

После `const model = useMemo(() => toRenderModel(data), [data]);` (строка 35) добавить вычисление `matched` + ref (ref объявлен ПОСЛЕ matched с явным типом — `typeof matched` до объявления нельзя):

```ts
  // Матч хитов с точками карты по id; маркер = score-взвешенный центроид совпавших.
  type Matched = { highlightIds: Set<string>; marker: [number, number, number] | null; count: number };
  const matched = useMemo<Matched | null>(() => {
    if (!overlay) return null;
    const score = new Map(overlay.hits.map((h) => [h.id, h.score]));
    const highlightIds = new Set<string>();
    const items: { pos: [number, number, number]; weight: number }[] = [];
    for (let i = 0; i < model.ids.length; i++) {
      const id = model.ids[i] ?? "";
      const w = score.get(id);
      if (w === undefined) continue;
      highlightIds.add(id);
      items.push({ pos: [model.positions[i * 3] ?? 0, model.positions[i * 3 + 1] ?? 0, model.positions[i * 3 + 2] ?? 0], weight: w });
    }
    return { highlightIds, marker: weightedCentroid(items), count: items.length };
  }, [overlay, model]);
  // Актуальный matched в ref — чтобы lifecycle-эффект ([model]) применял overlay к
  // пере-созданному рендереру, не добавляя matched в свои deps.
  const matchedRef = useRef<Matched | null>(null);
  matchedRef.current = matched;
```

(2.3) Применять overlay — добавить эффект после mode-эффекта (после строки 85):

```ts
  // Применять overlay при смене matched (и переживает пере-маунт через тот же эффект [model] ниже).
  useEffect(() => {
    rendererRef.current?.setOverlay(
      matched ? { highlightIds: matched.highlightIds, marker: matched.marker } : null,
    );
  }, [matched]);
```

(2.4) В lifecycle-эффекте — применить overlay после setMode (после строки 65 `r.setMode(modeRef.current);`):

```ts
    if (matched) r.setOverlay({ highlightIds: matched.highlightIds, marker: matched.marker });
```

> Чтобы `matched` в lifecycle-эффекте не добавлял его в deps (эффект ключём `[model]`), читать актуальный через ref. Добавить рядом с `modeRef` (после строки 33):
> ```ts
>   const matchedRef = useRef<typeof matched>(null);
> ```
> и в (2.2) после вычисления `matched` синхронизировать: заменить `return { highlightIds, marker: ... }` так, чтобы значение шло в ref — проще: после `const matched = useMemo(...)` добавить `matchedRef.current = matched;`. Тогда в lifecycle-эффекте использовать `matchedRef.current`:
> ```ts
>     const m0 = matchedRef.current;
>     if (m0) r.setOverlay({ highlightIds: m0.highlightIds, marker: m0.marker });
> ```

(2.5) Заметка «ничего не найдено на карте» — добавить в JSX после блока `model.count === 0` (после строки 98):

```tsx
      {overlay && matched?.count === 0 && model.count > 0 && (
        <div className="absolute inset-x-0 top-3 mx-auto w-fit rounded bg-(--color-surface) px-3 py-1 text-xs text-(--color-fg-muted) shadow">
          {t("overlayNoMatches")}
        </div>
      )}
```

- [ ] **Step 3: Обновить `semantic-map.tsx` — пробросить `overlay`**

```tsx
"use client";
// src/features/semantic-map/ui/semantic-map.tsx
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui";

import type { MapData, MapOverlay } from "../types";

const View = dynamic(() => import("./semantic-map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function SemanticMap({ data, overlay }: { data: MapData; overlay?: MapOverlay }) {
  return <View data={data} overlay={overlay} />;
}
```

- [ ] **Step 4: Экспортировать `MapOverlay` из `index.ts`**

Заменить первую строку экспортов:

```ts
export { getMap, type MapResult } from "./api";
export { SemanticMap } from "./ui/semantic-map";
export { MapStatePanel } from "./ui/map-state-panel";
export type { MapOverlay } from "./types";
```

- [ ] **Step 5: Добавить строку `overlayNoMatches` (ru + en)**

`ru/semanticMap.ts`: `overlayNoMatches: "По запросу ничего не найдено на карте.",`
`en/semanticMap.ts`: `overlayNoMatches: "No results for this query on the map.",`

- [ ] **Step 6: Проверить типы/линт/сборку + i18n**

Run: `pnpm typecheck && pnpm exec eslint src/features/semantic-map/ && pnpm exec vitest run src/i18n && pnpm build`
Expected: чисто; `/map` собирается.

- [ ] **Step 7: Commit**

```bash
git add src/features/semantic-map/types.ts src/features/semantic-map/ui/semantic-map-view.tsx src/features/semantic-map/ui/semantic-map.tsx src/features/semantic-map/index.ts src/i18n/messages/ru/semanticMap.ts src/i18n/messages/en/semanticMap.ts
git commit -m "feat(semantic-map): view overlay prop — match hits, highlight + marker" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B4: Страница `/map?q=` — композиция getMap + getSearchResults

**Files:**
- Modify: `src/app/map/page.tsx`

**Interfaces:**
- Consumes: `getMap`/`MapStatePanel`/`SemanticMap`/`MapOverlay` из `@/features/semantic-map`; `getSearchResults` из `@/features/search`.

- [ ] **Step 1: Обновить страницу — читать `?q=`, тянуть обе фичи, собрать overlay**

```tsx
// src/app/map/page.tsx
import { getMap, MapStatePanel, SemanticMap, type MapOverlay } from "@/features/semantic-map";
import { getSearchResults } from "@/features/search";
import { getT } from "@/i18n";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("mapTitle") };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();

  const result = await getMap();
  if (!result.ok) {
    return (
      <main className="h-[80vh] w-full">
        <MapStatePanel reason={result.reason} />
      </main>
    );
  }

  let overlay: MapOverlay | undefined;
  if (q) {
    try {
      const search = await getSearchResults({ q });
      overlay = {
        query: q,
        hits: search.items.flatMap((h) =>
          h.entity_id && h.type ? [{ id: h.entity_id, type: h.type, score: h.score ?? 0 }] : [],
        ),
      };
    } catch {
      overlay = { query: q, hits: [] }; // поиск недоступен — карта без overlay
    }
  }

  return (
    <main className="h-[80vh] w-full">
      <SemanticMap data={result.map} overlay={overlay} />
    </main>
  );
}
```

- [ ] **Step 2: Проверить типы/линт/сборку**

Run: `pnpm typecheck && pnpm exec eslint src/app/map/ && pnpm build`
Expected: чисто; `/map` собирается (server-композиция getMap+getSearchResults).

- [ ] **Step 3: Commit**

```bash
git add src/app/map/page.tsx
git commit -m "feat(semantic-map): /map?q= composes getMap + getSearchResults for overlay" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B5: Ссылка «Посмотреть на карте» из результатов поиска

**Files:**
- Modify: `src/app/search/page.tsx`
- Modify: `src/i18n/messages/ru/pages.ts`, `src/i18n/messages/en/pages.ts`

**Interfaces:**
- Consumes: `RouterLink` из `@/components/ui`.

- [ ] **Step 1: Добавить строку `mapLink` в `pages.ts` (ru + en)**

`ru/pages.ts` — рядом с `mapTitle` (в секции `// ─── /map ───`): `mapLink: "Посмотреть на карте",`
`en/pages.ts` — зеркально: `mapLink: "View on map",`

- [ ] **Step 2: Добавить ссылку в `SearchBody` (страница `/search`)**

В `src/app/search/page.tsx` обновить `SearchBody` (строки 58–72): импортировать `RouterLink`, добавить ссылку под результатами при наличии хитов.

Обновить импорт `@/components/ui` (добавить, если его нет — сейчас страница его не импортит): в начало файла добавить
```ts
import { RouterLink } from "@/components/ui";
```
и заменить тело `SearchBody`:

```tsx
async function SearchBody({ q }: { q: string }) {
  const t = await getT("pages");
  let result;
  try {
    result = await getSearchResults({ q, limit: PAGE_LIMIT });
  } catch {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {t("searchUnavailable")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchResults hits={result.items} />
      {result.items.length > 0 && (
        <RouterLink href={`/map?q=${encodeURIComponent(q)}`} className="text-sm text-(--color-accent) hover:underline">
          {t("mapLink")}
        </RouterLink>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить типы/линт/сборку + i18n**

Run: `pnpm typecheck && pnpm exec eslint src/app/search/ && pnpm exec vitest run src/i18n && pnpm build`
Expected: чисто.

- [ ] **Step 4: Commit**

```bash
git add src/app/search/page.tsx src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts
git commit -m "feat(search): link search results to /map?q= overlay" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B6: Финальная верификация + ручной smoke

**Files:** —

- [ ] **Step 1: Полные гейты**

Run: `pnpm lint && pnpm test && pnpm build && pnpm test:coverage`
Expected: всё зелёное; пороги coverage не упали (чистые слои overlay/нормализатора покрыты).

- [ ] **Step 2: Ручной smoke (нужен локальный бэк на :8090 с собранной картой)**

```bash
pnpm dev
```
- `http://localhost:3001/map` — карта из реального `/api/map` (или «Карта ещё строится», если бэк не собрал).
- `http://localhost:3001/search?q=Кант` → ссылка «Посмотреть на карте» → `/map?q=Кант`: точки-хиты яркие, остальные приглушены, кольцо-маркер в «центре результатов».
- Запрос без совпадений на карте → заметка «По запросу ничего не найдено на карте».

- [ ] **Step 3: Обновить статус спеки (по желанию) и закоммитить**

Отметить в spec-файле, что A+B реализованы; `git add` спеку поимённо + commit с trailer.

---

## Self-Review

**1. Spec coverage:**
- A: getMap MapResult (200/503/error) → A2. Типы из `@/api/schema` → A1. Нормализатор all-optional → A1. Страница состояний → A2. Удаление fixtures/schemas/`?n=` → A2 (`?n=`) + A3. RBAC optional-auth → A2 (`createApiClient`). ✓
- B: weightedCentroid → B1. Рендерер подсветка+маркер → B2. View проп/матч/setOverlay/заметка → B3. Страница `?q=` композиция → B4. Ссылка поиска → B5. Архитектура (ноль cross-feature импортов, URL `?q=`) → B4/B5. ✓
- i18n (building/loadError/overlayNoMatches/mapLink, паритет ru/en) → A2/B3/B5. ✓
- Тестирование (нормализатор all-optional, weightedCentroid; рендер — typecheck/build) → A1/B1, B2/B3 typecheck. ✓

**2. Placeholder scan:** Кода-плейсхолдеров нет; полный код в каждом шаге. Open-questions спеки разрешены: подсветка = перекраска буфера (B2); глиф = canvas-ring sprite (B2); ссылка поиска = namespace `pages` (B5).

**3. Type consistency:** `MapResult` (A2) ↔ страница (A2/B4). `MapData`=`semmap.Layout` (A1) сквозь нормализатор/getMap/view. `MapOverlayState` (B2 порт) ↔ `setOverlay` impl (B2) ↔ вызов в view (B3). `MapOverlay` (B3 types) ↔ `SemanticMap` проп (B3) ↔ страница (B4). `weightedCentroid` сигнатура (B1) ↔ вызов в view (B3). `getSearchResults`→`SearchResult.items`→`SearchHit{entity_id,type,score}` (B4) — сверено с `@/features/search`.
