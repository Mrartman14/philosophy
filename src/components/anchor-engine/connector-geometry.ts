// src/components/anchor-engine/connector-geometry.ts
// Чистая геометрия выноски-связи. Без React/DOM.
// Когда точки крепления на одной высоте (y1===y2) — рисуем СТРОГО ГОРИЗОНТАЛЬНУЮ
// прямую (без локтя и без диагонали). Иначе — Word-style ортогональный «локоть»:
// вертикаль (vx) у края текста, в жёлобе. Какие именно высоты брать — решает
// attachYs (по пересечению вертикальных диапазонов якоря и карточки).
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

export const FIRST_LINE_CLAMP_PX = 24; // оценка высоты первой строки (центр линейного якоря)

/**
 * Y-точка крепления выноски к якорю (document-координаты).
 * Прямоугольник → вертикальный ЦЕНТР bbox; линейный → центр ПЕРВОЙ строки (clamp).
 */
export function anchorAttachY(anchorTop: number, height: number, isRect: boolean): number {
  return isRect ? anchorTop + height / 2 : anchorTop + Math.min(height, FIRST_LINE_CLAMP_PX) / 2;
}

export function connectorPath({ x1, y1, x2, y2, stub = 12 }: ElbowInput): string {
  // На одной высоте → строго горизонтальная прямая, без локтя и без диагонали.
  if (y1 === y2) return `M ${round(x1)} ${round(y1)} L ${round(x2)} ${round(y2)}`;
  const dir = x2 >= x1 ? 1 : -1;
  const vx = x1 + dir * Math.min(stub, Math.abs(x2 - x1)); // вертикаль у края текста, зажата в жёлоб
  return `M ${round(x1)} ${round(y1)} L ${round(vx)} ${round(y1)} L ${round(vx)} ${round(y2)} L ${round(x2)} ${round(y2)}`;
}

// Высоты крепления линии, исходя из ПЕРЕСЕЧЕНИЯ вертикальных диапазонов якоря
// [anchorTop,anchorBottom] и карточки [cardTop,cardBottom]:
//  • пересекаются → обе точки на ОДНОЙ высоте внутри пересечения (как можно ближе к
//    anchorY — центру первой строки якоря) → connectorPath даёт горизонталь;
//  • не пересекаются → текст на своей высоте (anchorY), карточка у ближнего края
//    (edgePad внутрь) → разные высоты → локоть, чтобы «добраться» до карточки.
export function attachYs(
  anchorTop: number,
  anchorBottom: number,
  anchorY: number,
  cardTop: number,
  cardBottom: number,
  edgePad = 8,
): { y1: number; y2: number } {
  const top = Math.max(anchorTop, cardTop);
  const bottom = Math.min(anchorBottom, cardBottom);
  if (top <= bottom) {
    const y = Math.min(Math.max(anchorY, top), bottom); // в пределах пересечения
    return { y1: y, y2: y };
  }
  const y2 = cardTop > anchorBottom ? cardTop + edgePad : cardBottom - edgePad;
  return { y1: anchorY, y2 };
}
