import { Coordinate } from "@/components/lessons-timeline/timeline";

/**
 * Находит координаты середины ломаной линии по массиву точек.
 * @param {Array} points - Массив точек [{x: Number, y: Number}, ...]
 * @returns {{x: Number, y: Number}} - Координаты средней точки по длине линии
 */
export function getPolylineCenter(points: Coordinate[]): Coordinate | null {
  if (!points || points.length === 0) return null;
  if (points.length == 1) return points[0]!;

  // Считаем длину каждого сегмента и общую длину
  const lengths = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    totalLength += len;
  }

  // Находим середину по длине
  const halfLength = totalLength / 2;
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (acc + lengths[i] >= halfLength) {
      // Находим долю на текущем сегменте
      const remain = halfLength - acc;
      const ratio = remain / lengths[i];
      const x = points[i].x + (points[i + 1].x - points[i].x) * ratio;
      const y = points[i].y + (points[i + 1].y - points[i].y) * ratio;
      return { x, y };
    }
    acc += lengths[i];
  }

  // Если что-то пошло не так, возвращаем последнюю точку
  return points[points.length - 1];
}
