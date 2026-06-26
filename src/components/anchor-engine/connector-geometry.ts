// src/components/anchor-engine/connector-geometry.ts
// Чистая геометрия выноски-связи (Word-style ортогональный «локоть»). Без React/DOM.
// Инвариант: вертикаль (vx) стоит на стороне жёлоба, все x ∈ [min(x1,x2),max(x1,x2)] —
// путь никогда не заходит в зону текста (см. spec §«Геометрические инварианты»).
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
  const dir = x2 >= x1 ? 1 : -1;
  const vx = x1 + dir * Math.min(stub, Math.abs(x2 - x1)); // вертикаль у края текста, зажата в жёлоб
  return `M ${round(x1)} ${round(y1)} L ${round(vx)} ${round(y1)} L ${round(vx)} ${round(y2)} L ${round(x2)} ${round(y2)}`;
}
