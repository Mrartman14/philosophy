import { describe, it, expect } from "vitest";

import { nodeHref } from "./node-route";

describe("nodeHref", () => {
  it("document → /documents/{id}", () => {
    expect(nodeHref("document", "abc")).toBe("/documents/abc");
  });
  it("glossary → /glossary/{id}", () => {
    expect(nodeHref("glossary", "xyz")).toBe("/glossary/xyz");
  });
  it("отсутствующий type (undefined) → null (узел не навигируем)", () => {
    expect(nodeHref(undefined, "id")).toBeNull();
  });
  it("пустой/отсутствующий id → null", () => {
    expect(nodeHref("document", "")).toBeNull();
    expect(nodeHref("document", undefined)).toBeNull();
  });
});
