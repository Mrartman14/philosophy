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
