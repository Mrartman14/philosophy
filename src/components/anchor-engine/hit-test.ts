// src/components/anchor-engine/hit-test.ts
import type { AnchorGeometry } from "./types";

export interface CaretPos {
  node: Node;
  offset: number;
}

/** Резолв координат → caret (для range-kind хит-теста в noteAtPointInGeometry). */
function caretFromPoint(x: number, y: number, root: HTMLElement): CaretPos | null {
  const doc = root.ownerDocument;
  // caretPositionFromPoint (стандарт/Firefox) и caretRangeFromPoint (WebKit/Blink)
  // отсутствуют в lib.dom-типах jsdom → локальный каст.
  const anyDoc = doc as unknown as {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let caret: CaretPos | null = null;
  if (anyDoc.caretPositionFromPoint) {
    const p = anyDoc.caretPositionFromPoint(x, y);
    if (p) caret = { node: p.offsetNode, offset: p.offset };
  } else if (anyDoc.caretRangeFromPoint) {
    const r = anyDoc.caretRangeFromPoint(x, y);
    if (r) caret = { node: r.startContainer, offset: r.startOffset };
  }
  if (!caret || !root.contains(caret.node)) return null;
  return caret;
}

function pointInRect(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Единственный хит-тест-контракт движка: точка → id ноты по УЖЕ ПОСЧИТАННЫМ
 * geometries (порядок Map = порядок notes → first-match). range-kind →
 * caret-resolve + comparePoint (caret внутри range → 0); rect-kind →
 * point-in-boundingRect (caret не применим — у rect нет Range).
 *
 * КОНТРАКТ ПРИОРИТЕТА (аудит #3): перебор строго в порядке notes (Map-порядок) →
 * возвращается ПЕРВАЯ совпавшая нота, без предпочтения kind. В bbox-зазоре
 * прямоугольного якоря (точка внутри bbox, но НЕ на тексте) rect-нота может выиграть
 * у линейной, идущей позже, хотя каретка стоит на её тексте. Это осознанно: (1)
 * пересечение rect-bbox и чужого range в живой раскладке — краевой случай (rect —
 * это ячейки таблицы; линейные caret-якоря обычно вне их bbox); (2) сортировка «все
 * range сначала, потом rect» сломала бы first-match по порядку notes (визуальный
 * приоритет верхней ноты). При появлении реального конфликта решать точечно, не
 * глобальным реордерингом kind.
 */
export function noteAtPointInGeometry(
  x: number,
  y: number,
  geometries: Map<string, AnchorGeometry | null>,
  root: HTMLElement,
): string | null {
  const caret = caretFromPoint(x, y, root);
  for (const [id, g] of geometries) {
    if (!g) continue;
    if (g.kind === "rect") {
      if (pointInRect(x, y, g.boundingRect)) return id;
    } else if (caret && g.range.comparePoint(caret.node, caret.offset) === 0) {
      return id;
    }
  }
  return null;
}
