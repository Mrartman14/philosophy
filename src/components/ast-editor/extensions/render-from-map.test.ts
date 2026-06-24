import { describe, it, expect } from "vitest";

import { domSpecFromNode, domSpecFromMark } from "./render-from-map";

describe("EDIT-адаптер render-from-map → DOMOutputSpec", () => {
  it("paragraph → ['p', {data-block-id}, 0]", () => {
    expect(domSpecFromNode("paragraph", { blockId: "b1" })).toEqual([
      "p",
      { "data-block-id": "b1" },
      0,
    ]);
  });

  it("table_cell в редакторе = td (НЕ th), align→data-align", () => {
    expect(domSpecFromNode("table_cell", { align: "center" })).toEqual([
      "td",
      { "data-align": "center" },
      0,
    ]);
  });

  it("неизвестная нода → throw", () => {
    expect(() => domSpecFromNode("__nope__", {})).toThrow(/no NODE_MAP entry/);
  });

  it("link mark → структурная база ['a', {href}] (без content-hole)", () => {
    expect(domSpecFromMark("link", { href: "https://x.io" })).toEqual([
      "a",
      { href: "https://x.io" },
    ]);
  });

  it("link без title — карта НЕ несёт title (накладывается в renderHTML)", () => {
    const base = domSpecFromMark("link", { href: "https://x.io", title: "T" });
    expect(base).toEqual(["a", { href: "https://x.io" }]);
  });

  it("nav-ref (glossary_ref) → ['a', {href, data-mark, class}] (без content-hole)", () => {
    expect(domSpecFromMark("glossary_ref", { id: "g1" })).toEqual([
      "a",
      { href: "/glossary/g1", "data-mark": "glossary_ref", class: "nav-ref nav-ref--glossary_ref" },
    ]);
  });

  it("nav-ref с пустым id → null (редактор делает span-фолбэк)", () => {
    expect(domSpecFromMark("glossary_ref", { id: "" })).toBeNull();
  });

  it("неизвестная mark → null", () => {
    expect(domSpecFromMark("__nope__", {})).toBeNull();
  });
});
