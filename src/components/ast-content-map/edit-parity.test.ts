import { describe, it, expect } from "vitest";

import { NODE_MAP, MARK_MAP, HOLE } from "./index";

// Эмуляция вызова из editor renderHTML: PM-нода даёт {type:{name}, attrs}. EDIT-адаптер
// построит pseudo-AstNode {type:name, attrs} и вернёт NODE_MAP(...) как DOMOutputSpec.
function renderHTMLViaMap(name: string, attrs: Record<string, unknown>) {
  const r = NODE_MAP[name as keyof typeof NODE_MAP];
  if (!r) throw new Error(`no map entry for ${name}`);
  return r({ type: name, attrs } as never);
}

describe("EDIT-адаптер: NODE_MAP → DOMOutputSpec без Tiptap-типов", () => {
  it("paragraph → ['p', {data-block-id}, 0]", () => {
    expect(renderHTMLViaMap("paragraph", { blockId: "b1" })).toEqual(["p", { "data-block-id": "b1" }, 0]);
  });

  it("heading уважает level", () => {
    expect(renderHTMLViaMap("heading", { level: 3, blockId: "h1" })).toEqual([
      "h3",
      { "data-block-id": "h1" },
      0,
    ]);
  });

  it("HOLE === 0 (контракт DOMOutputSpec content-hole)", () => {
    expect(HOLE).toBe(0);
  });

  it("glossary_ref mark → ['a', {...}] (структура для оборачивания)", () => {
    expect(MARK_MAP.glossary_ref!({ type: "glossary_ref", attrs: { id: "g1" } })).toEqual([
      "a",
      { href: "/glossary/g1", "data-mark": "glossary_ref", class: "nav-ref nav-ref--glossary_ref" },
    ]);
  });
});
