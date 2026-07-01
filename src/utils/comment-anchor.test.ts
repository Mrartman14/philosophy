// src/utils/comment-anchor.test.ts
import { describe, expect, it } from "vitest";

import { commentHash, commentIdFromHash, commentNodeId } from "./comment-anchor";

describe("comment-anchor — SOT DOM-контракта якоря", () => {
  it("commentNodeId → comment-<id>", () => {
    expect(commentNodeId("abc")).toBe("comment-abc");
  });

  it("commentHash → #comment-<id>", () => {
    expect(commentHash("abc")).toBe("#comment-abc");
  });

  it("commentIdFromHash round-trips commentHash", () => {
    expect(commentIdFromHash(commentHash("xyz"))).toBe("xyz");
  });

  it("commentIdFromHash: чужой/пустой фрагмент → null", () => {
    expect(commentIdFromHash("#section-1")).toBeNull();
    expect(commentIdFromHash("")).toBeNull();
  });

  it("commentIdFromHash: пустой id после префикса → null", () => {
    expect(commentIdFromHash("#comment-")).toBeNull();
  });
});
