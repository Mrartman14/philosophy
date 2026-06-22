// src/components/scene-3d/compute-bounds.ts
// Общий расчёт AABB облака точек для 3D-сцен (карта + граф). Bounds из контракта all-optional
// (semmap.Bounds / refgraph.Bounds) — b?.min/b?.max тоже optional. Здесь же — устойчивость
// к malformed входу: вырожденные/частично-нефинитные bounds и NaN/Infinity-координаты.
export function computeBounds(
  b: { min?: number[]; max?: number[] } | undefined,
  positions: Float32Array,
  count: number,
): { min: [number, number, number]; max: [number, number, number] } {
  // «Использовать присланные bounds» только если ВСЕ присутствующие оси финитны: вырожденные
  // bounds [±Infinity] (пустой корпус) или частичный Infinity уходят в расчёт-из-точек/дефолт,
  // иначе centerX=(Inf+-Inf)/2=NaN ломал бы камеру.
  if (b?.min && b.max && b.min.length >= 2 && b.max.length >= 2) {
    const hasZ = b.min.length >= 3;
    const allFinite =
      Number.isFinite(b.min[0]) &&
      Number.isFinite(b.min[1]) &&
      (!hasZ || Number.isFinite(b.min[2]));
    if (allFinite) {
      return {
        min: [b.min[0] ?? -1, b.min[1] ?? -1, b.min[2] ?? -1],
        max: [b.max[0] ?? 1, b.max[1] ?? 1, b.max[2] ?? 1],
      };
    }
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < 3; d++) {
      const v = positions[i * 3 + d] ?? 0;
      // Пропускаем нефинитные координаты — одна NaN/Infinity-точка не должна отравлять min/max.
      if (!Number.isFinite(v)) continue;
      // fallback должен совпадать с инициализацией (Infinity/-Infinity), а не 0,
      // чтобы первая точка корректно сужала диапазон (недостижимо при d∈{0,1,2}, но самосогласованно).
      if (v < (min[d] ?? Infinity)) min[d] = v;
      if (v > (max[d] ?? -Infinity)) max[d] = v;
    }
  }
  if (!Number.isFinite(min[0])) return { min: [-1, -1, -1], max: [1, 1, 1] };
  return { min, max };
}
