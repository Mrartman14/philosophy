// src/components/anchor-engine/hit-test.ts
import { rangeFromAnchor } from "./anchor-to-range";
import type { AnchoredNote, AnchorGeometry } from "./types";

export interface CaretPos {
  node: Node;
  offset: number;
}

/** Чистое ядро: какой note накрывает caret-позицию. Тестируемо без геометрии. */
export function noteContainingCaret(caret: CaretPos, notes: AnchoredNote[], root: HTMLElement): string | null {
  for (const n of notes) {
    const r = rangeFromAnchor(n.anchor, root);
    if (!r) continue;
    // point внутри r: r.start <= point <= r.end → comparePoint === 0.
    if (r.comparePoint(caret.node, caret.offset) === 0) return n.id;
  }
  return null;
}

/** Резолв координат → caret (вынесено из noteAtPoint для переиспользования). */
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

/** Браузерная обёртка: координаты клика → caret → noteContainingCaret. */
export function noteAtPoint(x: number, y: number, notes: AnchoredNote[], root: HTMLElement): string | null {
  const caret = caretFromPoint(x, y, root);
  if (!caret) return null;
  return noteContainingCaret(caret, notes, root);
}

function pointInRect(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Хит-тест по УЖЕ ПОСЧИТАННЫМ geometries (порядок Map = порядок notes → first-match).
 * range-kind → O(1) caret-resolve + дешёвый comparePoint (без пересчёта
 * rangeFromAnchor, эквивалентно noteAtPoint — ranges строятся тем же
 * rangeFromAnchor, см. useAnchorRanges); rect-kind → point-in-boundingRect (caret
 * не применим — нет Range). Заменяет noteAtPointInRanges.
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
