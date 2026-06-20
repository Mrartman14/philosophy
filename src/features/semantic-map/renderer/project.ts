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
