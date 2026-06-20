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
  const ids: string[] = [];
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
      a?.n ? [a.x / a.n, a.y / a.n, a.z / a.n] : [0, 0, 0];
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
