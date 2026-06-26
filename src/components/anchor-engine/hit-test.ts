// src/components/anchor-engine/hit-test.ts
import { rangeFromAnchor } from "./anchor-to-range";
import type { AnchoredNote } from "./types";

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

/** Браузерная обёртка: координаты клика → caret → noteContainingCaret. */
export function noteAtPoint(x: number, y: number, notes: AnchoredNote[], root: HTMLElement): string | null {
  const doc = root.ownerDocument;
  let caret: CaretPos | null = null;
  // caretPositionFromPoint (стандарт/Firefox) и caretRangeFromPoint (WebKit/Blink)
  // отсутствуют в lib.dom-типах jsdom → локальный каст.
  const anyDoc = doc as unknown as {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (anyDoc.caretPositionFromPoint) {
    const p = anyDoc.caretPositionFromPoint(x, y);
    if (p) caret = { node: p.offsetNode, offset: p.offset };
  } else if (anyDoc.caretRangeFromPoint) {
    const r = anyDoc.caretRangeFromPoint(x, y);
    if (r) caret = { node: r.startContainer, offset: r.startOffset };
  }
  if (!caret || !root.contains(caret.node)) return null;
  return noteContainingCaret(caret, notes, root);
}
