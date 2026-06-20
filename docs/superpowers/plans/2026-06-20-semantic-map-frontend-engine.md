# Карта смыслов — движок отрисовки на фронте: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бэкенд-агностичный WebGL-движок, рисующий потенциально большое облако точек «карты смыслов» (документы + термины глоссария) с раскраской по кластерам, подписями районов и переключателем 2D/3D.

**Architecture:** Три развязанных слоя — данные (`MapData`-граница: фикстуры сейчас → `/api/map` позже), нормализация (`MapData → RenderModel`, чистая) и рендер (порт `MapRenderer` + реализация на three.js, client-only за `dynamic({ssr:false})`). three.js полностью спрятан за портом.

**Tech Stack:** TypeScript, React 19, Next 16 (App Router), three.js, Vitest (jsdom), Tailwind v4 + APCA-токены, Base UI (`@/components/ui`).

**Spec:** [docs/superpowers/specs/2026-06-20-semantic-map-frontend-engine-design.md](../specs/2026-06-20-semantic-map-frontend-engine-design.md)
**Контракт данных:** `philosophy-api/docs/superpowers/specs/2026-06-20-semantic-map-frontend-contract.md`

## Global Constraints

- **pnpm only.** Никаких `npm install`/`npx` — ломает тулчейн. Команды: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, точечный тест — `pnpm exec vitest run <file>`.
- **Git-дисциплина (AGENTS.md):** запрещены `git stash`/`reset`/`checkout .`/`clean` и `git add -A`/`git add .`. Добавлять только свои файлы поимённо. Не трогать чужие изменения.
- **Запретные зоны = отдельные шаги/PR:** `package.json`/`package-lock.json` (зависимость three — Task 1, координируемый foundation-PR); `src/app/layout.tsx`/admin-shell/`src/components/ui/*`/`src/utils/*` — НЕ трогать.
- **i18n под активной параллельной работой — НЕ редактировать i18n-каталоги/фасад `@/i18n`.** Строки chrome (тумблер/состояния) — инлайн RU-литералами с пометкой `// i18n:` для последующей вынесения; `useT(...)` в v1 не вызывать.
- **Именование** файлов/папок в `src/` — kebab-case.
- **Слайс не импортит другие `@/features/*`** (форсит ESLint). Read-only: actions/permissions/revalidate не нужны.
- **three.js только внутри `renderer/`** — ни один three-тип не торчит наружу.
- **Каждый `git commit` завершать trailer'ом** (требование проекта, в commit-шагах ниже показан на Task 1 как канонический образец; добавлять в КАЖДЫЙ коммит):
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **ESLint = `strictTypeChecked`** (`no-unnecessary-condition` активен): НЕ ставить `??`/`&&`/`?.` над НЕ-nullable типизированными полями — это lint-ошибка. Защищаться только там, где тип реально допускает `undefined` (опциональные поля контракта, доступ по индексу массива при `noUncheckedIndexedAccess`).
- **CI гоняет `pnpm test:coverage`** (пороги enforced: statements 41 / branches 30 / functions 40 / lines 42). Перед завершением зелёные: `pnpm lint && pnpm test && pnpm build`; финально проверить и `pnpm test:coverage` (Task 10).

---

### Task 1: Зависимость three.js (foundation-PR)

> ⚠️ Затрагивает `package.json`/lockfile — запретная зона. Это **отдельный координируемый foundation-PR**; остальные таски пишутся против него. Включено в план как явный prerequisite (пользователь выбрал three.js).

**Files:**
- Modify: `package.json` (dependencies += `three`, devDependencies += `@types/three`)
- Modify: `pnpm-lock.yaml` (через pnpm; репозиторий на pnpm, `package-lock.json` отсутствует)

**Interfaces:**
- Produces: рантайм-модуль `three` и его типы, `three/addons/controls/OrbitControls.js` (документированный exports-map алиас; именно он используется в Task 7).

- [ ] **Step 1: Добавить зависимости через pnpm**

```bash
pnpm add three
pnpm add -D @types/three
```

- [ ] **Step 2: Проверить, что импорт резолвится (тип-уровень)**

Создать временный `/tmp/three-smoke.ts` и прогнать typecheck НЕ обязательно; достаточно убедиться, что пакет встал:

Run: `pnpm exec node -e "require.resolve('three'); console.log('three ok')"`
Expected: `three ok`

- [ ] **Step 3: Commit** (канонический образец trailer'а — повторять в КАЖДОМ коммите ниже)

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(deps): add three.js for semantic-map render engine" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Типы контракта + палитра-фолбэк

**Files:**
- Create: `src/features/semantic-map/types.ts`
- Create: `src/features/semantic-map/palette.ts`
- Test: `src/features/semantic-map/palette.test.ts`

**Interfaces:**
- Produces:
  - `MapData`, `MapCluster`, `MapPoint`, `MapBounds` (форма контракта).
  - `RenderModel`, `RenderCluster` (внутренняя форма для рендерера).
  - `clusterColor(id: number, explicit?: string | null): string` — hex (`#rrggbb`).
  - `hexToRgb01(hex: string): [number, number, number]` — компоненты 0..1.

- [ ] **Step 1: Написать падающий тест палитры**

```ts
// src/features/semantic-map/palette.test.ts
import { describe, it, expect } from "vitest";

import { clusterColor, hexToRgb01 } from "./palette";

describe("clusterColor", () => {
  it("отдаёт явный валидный hex как есть", () => {
    expect(clusterColor(0, "#AABBCC")).toBe("#AABBCC");
  });
  it("игнорит невалидный explicit и берёт палитру по id", () => {
    expect(clusterColor(0, "red")).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(clusterColor(0, null)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it("детерминирован по id и зацикливает палитру", () => {
    expect(clusterColor(3)).toBe(clusterColor(3));
    expect(clusterColor(0)).toBe(clusterColor(10)); // палитра из 10 цветов
  });
  it("корректен для отрицательного id", () => {
    expect(clusterColor(-1)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("hexToRgb01", () => {
  it("маппит крайние значения", () => {
    expect(hexToRgb01("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToRgb01("#000000")).toEqual([0, 0, 0]);
  });
  it("маппит компоненты", () => {
    expect(hexToRgb01("#ff8000")).toEqual([1, 128 / 255, 0]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/semantic-map/palette.test.ts`
Expected: FAIL (`Cannot find module './palette'`).

- [ ] **Step 3: Реализовать `types.ts`**

```ts
// src/features/semantic-map/types.ts
// Форма контракта /api/map (philosophy-api .../2026-06-20-semantic-map-frontend-contract.md).
// Когда /api/map появится в @/api/schema — сузить отсюда; пока вручную.

export interface MapBounds {
  min: number[];
  max: number[];
}

export interface MapCluster {
  id: number;
  label?: string;
  color?: string;
  size?: number;
}

export interface MapPoint {
  /** "document" | "glossary" | ...; неизвестный тип рисуем как обычную точку. */
  type: string;
  /** Непрозрачный id точки. */
  id: string;
  /** Длина = dims; 2D берёт [0],[1], 3D добавляет [2]. */
  coords: number[];
  cluster: number;
}

export interface MapData {
  layout_version: number;
  dims: number;
  bounds: MapBounds;
  clusters: MapCluster[];
  points: MapPoint[];
}

// --- Внутренняя форма для рендерера (типизированные массивы, один draw-call) ---

export interface RenderCluster {
  id: number;
  label: string;
  color: string;
  size: number;
  centroid: [number, number, number];
}

export interface RenderModel {
  count: number;
  /** count*3, всегда 3 координаты (z=0 при dims<3). */
  positions: Float32Array;
  /** count*3, RGB 0..1. */
  colors: Float32Array;
  ids: string[];
  /** Индекс в typeTable. */
  typeCodes: Uint8Array;
  typeTable: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  clusters: RenderCluster[];
}
```

- [ ] **Step 4: Реализовать `palette.ts`**

```ts
// src/features/semantic-map/palette.ts
// Детерминированная палитра-фолбэк, когда cluster.color не пришёл.

const FALLBACK_PALETTE = [
  "#5B8FF9", "#61DDAA", "#65789B", "#F6BD16", "#7262FD",
  "#78D3F8", "#9661BC", "#F6903D", "#008685", "#F08BB4",
] as const;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** cluster.color приоритетен (если валиден), иначе цвет по id. */
export function clusterColor(id: number, explicit?: string | null): string {
  if (explicit && HEX6.test(explicit)) return explicit;
  const n = FALLBACK_PALETTE.length;
  const i = ((id % n) + n) % n;
  // `?? [0]` — индекс кортежа вычисляемым i под noUncheckedIndexedAccess даёт `| undefined`.
  return FALLBACK_PALETTE[i] ?? FALLBACK_PALETTE[0];
}

/** "#rrggbb" → [r, g, b] в диапазоне 0..1. */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
```

- [ ] **Step 5: Запустить тест — зелёный**

Run: `pnpm exec vitest run src/features/semantic-map/palette.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/types.ts src/features/semantic-map/palette.ts src/features/semantic-map/palette.test.ts
git commit -m "feat(semantic-map): contract types + fallback palette"
```

---

### Task 3: Генератор фикстур (seeded)

**Files:**
- Create: `src/features/semantic-map/fixtures.ts`
- Test: `src/features/semantic-map/fixtures.test.ts`

**Interfaces:**
- Consumes: `MapData`, `MapCluster`, `MapPoint` из `./types`.
- Produces: `makeFixtureMap(opts?: { count?: number; clusters?: number; seed?: number }): MapData` — детерминирован по `seed`; точки сгруппированы вокруг центроидов; `bounds` посчитаны из точек.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/semantic-map/fixtures.test.ts
import { describe, it, expect } from "vitest";

import { makeFixtureMap } from "./fixtures";

describe("makeFixtureMap", () => {
  it("детерминирован по seed", () => {
    const a = makeFixtureMap({ count: 50, seed: 7 });
    const b = makeFixtureMap({ count: 50, seed: 7 });
    expect(a.points[0]).toEqual(b.points[0]);
    expect(a.points.at(-1)).toEqual(b.points.at(-1));
  });

  it("уважает count и dims=3", () => {
    const m = makeFixtureMap({ count: 123 });
    expect(m.points).toHaveLength(123);
    expect(m.dims).toBe(3);
    expect(m.points[0].coords).toHaveLength(3);
  });

  it("все точки внутри возвращённых bounds", () => {
    const m = makeFixtureMap({ count: 500, seed: 3 });
    for (const p of m.points) {
      for (let d = 0; d < 3; d++) {
        expect(p.coords[d]).toBeGreaterThanOrEqual(m.bounds.min[d]);
        expect(p.coords[d]).toBeLessThanOrEqual(m.bounds.max[d]);
      }
    }
  });

  it("суммы размеров кластеров равны count", () => {
    const m = makeFixtureMap({ count: 200, clusters: 5 });
    const sum = m.clusters.reduce((s, c) => s + (c.size ?? 0), 0);
    expect(sum).toBe(200);
    expect(m.clusters).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm exec vitest run src/features/semantic-map/fixtures.test.ts`
Expected: FAIL (`Cannot find module './fixtures'`).

- [ ] **Step 3: Реализовать `fixtures.ts`**

```ts
// src/features/semantic-map/fixtures.ts
// Детерминированный генератор облака точек контрактной формы (dev/stress/тесты).
// Seeded PRNG (mulberry32) — без Math.random, чтобы выдача была воспроизводима.
import type { MapCluster, MapData, MapPoint } from "./types";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Цвета НЕ дублируем: fixtures не задаёт cluster.color — цвет берёт нормализатор
// из палитры-фолбэка по id (см. palette.ts `clusterColor`). Единый источник истины.
const LABELS = [
  "немецкий идеализм", "феноменология", "стоицизм", "эмпиризм",
  "экзистенциализм", "схоластика", "прагматизм", "аналитическая философия",
];

export interface FixtureOptions {
  count?: number;
  clusters?: number;
  seed?: number;
}

export function makeFixtureMap(opts: FixtureOptions = {}): MapData {
  const count = opts.count ?? 2000;
  const k = Math.max(1, opts.clusters ?? 8);
  const rng = mulberry32(opts.seed ?? 1);
  const spread = 0.18;

  const centroids: Array<[number, number, number]> = Array.from({ length: k }, () => [
    rng() * 2 - 1,
    rng() * 2 - 1,
    rng() * 2 - 1,
  ]);

  const clusters: MapCluster[] = centroids.map((_, i) => ({
    id: i,
    label: LABELS[i % LABELS.length] ?? "",
    size: 0,
  }));

  const points: MapPoint[] = [];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < count; i++) {
    const c = i % k;
    const cluster = clusters[c];
    if (cluster) cluster.size = (cluster.size ?? 0) + 1;
    const centroid = centroids[c] ?? [0, 0, 0];
    const [cx, cy, cz] = centroid;
    const isGloss = rng() < 0.04;
    const coords: [number, number, number] = [
      cx + gauss(rng) * spread,
      cy + gauss(rng) * spread,
      cz + gauss(rng) * spread,
    ];
    for (let d = 0; d < 3; d++) {
      const cd = coords[d] ?? 0; // индекс кортежа переменной d → number | undefined
      if (cd < (min[d] ?? 0)) min[d] = cd;
      if (cd > (max[d] ?? 0)) max[d] = cd;
    }
    points.push({
      type: isGloss ? "glossary" : "document",
      id: `${isGloss ? "g" : "d"}-${i}`,
      coords,
      cluster: c,
    });
  }

  return {
    layout_version: 1,
    dims: 3,
    bounds: { min, max },
    clusters,
    points,
  };
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm exec vitest run src/features/semantic-map/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/fixtures.ts src/features/semantic-map/fixtures.test.ts
git commit -m "feat(semantic-map): deterministic fixture map generator"
```

---

### Task 4: Нормализатор `toRenderModel`

**Files:**
- Create: `src/features/semantic-map/to-render-model.ts`
- Test: `src/features/semantic-map/to-render-model.test.ts`

**Interfaces:**
- Consumes: `MapData`, `RenderModel`, `RenderCluster` из `./types`; `clusterColor`, `hexToRgb01` из `./palette`.
- Produces: `toRenderModel(data: MapData): RenderModel`. Устойчив к: неизвестному `type` (→ слот `"other"`), отсутствию `color` (→ палитра), `dims < 3` (z=0), отсутствию `bounds` (считает из точек).

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/semantic-map/to-render-model.test.ts
import { describe, it, expect } from "vitest";

import type { MapData } from "./types";
import { toRenderModel } from "./to-render-model";

function baseData(overrides: Partial<MapData> = {}): MapData {
  return {
    layout_version: 1,
    dims: 3,
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
    clusters: [{ id: 0, label: "A", color: "#ffffff", size: 1 }],
    points: [{ type: "document", id: "x", coords: [0.5, -0.5, 0.25], cluster: 0 }],
    ...overrides,
  };
}

describe("toRenderModel", () => {
  it("раскладывает координаты в Float32Array", () => {
    const m = toRenderModel(baseData());
    expect(m.count).toBe(1);
    expect(Array.from(m.positions)).toEqual([0.5, -0.5, 0.25]);
    expect(m.ids).toEqual(["x"]);
  });

  it("неизвестный type сворачивается в слот other, не падает", () => {
    const m = toRenderModel(
      baseData({ points: [{ type: "podcast", id: "p", coords: [0, 0, 0], cluster: 0 }] }),
    );
    expect(m.typeTable).toContain("other");
    expect(m.typeTable[m.typeCodes[0]]).toBe("other");
  });

  it("отсутствие cluster.color → цвет из палитры (валидный RGB)", () => {
    const m = toRenderModel(
      baseData({ clusters: [{ id: 0, label: "A" }] }),
    );
    expect(m.colors).toHaveLength(3);
    expect(m.colors[0]).toBeGreaterThanOrEqual(0);
    expect(m.colors[0]).toBeLessThanOrEqual(1);
    expect(m.clusters[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("dims=2 → z обнуляется", () => {
    const m = toRenderModel(
      baseData({ dims: 2, points: [{ type: "document", id: "y", coords: [0.1, 0.2], cluster: 0 }] }),
    );
    // positions — Float32Array: 0.1/0.2 НЕ точны в float32 → toBeCloseTo, не toEqual.
    const pos = Array.from(m.positions);
    expect(pos[0]).toBeCloseTo(0.1, 6);
    expect(pos[1]).toBeCloseTo(0.2, 6);
    expect(pos[2]).toBe(0);
  });

  it("без bounds — считает из точек", () => {
    const data = baseData({
      points: [
        { type: "document", id: "a", coords: [-2, 0, 0], cluster: 0 },
        { type: "document", id: "b", coords: [3, 1, -1], cluster: 0 },
      ],
    });
    // @ts-expect-error — намеренно убираем bounds для проверки фолбэка
    delete data.bounds;
    const m = toRenderModel(data);
    expect(m.bounds.min[0]).toBe(-2);
    expect(m.bounds.max[0]).toBe(3);
  });

  it("вычисляет центроид кластера", () => {
    const m = toRenderModel(
      baseData({
        points: [
          { type: "document", id: "a", coords: [0, 0, 0], cluster: 0 },
          { type: "document", id: "b", coords: [2, 2, 2], cluster: 0 },
        ],
      }),
    );
    expect(m.clusters[0].centroid).toEqual([1, 1, 1]);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm exec vitest run src/features/semantic-map/to-render-model.test.ts`
Expected: FAIL (`Cannot find module './to-render-model'`).

- [ ] **Step 3: Реализовать `to-render-model.ts`**

```ts
// src/features/semantic-map/to-render-model.ts
// Чистая нормализация MapData → RenderModel (типизированные массивы для one-draw-call).
// Здесь живёт вся «контрактная устойчивость»: additive-игнор, неизвестный type, нет цвета/bounds.
import { clusterColor, hexToRgb01 } from "./palette";
import type { MapBounds, MapData, RenderCluster, RenderModel } from "./types";

const KNOWN_TYPES = ["document", "glossary"];

export function toRenderModel(data: MapData): RenderModel {
  // Поля контракта (dims/points/clusters) non-nullable по типу — без `?? …`
  // (ESLint strictTypeChecked: no-unnecessary-condition). Защита от malformed —
  // на слое parseMapResponse (schemas.ts), фикстуры всегда well-formed.
  const dims = data.dims;
  const pts = data.points;
  const count = pts.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ids: string[] = new Array(count);
  const typeCodes = new Uint8Array(count);

  // Таблица типов: известные + единый слот "other" для неизвестных.
  const typeTable: string[] = [...KNOWN_TYPES, "other"];
  const genericIdx = typeTable.length - 1;
  const typeIndex = new Map<string, number>(KNOWN_TYPES.map((t, i) => [t, i]));

  // Резолв цвета кластера один раз.
  const colorByCluster = new Map<number, string>();
  for (const c of data.clusters) colorByCluster.set(c.id, clusterColor(c.id, c.color));

  // Аккумулятор центроидов.
  const agg = new Map<number, { x: number; y: number; z: number; n: number }>();

  // forEach даёт `p: MapPoint` (определён), без `pts[i]: MapPoint | undefined`.
  pts.forEach((p, i) => {
    const co = p.coords; // number[]; элементы — `number | undefined` (noUncheckedIndexedAccess)
    const x = co[0] ?? 0;
    const y = co[1] ?? 0;
    const z = dims >= 3 ? co[2] ?? 0 : 0;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const hex = colorByCluster.get(p.cluster) ?? clusterColor(p.cluster);
    const [r, g, b] = hexToRgb01(hex);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    ids[i] = p.id;
    typeCodes[i] = typeIndex.get(p.type) ?? genericIdx; // неизвестный type → generic

    const a = agg.get(p.cluster) ?? { x: 0, y: 0, z: 0, n: 0 };
    a.x += x;
    a.y += y;
    a.z += z;
    a.n += 1;
    agg.set(p.cluster, a);
  });

  const clusters: RenderCluster[] = data.clusters.map((c) => {
    const a = agg.get(c.id);
    const centroid: [number, number, number] =
      a && a.n ? [a.x / a.n, a.y / a.n, a.z / a.n] : [0, 0, 0];
    return {
      id: c.id,
      label: c.label ?? "",
      color: clusterColor(c.id, c.color),
      size: c.size ?? a?.n ?? 0,
      centroid,
    };
  });

  return { count, positions, colors, ids, typeCodes, typeTable, bounds: computeBounds(data.bounds, positions, count), clusters };
}

// Параметр типизирован `MapBounds | undefined`, чтобы рантайм-фолбэк «нет bounds →
// считаем из точек» был легитимен под no-unnecessary-condition (тест удаляет bounds).
function computeBounds(
  b: MapBounds | undefined,
  positions: Float32Array,
  count: number,
): { min: [number, number, number]; max: [number, number, number] } {
  if (b && b.min.length >= 2 && b.max.length >= 2) {
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
      // fallback должен совпадать с инициализацией (Infinity/-Infinity), а не 0,
      // чтобы первая точка корректно сужала диапазон (недостижимо при d∈{0,1,2}, но самосогласованно).
      if (v < (min[d] ?? Infinity)) min[d] = v;
      if (v > (max[d] ?? -Infinity)) max[d] = v;
    }
  }
  if (!Number.isFinite(min[0])) return { min: [-1, -1, -1], max: [1, 1, 1] };
  return { min, max };
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm exec vitest run src/features/semantic-map/to-render-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/to-render-model.ts src/features/semantic-map/to-render-model.test.ts
git commit -m "feat(semantic-map): MapData → RenderModel normalizer"
```

---

### Task 5: Защитный Zod-parse ответа (server-only, под реальный бэк)

**Files:**
- Create: `src/features/semantic-map/schemas.ts`
- Test: `src/features/semantic-map/schemas.test.ts`

**Interfaces:**
- Consumes: `MapData` из `./types`; `zod`.
- Produces: `parseMapResponse(raw: unknown): MapData` — additive-толерантный (незнакомые поля игнор, неизвестный `type` проходит как строка). **DORMANT в v1**: не вызывается нигде (в `api.ts` — только в комментарии-инструкции swap'а), покрыт лишь собственным юнит-тестом; включится, когда `/api/map` появится в `schema.ts` (см. Task 9-комментарий + Task 10 follow-up 3).

> Примечание: файл начинается с `import "server-only";`. В Vitest `server-only` застаблен алиасом (`vitest.config.ts`), поэтому тест импортируется без `vi.mock`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/semantic-map/schemas.test.ts
import { describe, it, expect } from "vitest";

import { parseMapResponse } from "./schemas";

const ok = {
  layout_version: 7,
  dims: 3,
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  clusters: [{ id: 0, label: "A", color: "#5B8FF9", size: 2 }],
  points: [{ type: "document", id: "x", coords: [0, 0, 0], cluster: 0 }],
};

describe("parseMapResponse", () => {
  it("парсит валидный ответ", () => {
    const r = parseMapResponse(ok);
    expect(r.layout_version).toBe(7);
    expect(r.points).toHaveLength(1);
  });

  it("игнорирует незнакомые additive-поля", () => {
    const r = parseMapResponse({ ...ok, future_field: 42, points: [{ ...ok.points[0], extra: 1 }] });
    expect(r.points[0].id).toBe("x");
  });

  it("пропускает неизвестный type как строку", () => {
    const r = parseMapResponse({ ...ok, points: [{ ...ok.points[0], type: "podcast" }] });
    expect(r.points[0].type).toBe("podcast");
  });

  it("отклоняет структурно битый ответ", () => {
    expect(() => parseMapResponse({ dims: 3 })).toThrow();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm exec vitest run src/features/semantic-map/schemas.test.ts`
Expected: FAIL (`Cannot find module './schemas'`).

- [ ] **Step 3: Реализовать `schemas.ts`**

```ts
// src/features/semantic-map/schemas.ts
import "server-only";

import { z } from "zod";

import type { MapData } from "./types";

// .passthrough() — additive-толерантность: незнакомые поля не валят парс.
const ClusterSchema = z
  .object({
    id: z.number(),
    label: z.string().optional(),
    color: z.string().optional(),
    size: z.number().optional(),
  })
  .passthrough();

const PointSchema = z
  .object({
    type: z.string(), // не enum — неизвестный тип легитимен
    id: z.string(),
    coords: z.array(z.number()),
    cluster: z.number(),
  })
  .passthrough();

const MapResponseSchema = z
  .object({
    layout_version: z.number(),
    dims: z.number(),
    bounds: z.object({ min: z.array(z.number()), max: z.array(z.number()) }).passthrough(),
    clusters: z.array(ClusterSchema),
    points: z.array(PointSchema),
  })
  .passthrough();

/** Защитный парс ответа /api/map. Бросает ZodError на структурно битом теле. */
export function parseMapResponse(raw: unknown): MapData {
  return MapResponseSchema.parse(raw) as MapData;
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm exec vitest run src/features/semantic-map/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/schemas.ts src/features/semantic-map/schemas.test.ts
git commit -m "feat(semantic-map): defensive additive-tolerant response parse"
```

---

### Task 6: Чистая геометрия камеры и проекции

**Files:**
- Create: `src/features/semantic-map/renderer/camera-fit.ts`
- Create: `src/features/semantic-map/renderer/project.ts`
- Test: `src/features/semantic-map/renderer/camera-fit.test.ts`
- Test: `src/features/semantic-map/renderer/project.test.ts`

**Interfaces:**
- Produces:
  - `fit2D(min, max, aspect, pad?): { centerX, centerY, halfH }` — только полу-высота (ширину рендерер выводит как `halfH*aspect` на ресайзе; aspect-only ресайз не сбивает pan/zoom)
  - `fit3D(min, max, fovDeg, pad?): { center: [number,number,number]; distance: number }`
  - `projectToScreen(p, viewProj, width, height): { x: number; y: number; visible: boolean }` — `viewProj` = column-major 4×4 (`THREE.Matrix4.elements`).

- [ ] **Step 1: Написать падающие тесты**

```ts
// src/features/semantic-map/renderer/camera-fit.test.ts
import { describe, it, expect } from "vitest";

import { fit2D, fit3D } from "./camera-fit";

describe("fit2D", () => {
  it("центрирует по bounds", () => {
    const f = fit2D([-2, -4, 0], [2, 4, 0], 1);
    expect(f.centerX).toBe(0);
    expect(f.centerY).toBe(0);
  });
  it("кадр покрывает и ширину, и высоту при широком aspect", () => {
    const aspect = 2;
    const f = fit2D([-1, -1, 0], [1, 1, 0], aspect); // worldW=worldH=2
    expect(f.halfH).toBeGreaterThanOrEqual(1); // высота 2 влезает (2*halfH>=2)
    expect(f.halfH * aspect).toBeGreaterThanOrEqual(1); // ширина 2 влезает (2*halfH*aspect>=2)
  });
  it("не делит на ноль на вырожденных bounds", () => {
    const f = fit2D([0, 0, 0], [0, 0, 0], 1);
    expect(Number.isFinite(f.halfH)).toBe(true);
    expect(f.halfH).toBeGreaterThan(0);
  });
});

describe("fit3D", () => {
  it("центр — середина bounds, дистанция положительна", () => {
    const f = fit3D([-1, -1, -1], [1, 1, 1], 50);
    expect(f.center).toEqual([0, 0, 0]);
    expect(f.distance).toBeGreaterThan(0);
  });
  it("вырожденные bounds → дистанция конечна", () => {
    const f = fit3D([0, 0, 0], [0, 0, 0], 50);
    expect(Number.isFinite(f.distance)).toBe(true);
    expect(f.distance).toBeGreaterThan(0);
  });
});
```

```ts
// src/features/semantic-map/renderer/project.test.ts
import { describe, it, expect } from "vitest";

import { projectToScreen } from "./project";

// Column-major identity 4x4.
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe("projectToScreen", () => {
  it("identity: центр NDC → центр экрана", () => {
    const s = projectToScreen([0, 0, 0], I, 200, 100);
    expect(s.x).toBeCloseTo(100, 5);
    expect(s.y).toBeCloseTo(50, 5);
    expect(s.visible).toBe(true);
  });
  it("y инвертируется (экранный верх)", () => {
    const top = projectToScreen([0, 0.5, 0], I, 200, 100);
    expect(top.y).toBeLessThan(50); // выше центра
  });
  it("точка вне куба NDC → невидима", () => {
    const s = projectToScreen([5, 0, 0], I, 200, 100);
    expect(s.visible).toBe(false);
  });
  it("w=0 → невидима, без NaN", () => {
    const zeroW = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const s = projectToScreen([1, 1, 1], zeroW, 200, 100);
    expect(s.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — падают**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/camera-fit.test.ts src/features/semantic-map/renderer/project.test.ts`
Expected: FAIL (модули не найдены).

- [ ] **Step 3: Реализовать `camera-fit.ts`**

```ts
// src/features/semantic-map/renderer/camera-fit.ts
// Чистая математика подгонки камеры под bounds (без three).
type Vec3 = [number, number, number];

export interface Frame2D {
  centerX: number;
  centerY: number;
  /** Половина ВЕРТИКАЛЬНОГО мирового размера кадра (уже учитывает aspect, чтобы влезла ширина). */
  halfH: number;
}

// Возвращает только полу-высоту + центр; ширину рендерер выводит как halfH*aspect
// на каждом resize. Это даёт aspect-only ресайз без перекадрирования (см. ThreeMapRenderer.resize),
// и единственное число halfH переживает смену пропорций окна.
export function fit2D(min: Vec3, max: Vec3, aspect: number, pad = 1.1): Frame2D {
  const a = aspect > 0 ? aspect : 1;
  const centerX = (min[0] + max[0]) / 2;
  const centerY = (min[1] + max[1]) / 2;
  const worldW = Math.max(max[0] - min[0], 1e-6);
  const worldH = Math.max(max[1] - min[1], 1e-6);
  // halfH должен покрыть и высоту (worldH/2), и ширину (worldW/2/aspect).
  const halfH = Math.max(worldH / 2, worldW / 2 / a) * pad;
  return { centerX, centerY, halfH };
}

export interface Frame3D {
  center: Vec3;
  distance: number;
}

export function fit3D(min: Vec3, max: Vec3, fovDeg: number, pad = 1.2): Frame3D {
  const center: Vec3 = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const radius =
    0.5 * Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * pad;
  const r = radius > 0 ? radius : 1;
  const distance = r / Math.sin((fovDeg * Math.PI) / 180 / 2);
  return { center, distance };
}
```

- [ ] **Step 4: Реализовать `project.ts`**

```ts
// src/features/semantic-map/renderer/project.ts
// world → screen-пиксели через column-major 4x4 view-projection (THREE.Matrix4.elements).
type Vec3 = [number, number, number];

export function projectToScreen(
  p: Vec3,
  viewProj: ArrayLike<number>,
  width: number,
  height: number,
): { x: number; y: number; visible: boolean } {
  const [x, y, z] = p;
  // ArrayLike-индекс под noUncheckedIndexedAccess — `number | undefined`; хелпер с `?? 0`.
  const e = (i: number): number => viewProj[i] ?? 0;
  const cx = e(0) * x + e(4) * y + e(8) * z + e(12);
  const cy = e(1) * x + e(5) * y + e(9) * z + e(13);
  const cz = e(2) * x + e(6) * y + e(10) * z + e(14);
  const cw = e(3) * x + e(7) * y + e(11) * z + e(15);
  if (cw === 0) return { x: 0, y: 0, visible: false };
  const ndcX = cx / cw;
  const ndcY = cy / cw;
  const ndcZ = cz / cw;
  const sx = (ndcX * 0.5 + 0.5) * width;
  const sy = (1 - (ndcY * 0.5 + 0.5)) * height;
  const visible =
    ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && ndcZ >= -1 && ndcZ <= 1;
  return { x: sx, y: sy, visible };
}
```

- [ ] **Step 5: Запустить — зелёные**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/camera-fit.test.ts src/features/semantic-map/renderer/project.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/renderer/camera-fit.ts src/features/semantic-map/renderer/project.ts src/features/semantic-map/renderer/camera-fit.test.ts src/features/semantic-map/renderer/project.test.ts
git commit -m "feat(semantic-map): pure camera-fit + world-to-screen projection"
```

---

### Task 7: Порт `MapRenderer` + реализация на three.js

> three-glue не юнитим в jsdom (нет WebGL-контекста) — верификация через `pnpm typecheck` + `pnpm build` (резолв импортов three, согласованность типов) и ручной smoke в Task 10. Чистая математика уже покрыта Task 6.

**Files:**
- Create: `src/features/semantic-map/renderer/map-renderer.ts`
- Create: `src/features/semantic-map/renderer/three-map-renderer.ts`
- Create: `src/features/semantic-map/renderer/index.ts`

**Interfaces:**
- Consumes: `RenderModel` из `../types`; `fit2D`, `fit3D` из `./camera-fit`; `three`, `OrbitControls`.
- Produces:
  - `type RenderMode = "2d" | "3d"`
  - `interface MapRenderer { mount; setModel; setMode; fitToBounds; resize; getViewProjection; onChange; onPick?; destroy }`
  - `class ThreeMapRenderer implements MapRenderer`

- [ ] **Step 1: Реализовать порт `map-renderer.ts`**

```ts
// src/features/semantic-map/renderer/map-renderer.ts
// Порт рендерера: единственная точка, где наружу торчит способность рисовать карту.
// three.js скрыт в реализации; UI-слой знает только этот интерфейс.
import type { RenderModel } from "../types";

export type RenderMode = "2d" | "3d";

export interface MapRenderer {
  /** Привязать к <canvas> и запустить render-loop. */
  mount(canvas: HTMLCanvasElement): void;
  /** Загрузить/заменить данные (строит буферы, подгоняет камеру). */
  setModel(model: RenderModel): void;
  /** Переключить 2D⇄3D на тех же буферах. */
  setMode(mode: RenderMode): void;
  /** Подогнать камеру под bounds текущей модели. */
  fitToBounds(): void;
  /** Сообщить новый размер вьюпорта (CSS-пиксели) и DPR. */
  resize(width: number, height: number, dpr: number): void;
  /** Column-major 4×4 view-projection активной камеры (для overlay-подписей). null до mount/model. */
  getViewProjection(): Float32Array | null;
  /** Подписка на каждый отрисованный кадр (для синхронизации HTML-overlay подписей). */
  onChange(cb: () => void): void;
  /** Стаб v1: hover/click-picking (overlay/lazy-детали — будущая фаза). */
  onPick?(cb: (id: string | null) => void): void;
  /** Освободить GPU-ресурсы и остановить loop. */
  destroy(): void;
}
```

- [ ] **Step 2: Реализовать `three-map-renderer.ts`**

```ts
// src/features/semantic-map/renderer/three-map-renderer.ts
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { RenderModel } from "../types";
import { fit2D, fit3D } from "./camera-fit";
import type { MapRenderer, RenderMode } from "./map-renderer";

export class ThreeMapRenderer implements MapRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly ortho: THREE.OrthographicCamera;
  private readonly persp: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private points: THREE.Points | null = null;
  private model: RenderModel | null = null;
  private mode: RenderMode = "2d";
  private width = 1;
  private height = 1;
  private dpr = 1;
  /** Полу-высота ортокадра (мировые ед.) — для aspect-only ресайза без перекадрирования. */
  private orthoHalfH = 1;
  private dirty = true;
  private raf = 0;
  private disposed = false;
  private changeCb: (() => void) | null = null;

  constructor() {
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    this.persp = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
  }

  mount(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.applyMode();
    // Первый кадр сразу в правильном буфере (иначе мелькнёт 1×1, растянутый CSS).
    this.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1);
    this.dirty = true;
    this.loop();
  }

  setModel(model: RenderModel): void {
    this.model = model;
    if (this.points) {
      this.scene.remove(this.points);
      disposePoints(this.points);
      this.points = null;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(model.positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(model.colors, 3));
    const mat = new THREE.PointsMaterial({
      // Размер в ПИКСЕЛЯХ (sizeAttenuation:false) в ОБОИХ режимах — предсказуемо и не зависит
      // от масштаба bounds. (В 3D с world-unit-размером на нормализованных ~[-1,1] координатах
      // точки вырождались бы в субпиксельные пятна.) depthWrite:false — убрать blending-артефакты.
      size: 3,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.points = new THREE.Points(geom, mat);
    this.scene.add(this.points);
    this.fitToBounds();
  }

  setMode(mode: RenderMode): void {
    if (mode === this.mode && this.controls) return;
    this.mode = mode;
    this.applyMode();
  }

  private applyMode(): void {
    if (this.controls) this.controls.dispose();
    const cam = this.activeCamera();
    if (this.renderer) {
      this.controls = new OrbitControls(cam, this.renderer.domElement);
      this.controls.enableDamping = true;
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
    // Материал mode-агностичен (пиксельный размер) — пере-настраивать при смене режима не нужно.
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
      this.ortho.zoom = 1; // сбросить накопленный пользователем zoom при пере-фите
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
    // Ресайз меняет ТОЛЬКО aspect, НЕ перекадрирует (иначе сбивал бы pan/zoom/орбиту).
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
    // Считаем inverse САМИ: matrixWorldInverse обновляет только renderer.render(), а нас
    // зовут и вне render-тика (post-mount/resize) — иначе подписи легли бы по устаревшей матрице.
    const viewInverse = cam.matrixWorld.clone().invert();
    const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, viewInverse);
    return new Float32Array(m.elements);
  }

  onChange(cb: () => void): void {
    this.changeCb = cb;
  }

  onPick(): void {
    // Стаб v1: hover/click-picking — будущая фаза (overlay/lazy-детали).
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
    this.controls?.dispose();
    if (this.points) disposePoints(this.points);
    this.renderer?.dispose();
    this.renderer = null;
  }
}

function disposePoints(p: THREE.Points): void {
  p.geometry.dispose();
  const m = p.material;
  if (Array.isArray(m)) m.forEach((x) => x.dispose());
  else m.dispose();
}
```

- [ ] **Step 3: Реализовать `renderer/index.ts`**

```ts
// src/features/semantic-map/renderer/index.ts
export type { MapRenderer, RenderMode } from "./map-renderer";
export { ThreeMapRenderer } from "./three-map-renderer";
```

- [ ] **Step 4: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS (нет ошибок в `src/features/semantic-map/renderer/*`).

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/renderer/map-renderer.ts src/features/semantic-map/renderer/three-map-renderer.ts src/features/semantic-map/renderer/index.ts
git commit -m "feat(semantic-map): MapRenderer port + three.js implementation"
```

---

### Task 8: UI — оркестратор, lazy-обёртка, тумблер, подписи

> Client-компоненты с WebGL/canvas — верификация через `pnpm typecheck`/`pnpm build` + ручной smoke (Task 10). Строки — инлайн RU (`// i18n:`), без `useT`.

**Files:**
- Create: `src/features/semantic-map/ui/map-region-labels.tsx`
- Create: `src/features/semantic-map/ui/map-mode-toggle.tsx`
- Create: `src/features/semantic-map/ui/semantic-map-view.tsx`
- Create: `src/features/semantic-map/ui/semantic-map.tsx`

**Interfaces:**
- Consumes: `MapData` из `../types`; `toRenderModel` из `../to-render-model`; `ThreeMapRenderer`, `RenderMode` из `../renderer`; `projectToScreen` из `../renderer/project`; `Button`, `Skeleton` из `@/components/ui`.
- Produces:
  - `MapRegionLabels({ labels: ProjectedLabel[] })`, `interface ProjectedLabel { id; label; color; x; y }`
  - `MapModeToggle({ mode, onChange })`
  - `default SemanticMapView({ data })`
  - `SemanticMap({ data })` (lazy, `ssr:false`)

- [ ] **Step 1: `map-region-labels.tsx`**

```tsx
"use client";
// src/features/semantic-map/ui/map-region-labels.tsx
export interface ProjectedLabel {
  id: number;
  label: string;
  color: string;
  x: number;
  y: number;
}

export function MapRegionLabels({ labels }: { labels: ProjectedLabel[] }) {
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

- [ ] **Step 2: `map-mode-toggle.tsx`**

```tsx
"use client";
// src/features/semantic-map/ui/map-mode-toggle.tsx
import { Button } from "@/components/ui";

import type { RenderMode } from "../renderer";

export function MapModeToggle({
  mode,
  onChange,
}: {
  mode: RenderMode;
  onChange: (m: RenderMode) => void;
}) {
  return (
    // i18n: aria-label «Размерность карты» вынести в namespace semanticMap при интеграции
    <div
      role="group"
      aria-label="Размерность карты"
      className="inline-flex gap-1 rounded-md bg-(--color-surface) p-1 shadow"
    >
      {(["2d", "3d"] as const).map((m) => (
        <Button
          key={m}
          size="sm"
          variant={mode === m ? "primary" : "ghost"}
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
        >
          {m.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `semantic-map-view.tsx`**

```tsx
"use client";
// src/features/semantic-map/ui/semantic-map-view.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import type { MapData } from "../types";
import { toRenderModel } from "../to-render-model";
import { ThreeMapRenderer } from "../renderer";
import type { RenderMode } from "../renderer";
import { projectToScreen } from "../renderer/project";

import { MapModeToggle } from "./map-mode-toggle";
import { MapRegionLabels, type ProjectedLabel } from "./map-region-labels";

const MODE_KEY = "semantic-map:mode";

export default function SemanticMapView({ data }: { data: MapData }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ThreeMapRenderer | null>(null);
  const [mode, setMode] = useState<RenderMode>("2d");
  // Текущий режим в ref — чтобы lifecycle-эффект (ключ [model]) применял его после
  // пере-создания рендерера при смене data, не теряя выбор пользователя.
  const modeRef = useRef<RenderMode>("2d");
  const [labels, setLabels] = useState<ProjectedLabel[]>([]);
  const model = useMemo(() => toRenderModel(data), [data]);

  // Восстановить сохранённый режим.
  useEffect(() => {
    const saved = window.localStorage.getItem(MODE_KEY);
    if (saved === "2d" || saved === "3d") setMode(saved);
  }, []);

  // Жизненный цикл рендерера.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const r = new ThreeMapRenderer();
    rendererRef.current = r;

    const updateLabels = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const vp = r.getViewProjection();
      if (!vp || w === 0 || h === 0) return; // скрытая вкладка / до первого кадра
      const next: ProjectedLabel[] = [];
      for (const c of model.clusters) {
        if (!c.label) continue;
        const s = projectToScreen(c.centroid, vp, w, h);
        if (s.visible) next.push({ id: c.id, label: c.label, color: c.color, x: s.x, y: s.y });
      }
      setLabels(next);
    };

    r.mount(canvas);
    r.resize(wrap.clientWidth || 1, wrap.clientHeight || 1, window.devicePixelRatio || 1);
    r.onChange(updateLabels); // ДО setModel — чтобы первый отрисованный кадр обновил подписи
    r.setModel(model);
    r.setMode(modeRef.current); // применить текущий/восстановленный режим (переживает смену data)

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
  }, [model]);

  // Применять смену режима + персист. modeRef переживает пере-маунт рендерера при смене data.
  useEffect(() => {
    modeRef.current = mode;
    rendererRef.current?.setMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <MapRegionLabels labels={labels} />
      <div className="absolute right-3 top-3">
        <MapModeToggle mode={mode} onChange={setMode} />
      </div>
      {model.count === 0 && (
        // i18n: вынести строку при интеграции
        <div className="absolute inset-0 flex items-center justify-center text-sm text-(--color-fg-muted)">
          Карта пуста
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `semantic-map.tsx` (lazy, ssr:false)**

```tsx
"use client";
// src/features/semantic-map/ui/semantic-map.tsx
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui";

import type { MapData } from "../types";

const View = dynamic(() => import("./semantic-map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function SemanticMap({ data }: { data: MapData }) {
  return <View data={data} />;
}
```

- [ ] **Step 5: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/semantic-map/ui/map-region-labels.tsx src/features/semantic-map/ui/map-mode-toggle.tsx src/features/semantic-map/ui/semantic-map-view.tsx src/features/semantic-map/ui/semantic-map.tsx
git commit -m "feat(semantic-map): React orchestrator, lazy wrapper, mode toggle, region labels"
```

---

### Task 9: Серверный fetcher, public API слайса, роут `/map`

**Files:**
- Create: `src/features/semantic-map/api.ts`
- Create: `src/features/semantic-map/index.ts`
- Create: `src/app/map/page.tsx`

**Interfaces:**
- Consumes: `makeFixtureMap` из `./fixtures`; `MapData` из `./types`; `getMap`, `SemanticMap` из слайса.
- Produces:
  - `getMap(count?: number): Promise<MapData>` (server-only, `cache()`).
  - Public re-exports `getMap`, `SemanticMap`.
  - Роут `/map`.

- [ ] **Step 1: `api.ts` (бэкенд-агностик-граница)**

```ts
// src/features/semantic-map/api.ts
import "server-only";
import { cache } from "react";

import { makeFixtureMap } from "./fixtures";
import type { MapData } from "./types";

/**
 * Карта смыслов. Read-only.
 *
 * БЭКЕНД-АГНОСТИК-ГРАНИЦА: сейчас возвращает фикстуру контрактной формы. Когда
 * /api/map появится в @/api/schema.ts — заменить тело на:
 *   const api = await createApiClient();
 *   const { data, error } = await api.GET("/api/map");
 *   if (error) throw new Error(error.message);
 *   return parseMapResponse(data);   // ./schemas
 * Сигнатура и потребители (нормализатор/рендерер/UI) не меняются.
 *
 * `count` — dev-only stress-параметр (см. /map?n=). В реальном пути игнорируется.
 */
export const getMap = cache(async (count?: number): Promise<MapData> => {
  return makeFixtureMap(count ? { count } : {});
});
```

- [ ] **Step 2: `index.ts` (public API)**

```ts
// src/features/semantic-map/index.ts
// Public API слайса: серверный fetcher + lazy client-обёртка карты.
export { getMap } from "./api";
export { SemanticMap } from "./ui/semantic-map";
```

- [ ] **Step 3: `src/app/map/page.tsx`**

```tsx
// src/app/map/page.tsx
import { getMap, SemanticMap } from "@/features/semantic-map";

export const metadata = {
  // i18n: заголовок вынести при интеграции
  title: "Карта смыслов",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const sp = await searchParams;
  const parsed = sp.n ? parseInt(sp.n, 10) : NaN;
  const count = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 200000) : undefined;
  const data = await getMap(count);

  return (
    <main className="h-[80vh] w-full">
      <SemanticMap data={data} />
    </main>
  );
}
```

- [ ] **Step 4: Проверить типы и сборку**

Run: `pnpm typecheck && pnpm build`
Expected: PASS; `/map` присутствует в выводе маршрутов сборки.

- [ ] **Step 5: Commit**

```bash
git add src/features/semantic-map/api.ts src/features/semantic-map/index.ts src/app/map/page.tsx
git commit -m "feat(semantic-map): server fetcher, slice public API, /map route"
```

---

### Task 10: Финальная верификация + follow-up-заметки

**Files:**
- Modify: `docs/superpowers/specs/2026-06-20-semantic-map-frontend-engine-design.md` (раздел статуса → «реализован v1», если уместно)

**Interfaces:** —

- [ ] **Step 1: Полный прогон гейтов (включая coverage — его гоняет CI)**

Run: `pnpm lint && pnpm test && pnpm build && pnpm test:coverage`
Expected: lint/test/build зелёные. `pnpm test:coverage` — пороги (statements 41 / branches 30 / functions 40 / lines 42) НЕ упали: чистые слои (palette/fixtures/to-render-model/camera-fit/project/schemas) покрыты юнитами и компенсируют непокрытые three-glue + UI.
Контингенция: если coverage просел из-за `renderer/three-map-renderer.ts` + `ui/*.tsx` (jsdom не исполняет WebGL → их не покрыть юнитами) — добавить эти пути в `coverage.exclude` в `vitest.config.ts`. Это **запретная зона** → отдельным coordinated foundation-PR (как Task 1), НЕ внутри фичи.

- [ ] **Step 2: Ручной smoke (dev)**

```bash
pnpm dev
```
Открыть `http://localhost:3001/map`:
- видны точки, раскрашенные по кластерам; подписи районов поверх облака;
- тумблер 2D/3D переключает камеру; в 2D pan/zoom, в 3D орбита;
- ресайз окна не ломает картинку; перезагрузка сохраняет выбранный режим;
- стресс: `http://localhost:3001/map?n=100000` — рендерится, навигация плавная.

Зафиксировать результат (скрин/заметка). Если 3D-облако «плоское» (вырожденный z) — это ожидаемо на фикстурах; см. открытый вопрос 3 спеки.

- [ ] **Step 3: Обновить статус спеки (по желанию) и закоммитить**

```bash
git add docs/superpowers/specs/2026-06-20-semantic-map-frontend-engine-design.md
git commit -m "docs(semantic-map): mark v1 engine implemented"
```

- [ ] **Step 4: Зафиксировать follow-up'ы (НЕ в этом плане)**

Создать задачи/заметки (не код):
1. **i18n-строки** chrome (тумблер aria, «Карта пуста», заголовок) — вынести в namespace `semanticMap`, **координируя с активной i18n-веткой**.
2. **Nav-ссылка** на `/map` — отдельный PR с владельцами `src/app/layout.tsx` (frozen zone).
3. **Подключение `/api/map`** — когда бэк отдаст эндпоинт и регенерится `schema.ts`: заменить тело `getMap()` (см. комментарий в `api.ts`), включить `parseMapResponse`, сузить типы из `@/api/schema`.
4. **Overlay/lazy-детали** (п.3–4 контракта) — реализовать `onPick` (Raycaster), `query_point`-маркер, подсветку хитов поиска.

---

## Self-Review

**1. Spec coverage:**
- Слой данных (`MapData`-граница, fixtures→API) → Task 3, Task 9 (`api.ts` swap-точка). ✓
- Нормализация `RenderModel` (устойчивость к type/color/dims/bounds) → Task 4. ✓
- Палитра-фолбэк → Task 2. ✓
- Защитный parse (additive) → Task 5. ✓
- Чистая геометрия (fit/project) → Task 6. ✓
- Порт `MapRenderer` + three.js (2D/3D, контролы, render-on-demand, DPR-cap, dispose) → Task 7. ✓
- Подписи районов (HTML-overlay) → Task 8. ✓
- React-оркестрация + lazy `ssr:false` + тумблер (localStorage, дефолт 2D) + состояния → Task 8. ✓
- Роут `/map` + dev-stress `?n=` + публичность (без RBAC) → Task 9. ✓
- Зависимость three (foundation-PR) → Task 1. ✓
- Тестирование (чистые юниты; three-glue вне jsdom) → Tasks 2–6 юниты, Task 7/8 typecheck+manual, Task 10 гейты. ✓
- Координация (i18n/nav/api-swap/overlay) → Task 10 follow-up. ✓
- Масштаб ~100k → Task 10 stress-smoke. ✓

**2. Placeholder scan:** Кода-плейсхолдеров нет; все шаги содержат полный код/команды. `// i18n:`-пометки — намеренные маркеры follow-up, не пропуски логики.

**3. Type consistency:** `MapData`/`RenderModel`/`RenderCluster` (Task 2) используются согласованно в Tasks 3–9. `RenderMode`/`MapRenderer` (Task 7) — в Task 8. `ProjectedLabel` определён в Task 8 (`map-region-labels.tsx`) и импортируется в `semantic-map-view.tsx`. `getViewProjection`/`onChange`/`fitToBounds`/`setMode`/`setModel`/`resize`/`destroy` — имена совпадают между портом (Task 7), реализацией (Task 7) и потребителем (Task 8). `makeFixtureMap`/`toRenderModel`/`clusterColor`/`hexToRgb01`/`projectToScreen`/`fit2D`/`fit3D`/`parseMapResponse` — сигнатуры единообразны между определением и вызовами (учтена новая сигнатура `fit2D → {centerX,centerY,halfH}`).

**4. Strict-конфиг + ревью агентами (правки внесены):** код приведён под `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + ESLint `strictTypeChecked` — индекс-доступ через `forEach`/`?? fallback` (не `arr[i]` напрямую), без `??`/`&&`/`?.` над НЕ-nullable полями. Проверено изолированным `tsc` с теми же флагами на репрезентативных сниппетах. Внесено по итогам 4-агентного ревью: (а) **DRY** — `fixtures.ts` не дублирует палитру (цвет берёт `clusterColor`-фолбэк); (б) **Float32-тест** `dims=2` → `toBeCloseTo`, не `toEqual`; (в) рендер — пиксельный размер точек в обоих режимах (3D-точки не вырождаются), **aspect-only** ресайз (pan/zoom не сбивается, `ortho.zoom` сброс на фите), `getViewProjection` считает inverse явно, режим переживает смену data через `modeRef`, `onChange` до `setModel`, guard 0×0; (г) `three/addons/...` импорт; (д) `Co-Authored-By` trailer в каждом коммите; (е) `schemas.ts` помечен DORMANT; (ж) Task 10 — честный `pnpm test:coverage` (CI его гоняет) с контингенцией на frozen `vitest.config.ts`.
