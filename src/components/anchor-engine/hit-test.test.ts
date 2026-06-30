import { describe, it, expect, beforeEach } from "vitest";

import { noteContainingCaret } from "./hit-test";
import { must } from "./test-support";
import type { AnchoredNote } from "./types";

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
