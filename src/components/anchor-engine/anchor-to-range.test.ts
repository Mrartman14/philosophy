import { describe, it, expect, beforeEach } from "vitest";

import { anchorFromSelection } from "./anchor-from-selection";
import { rangeFromAnchor, resolveAnchor } from "./anchor-to-range";
import { must } from "./test-support";
import type { TextAnchor } from "./types";

function setup(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe("rangeFromAnchor", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("точный путь block_id+char", () => {
    const root = setup('<p data-block-id="p1" data-node-id="p1">Hello bold world</p>');
    const a: TextAnchor = { startBlockId: "p1", startNodeId: "p1", endBlockId: "p1", endNodeId: "p1", startChar: 6, endChar: 10, exact: "bold" };
    const r = rangeFromAnchor(a, root);
    expect(r?.toString()).toBe("bold");
  });
  it("фолбэк по цитате при переименованном блоке", () => {
    const root = setup('<p data-block-id="X">Hello bold world</p>');
    const a: TextAnchor = { startBlockId: "p1", startNodeId: "p1", endBlockId: "p1", endNodeId: "p1", startChar: 6, endChar: 10, exact: "bold", prefix: "Hello ", suffix: " world" };
    const r = rangeFromAnchor(a, root);
    expect(r?.toString()).toBe("bold");
  });
  it("дизамбигуация дубликатов через контекст (берёт ВТОРОЙ 'кант')", () => {
    const root = setup('<p data-block-id="X">кант тут и кант там — второй кант важен</p>');
    // целимся во ВТОРОЙ 'кант' (после "и "): prefix "и ", suffix " там"
    const a: TextAnchor = { startBlockId: "p1", startNodeId: "p1", endBlockId: "p1", endNodeId: "p1", startChar: 0, endChar: 4, exact: "кант", prefix: "и ", suffix: " там" };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r?.toString()).toBe("кант");
    // проверяем, что это именно второе вхождение: не первое (offset 0).
    expect(r?.startOffset).toBeGreaterThan(5);
  });
  it("дизамбигуация по блоку: дубль exact в разных блоках → берёт из start-блока", () => {
    const root = setup('<p data-block-id="p1">кант здесь</p><p data-block-id="p2">и кант там</p>');
    // tryExact провалится (char 0..4 в p2 = "и ка" ≠ "кант") → block-scoped поиск в p2.
    const a: TextAnchor = { startBlockId: "p2", startNodeId: "p2", endBlockId: "p2", endNodeId: "p2", startChar: 0, endChar: 4, exact: "кант" };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r?.toString()).toBe("кант");
    const p2 = root.querySelector('[data-block-id="p2"]');
    expect(p2 && r ? p2.contains(r.startContainer) : false).toBe(true);
  });
  it("сирота → null", () => {
    const root = setup('<p data-block-id="p1">Totally different</p>');
    const a: TextAnchor = { startBlockId: "p1", startNodeId: "p1", endBlockId: "p1", endNodeId: "p1", startChar: 0, endChar: 4, exact: "zzzz" };
    expect(rangeFromAnchor(a, root)).toBeNull();
  });
  it("спецсимволы в block_id не роняют (CSS.escape guard)", () => {
    const root = setup('<p data-block-id="a.b:c" data-node-id="a.b:c">text here</p>');
    const a: TextAnchor = { startBlockId: "a.b:c", startNodeId: "a.b:c", endBlockId: "a.b:c", endNodeId: "a.b:c", startChar: 0, endChar: 4, exact: "text" };
    const r = rangeFromAnchor(a, root);
    expect(r?.toString()).toBe("text");
  });

  // --- Task 6: резолв по листу (node_id) ---

  it("within-leaf: резолв офсетов внутри ячейки по node_id", () => {
    const root = setup('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">Hello</td></tr></tbody></table>');
    const a: TextAnchor = { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c1", startChar: 1, endChar: 4, exact: "ell" };
    expect(rangeFromAnchor(a, root)?.toString()).toBe("ell");
  });

  it("table-rectangle (две разные ячейки) → null", () => {
    const root = setup('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">aa</td><td data-node-id="c2">bb</td></tr></tbody></table>');
    const a: TextAnchor = { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" };
    expect(rangeFromAnchor(a, root)).toBeNull();
  });

  // ИНТЕГРАЦИЯ (M1): капчур → резолв на одном руте.
  // Таблица с ДВУМЯ ячейками: c0 "XXXX" ПЕРЕД целевой c1. Текст блока,
  // склеенный по таблице, = "XXXXHello world" ≠ текст листа "Hello world",
  // поэтому лист-относительный и блок-относительный офсеты РАСХОДЯТСЯ.
  // Капчур "world" внутри c1 даёт startChar 6 (лист-относительный). Резолв
  // тоже лист-относительный → "world". Если бы резолв был блок-относительным,
  // startChar 6 в "XXXXHello world" попал бы в "ello "/c0 — assert упал бы.
  it("round-trip within-cell: лист-относительные офсеты (вторая ячейка перед целевой)", () => {
    const root = setup('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c0">XXXX</td><td data-node-id="c1">Hello world</td></tr></tbody></table>');
    const t = must(root.querySelector('[data-node-id="c1"]')).firstChild as Text;
    const range = document.createRange();
    range.setStart(t, 6);
    range.setEnd(t, 11);
    const sel = must(window.getSelection());
    sel.removeAllRanges();
    sel.addRange(range);
    const a = must(anchorFromSelection(sel, root));
    expect(a.exact).toBe("world");
    expect(a.startChar).toBe(6); // лист-относительный (а не 10 = блок-относительный в "XXXXHello world")
    expect(rangeFromAnchor(a, root)?.toString()).toBe("world");
  });

  // Резолв линейной КРОСС-ЛИСТ прозы (start_node_id != end_node_id, оба НЕ ячейки):
  // rectangle-гард НЕ должен срабатывать (он нулит только когда ОБА конца — TD/TH).
  // Проза резолвится фолбэком searchQuote по руту.
  it("кросс-лист проза (два абзаца) резолвится — rectangle-гард не over-fire", () => {
    const root = setup('<p data-block-id="p1" data-node-id="p1">foo</p><p data-block-id="p2" data-node-id="p2">bar</p>');
    const a: TextAnchor = { startBlockId: "p1", startNodeId: "p1", endBlockId: "p2", endNodeId: "p2", startChar: 0, endChar: 3, exact: "foobar" };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r?.toString()).toBe("foobar");
  });
});

describe("resolveAnchor", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("две ячейки одной таблицы → kind:rect", () => {
    const r = setup(
      '<table data-block-id="t1"><tbody><tr>' +
      '<td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td>' +
      '</tr></tbody></table>',
    );
    must(r.querySelector("#c1")).getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    must(r.querySelector("#c2")).getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
    const g = resolveAnchor(
      { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" },
      r,
    );
    expect(g?.kind).toBe("rect");
    expect(g?.clientRects.length).toBe(1);
  });

  it("мёртвый угол (node_id нет) → null", () => {
    const r = setup('<table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>');
    const g = resolveAnchor(
      { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "GONE", startChar: 0, endChar: 2, exact: "aabb" },
      r,
    );
    expect(g).toBeNull();
  });

  it("линейный within-leaf → kind:range", () => {
    const r = setup('<p data-block-id="p1" data-node-id="p1">Hello</p>');
    const g = resolveAnchor(
      { startBlockId: "p1", endBlockId: "p1", startNodeId: "p1", endNodeId: "p1", startChar: 1, endChar: 4, exact: "ell" },
      r,
    );
    expect(g?.kind).toBe("range");
  });

  // Сквозной capture→resolve round-trip для прямоугольника (две ячейки):
  // зависит от капчур-послабления правила 4 в anchor-from-selection.ts (Task 3).
  it("round-trip rect: anchorFromSelection(2 ячейки) → resolveAnchor kind:rect", () => {
    const r = setup('<table data-block-id="t1"><tbody><tr><td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td></tr></tbody></table>');
    must(r.querySelector("#c1")).getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
    must(r.querySelector("#c2")).getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
    const t1 = must(r.querySelector("#c1")).firstChild as Text;
    const t2 = must(r.querySelector("#c2")).firstChild as Text;
    const range = document.createRange();
    range.setStart(t1, 0); range.setEnd(t2, 2);
    const sel = must(window.getSelection());
    sel.removeAllRanges(); sel.addRange(range);
    const a = anchorFromSelection(sel, r);
    expect(a).toMatchObject({ startNodeId: "c1", endNodeId: "c2" });
    const g = a ? resolveAnchor(a, r) : null;
    expect(g?.kind).toBe("rect");
  });
});
