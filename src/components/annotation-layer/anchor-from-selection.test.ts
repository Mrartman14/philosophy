import { describe, it, expect, beforeEach } from "vitest";

import { anchorFromRange } from "./anchor-from-selection";
import { must } from "./test-support";

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-ast-root", "");
  root.innerHTML =
    '<p data-block-id="p1">Hello <strong>bold</strong> world</p>' +
    '<p data-block-id="p2">Second paragraph here</p>';
  document.body.appendChild(root);
  return root;
}

describe("anchorFromRange", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("одно-блочное выделение", () => {
    const root = setup();
    const strong = must(must(root.querySelector("strong")).firstChild);
    const r = document.createRange();
    r.setStart(strong, 0); r.setEnd(strong, 4);
    const a = must(anchorFromRange(r, root));
    expect(a.startBlockId).toBe("p1");
    expect(a.startChar).toBe(6); expect(a.endChar).toBe(10);
    expect(a.exact).toBe("bold");
    expect(a.prefix).toBe("Hello "); expect(a.suffix).toBe(" world");
  });
  it("кросс-блочное", () => {
    const root = setup();
    const r = document.createRange();
    r.setStart(must(must(root.querySelector('[data-block-id="p1"]')).firstChild), 0);
    r.setEnd(must(must(root.querySelector('[data-block-id="p2"]')).firstChild), 6);
    const a = must(anchorFromRange(r, root));
    expect(a.startBlockId).toBe("p1"); expect(a.endBlockId).toBe("p2");
  });
  it("collapsed → null", () => {
    const root = setup();
    const r = document.createRange();
    r.setStart(must(must(root.querySelector('[data-block-id="p1"]')).firstChild), 2);
    r.setEnd(must(must(root.querySelector('[data-block-id="p1"]')).firstChild), 2);
    expect(anchorFromRange(r, root)).toBeNull();
  });
  it("AST-гард: одна граница ВНЕ рута → null", () => {
    const root = setup();
    const outside = document.createElement("p");
    outside.textContent = "sidebar card";
    document.body.appendChild(outside);
    const r = document.createRange();
    r.setStart(must(must(root.querySelector('[data-block-id="p1"]')).firstChild), 0);
    r.setEnd(must(outside.firstChild), 4);
    expect(anchorFromRange(r, root)).toBeNull();
  });
  it("AST-гард: текст без data-block-id → null", () => {
    setup();
    const noId = document.createElement("div");
    noId.setAttribute("data-ast-root", "");
    noId.innerHTML = "<p>no block id</p>";
    document.body.appendChild(noId);
    const r = document.createRange();
    r.selectNodeContents(must(noId.querySelector("p")));
    expect(anchorFromRange(r, noId)).toBeNull();
  });
});
