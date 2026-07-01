import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { noteAtPointInGeometry } from "./hit-test";
import type { AnchorGeometry } from "./types";

// range-geometry обёртка: hit-test читает лишь g.range (bbox/rects не консультируются).
const wrapRange = (r: Range): AnchorGeometry => ({
  kind: "range",
  range: r,
  boundingRect: new DOMRect(),
  clientRects: [],
});

// caret-резолв в jsdom отсутствует (нет caretPositionFromPoint/caretRangeFromPoint);
// hit-test.caretFromPoint кастует document и вызывает их → стабим caretRangeFromPoint
// (WebKit/Blink-ветка) коллапсированным range в заданной точке текста.
function stubCaret(node: Node, offset: number) {
  const caretRange = document.createRange();
  caretRange.setStart(node, offset);
  caretRange.collapse(true);
  (document as unknown as { caretRangeFromPoint: (x: number, y: number) => Range | null }).caretRangeFromPoint =
    () => caretRange;
}

describe("noteAtPointInGeometry", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "caretRangeFromPoint");
  });

  it("точка внутри rect-bbox → id ноты, вне → null", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const geometries = new Map<string, AnchorGeometry | null>([
      ["n1", { kind: "rect", boundingRect: new DOMRect(0, 0, 100, 50), clientRects: [new DOMRect(0, 0, 100, 50)] }],
    ]);
    expect(noteAtPointInGeometry(10, 10, geometries, root)).toBe("n1");
    expect(noteAtPointInGeometry(200, 200, geometries, root)).toBeNull();
  });

  it("range-ветка: caret ВНУТРИ range (comparePoint===0) → id ноты, ВНЕ → null", () => {
    // Реальный DOM в руте: caretFromPoint требует root.contains(caret.node).
    const root = document.createElement("div");
    const p = document.createElement("p");
    const textNode = document.createTextNode("alpha beta gamma");
    p.appendChild(textNode);
    root.appendChild(p);
    document.body.appendChild(root);

    // range, накрывающий "beta" (offset 6..10) — реальный Range.comparePoint.
    const r = document.createRange();
    r.setStart(textNode, 6);
    r.setEnd(textNode, 10);
    const geometries = new Map<string, AnchorGeometry | null>([["n1", wrapRange(r)]]);

    // caret в середине "beta" (offset 8) → внутри range → comparePoint === 0.
    stubCaret(textNode, 8);
    expect(noteAtPointInGeometry(1, 1, geometries, root)).toBe("n1");

    // caret в "alpha" (offset 2) → вне range → comparePoint !== 0 → null.
    stubCaret(textNode, 2);
    expect(noteAtPointInGeometry(1, 1, geometries, root)).toBeNull();
  });
});
