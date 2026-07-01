import { describe, expect, it } from "vitest";

import {
  anchorScopeAttr,
  anchorScopeSelector,
  formatScopeId,
  nearestScope,
  parseScopeId,
} from "./scope-id";
import { must } from "./test-support";

describe("scope-id", () => {
  it("anchorScopeAttr builds the data-* prop object", () => {
    expect(anchorScopeAttr("comment", "c1")).toEqual({ "data-anchor-scope": "comment:c1" });
  });

  it("anchorScopeSelector строит CSS-селектор тела скоупа и находит его в DOM", () => {
    expect(anchorScopeSelector("comment", "c1")).toBe('[data-anchor-scope="comment:c1"]');
    // Парность anchorScopeAttr ↔ anchorScopeSelector: размеченный элемент находится.
    document.body.innerHTML = '<div data-anchor-scope="comment:c1"></div>';
    expect(document.querySelector(anchorScopeSelector("comment", "c1"))).not.toBeNull();
    document.body.innerHTML = "";
  });

  it("format → parse round-trips", () => {
    const s = { entityType: "comment", entityId: "11111111-2222-3333-4444-555555555555" };
    expect(formatScopeId(s)).toBe("comment:11111111-2222-3333-4444-555555555555");
    expect(parseScopeId(formatScopeId(s))).toEqual(s);
  });

  it("parse rejects empty/malformed", () => {
    expect(parseScopeId(null)).toBeNull();
    expect(parseScopeId("")).toBeNull();
    expect(parseScopeId("nocolon")).toBeNull();
    expect(parseScopeId(":id")).toBeNull();
    expect(parseScopeId("type:")).toBeNull();
  });

  it("parse keeps only the first colon as separator (UUID has none, but be safe)", () => {
    expect(parseScopeId("document:a:b")).toEqual({ entityType: "document", entityId: "a:b" });
  });

  it("nearestScope climbs to the closest [data-anchor-scope]", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="document:doc1"><p data-block-id="b1">hi <span id="t">x</span></p></div>';
    const span = must(document.getElementById("t"));
    const found = nearestScope(span.firstChild); // text node
    expect(found?.scope).toEqual({ entityType: "document", entityId: "doc1" });
    expect(found?.el).toBe(document.querySelector("[data-anchor-scope]"));
  });

  it("nearestScope returns null outside any scope", () => {
    document.body.innerHTML = "<p>orphan</p>";
    expect(nearestScope(document.querySelector("p"))).toBeNull();
  });
});
