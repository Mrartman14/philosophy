import { describe, it, expect } from "vitest";

import { REF_TYPES } from "./ref-types";

describe("REF_TYPES", () => {
  it("4 категории в порядке glossary/document/media/comment", () => {
    expect(REF_TYPES.map((r) => r.id)).toEqual(["glossary", "document", "media", "comment"]);
  });
  it("марки соответствуют ast.MarkType", () => {
    expect(REF_TYPES.map((r) => r.mark)).toEqual([
      "glossary_ref", "document_ref", "media_ref", "comment_ref",
    ]);
  });
  it("только comment имеет parent-scope (lecture), остальные global", () => {
    const byId = Object.fromEntries(REF_TYPES.map((r) => [r.id, r.scope.kind]));
    expect(byId).toEqual({ glossary: "global", document: "global", media: "global", comment: "parent" });
  });
});
