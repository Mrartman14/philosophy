// src/components/anchor-engine/connector-geometry.ts
// Чистая геометрия выноски-связи. Без React/DOM.
// Когда точки крепления на одной высоте (y1===y2) — рисуем СТРОГО ГОРИЗОНТАЛЬНУЮ
// прямую (без локтя и без диагонали). Это типичный случай: карточка стоит напротив
// якоря, а крепление к карточке берётся на высоте якоря (см. cardAttachY). Иначе —
// Word-style ортогональный «локоть»: вертикаль (vx) у края текста, в жёлобе.
// Инвариант: все x ∈ [min(x1,x2),max(x1,x2)] — путь не заходит в зону текста.
export interface ElbowInput {
  x1: number; // точка крепления к тексту (document-координаты)
  y1: number;
  x2: number; // точка крепления к карточке
  y2: number;
  stub?: number; // длина горизонтального уса в жёлоб
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function connectorPath({ x1, y1, x2, y2, stub = 12 }: ElbowInput): string {
  // На одной высоте → строго горизонтальная прямая, без локтя и без диагонали.
  if (y1 === y2) return `M ${round(x1)} ${round(y1)} L ${round(x2)} ${round(y2)}`;
  const dir = x2 >= x1 ? 1 : -1;
  const vx = x1 + dir * Math.min(stub, Math.abs(x2 - x1)); // вертикаль у края текста, зажата в жёлоб
  return `M ${round(x1)} ${round(y1)} L ${round(vx)} ${round(y1)} L ${round(vx)} ${round(y2)} L ${round(x2)} ${round(y2)}`;
}

// Высота крепления линии к карточке: на высоте якоря (anchorY), зажатая в
// вертикальные границы карточки с отступом pad от краёв. Якорь в пределах карточки
// → возвращает anchorY (линия строго горизонтальна, без излома); карточку увело
// стэкингом (anchorY вне диапазона) → ближний край карточки → тогда локоть оправдан.
export function cardAttachY(
  anchorY: number,
  cardTop: number,
  cardBottom: number,
  pad = 14,
): number {
  const lo = cardTop + pad;
  const hi = Math.max(lo, cardBottom - pad); // вырожденно-короткая карточка → lo
  return Math.min(Math.max(anchorY, lo), hi);
}
