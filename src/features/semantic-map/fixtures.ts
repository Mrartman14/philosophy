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
  "немецкий идеализм",
  "феноменология",
  "стоицизм",
  "эмпиризм",
  "экзистенциализм",
  "схоластика",
  "прагматизм",
  "аналитическая философия",
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

  const centroids: [number, number, number][] = Array.from({ length: k }, () => [
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
