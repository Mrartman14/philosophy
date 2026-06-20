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
