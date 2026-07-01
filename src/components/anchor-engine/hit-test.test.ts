import { describe, it, expect, beforeEach } from "vitest";

import { noteAtPointInGeometry } from "./hit-test";
import type { AnchorGeometry } from "./types";

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
