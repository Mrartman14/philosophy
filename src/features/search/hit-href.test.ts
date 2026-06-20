// src/features/search/hit-href.test.ts
import { describe, it, expect } from "vitest";

import { hitHref } from "./hit-href";

describe("hitHref", () => {
  it("document → /documents/{id}", () => {
    expect(hitHref({ type: "document", entity_id: "d1" })).toBe("/documents/d1");
  });
  it("glossary → /glossary/{id}", () => {
    expect(hitHref({ type: "glossary", entity_id: "g1" })).toBe("/glossary/g1");
  });
  it("нет entity_id → null", () => {
    expect(hitHref({ type: "document" })).toBeNull();
  });
  it("неизвестный/отсутствующий тип → null", () => {
    expect(hitHref({ entity_id: "x" })).toBeNull();
  });
});
