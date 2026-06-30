import { describe, it, expect, beforeEach } from "vitest";

import { noteContainingCaret, noteAtPointInGeometry } from "./hit-test";
import { must } from "./test-support";
import type { AnchoredNote, AnchorGeometry } from "./types";

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = '<p data-block-id="p1">alpha beta gamma</p>';
  document.body.appendChild(root);
  return root;
}

describe("noteContainingCaret", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("возвращает note, чей range накрывает caret", () => {
    const root = setup();
    const notes: AnchoredNote[] = [
      { id: "n1", anchor: { startBlockId: "p1", startNodeId: "p1", endBlockId: "p1", endNodeId: "p1", startChar: 6, endChar: 10, exact: "beta" } },
    ];
    const textNode = must(must(root.querySelector("p")).firstChild) as Text;
    // caret в середине "beta" (offset 8)
    expect(noteContainingCaret({ node: textNode, offset: 8 }, notes, root)).toBe("n1");
    // caret в "alpha" (offset 2) — вне beta
    expect(noteContainingCaret({ node: textNode, offset: 2 }, notes, root)).toBeNull();
  });
});

describe("noteAtPointInGeometry", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("точка внутри rect-bbox → id ноты, вне → null", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const geometries = new Map<string, AnchorGeometry | null>([
      ["n1", { kind: "rect", boundingRect: new DOMRect(0, 0, 100, 50), clientRects: [new DOMRect(0, 0, 100, 50)] }],
    ]);
    expect(noteAtPointInGeometry(10, 10, geometries, root)).toBe("n1");
    expect(noteAtPointInGeometry(200, 200, geometries, root)).toBeNull();
  });
});
