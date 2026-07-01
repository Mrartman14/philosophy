import { describe, it, expect, beforeEach } from "vitest";

import { anchorFromRange, anchorFromSelection } from "./anchor-from-selection";
import { must } from "./test-support";

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-ast-root", "");
  // Топ-уровневая проза несёт ОБА id: data-block-id (блок) и data-node-id (лист).
  // Без data-node-id leaf-капчур вернёт null и все старые кейсы упадут.
  root.innerHTML =
    '<p data-block-id="p1" data-node-id="p1">Hello <strong>bold</strong> world</p>' +
    '<p data-block-id="p2" data-node-id="p2">Second paragraph here</p>';
  document.body.appendChild(root);
  return root;
}

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
function selectRange(s: Node, so: number, e: Node, eo: number): Selection {
  const range = document.createRange();
  range.setStart(s, so);
  range.setEnd(e, eo);
  const sel = must(window.getSelection());
  sel.removeAllRanges();
  sel.addRange(range);
  return sel;
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

describe("anchorFromSelection — leaf-капчур + правило 4 (rectangle)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("офсет node-relative внутри ячейки; node_id = ячейка, block_id = таблица", () => {
    const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="cell-1">Hello</td></tr></tbody></table>');
    const t = must(r.querySelector('[data-node-id="cell-1"]')).firstChild as Text;
    const a = anchorFromSelection(selectRange(t, 1, t, 4), r);
    expect(a).toMatchObject({ startNodeId: "cell-1", endNodeId: "cell-1", startBlockId: "tbl-1", startChar: 1, endChar: 4, exact: "ell" });
  });

  it("same-table cross-cell → прямоугольный якорь (оба cell node_id)", () => {
    const r = root('<table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td><td data-node-id="c2">bb</td></tr></tbody></table>');
    const t1 = must(r.querySelector('[data-node-id="c1"]')).firstChild as Text;
    const t2 = must(r.querySelector('[data-node-id="c2"]')).firstChild as Text;
    const a = anchorFromSelection(selectRange(t1, 0, t2, 2), r);
    expect(a).toMatchObject({ startNodeId: "c1", endNodeId: "c2", startBlockId: "t1", endBlockId: "t1" });
  });

  it("cross-table выделение → null", () => {
    const r = root(
      '<table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>' +
      '<table data-block-id="t2"><tbody><tr><td data-node-id="c2">bb</td></tr></tbody></table>',
    );
    const t1 = must(r.querySelector('[data-node-id="c1"]')).firstChild as Text;
    const t2 = must(r.querySelector('[data-node-id="c2"]')).firstChild as Text;
    expect(anchorFromSelection(selectRange(t1, 0, t2, 2), r)).toBeNull();
  });

  it("ячейка + проза (mixed) → null (явный регресс-ассерт)", () => {
    const r = root('<p data-block-id="p0" data-node-id="p0">pre</p><table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>');
    const p = must(r.querySelector('[data-node-id="p0"]')).firstChild as Text;
    const c = must(r.querySelector('[data-node-id="c1"]')).firstChild as Text;
    expect(anchorFromSelection(selectRange(p, 0, c, 2), r)).toBeNull();
  });

  it("линейный кросс-лист прозы (два абзаца) — разрешён", () => {
    const r = root('<p data-block-id="p1" data-node-id="p1">foo</p><p data-block-id="p2" data-node-id="p2">bar</p>');
    const t1 = must(r.querySelector('[data-node-id="p1"]')).firstChild as Text;
    const t2 = must(r.querySelector('[data-node-id="p2"]')).firstChild as Text;
    expect(anchorFromSelection(selectRange(t1, 1, t2, 2), r)).toMatchObject({ startNodeId: "p1", endNodeId: "p2" });
  });
});
