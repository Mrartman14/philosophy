import { describe, it, expect, beforeEach } from "vitest";

import { rangeFromAnchor } from "./anchor-to-range";
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
    const root = setup('<p data-block-id="p1">Hello bold world</p>');
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 6, endChar: 10, exact: "bold" };
    const r = rangeFromAnchor(a, root);
    expect(r?.toString()).toBe("bold");
  });
  it("фолбэк по цитате при переименованном блоке", () => {
    const root = setup('<p data-block-id="X">Hello bold world</p>');
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 6, endChar: 10, exact: "bold", prefix: "Hello ", suffix: " world" };
    const r = rangeFromAnchor(a, root);
    expect(r?.toString()).toBe("bold");
  });
  it("дизамбигуация дубликатов через контекст (берёт ВТОРОЙ 'кант')", () => {
    const root = setup('<p data-block-id="X">кант тут и кант там — второй кант важен</p>');
    // целимся во ВТОРОЙ 'кант' (после "и "): prefix "и ", suffix " там"
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 0, endChar: 4, exact: "кант", prefix: "и ", suffix: " там" };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r?.toString()).toBe("кант");
    // проверяем, что это именно второе вхождение: не первое (offset 0).
    expect(r?.startOffset).toBeGreaterThan(5);
  });
  it("дизамбигуация по блоку: дубль exact в разных блоках → берёт из start-блока", () => {
    const root = setup('<p data-block-id="p1">кант здесь</p><p data-block-id="p2">и кант там</p>');
    // tryExact провалится (char 0..4 в p2 = "и ка" ≠ "кант") → block-scoped поиск в p2.
    const a: TextAnchor = { startBlockId: "p2", endBlockId: "p2", startChar: 0, endChar: 4, exact: "кант" };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r?.toString()).toBe("кант");
    const p2 = root.querySelector('[data-block-id="p2"]');
    expect(p2 && r ? p2.contains(r.startContainer) : false).toBe(true);
  });
  it("сирота → null", () => {
    const root = setup('<p data-block-id="p1">Totally different</p>');
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 0, endChar: 4, exact: "zzzz" };
    expect(rangeFromAnchor(a, root)).toBeNull();
  });
  it("спецсимволы в block_id не роняют (CSS.escape guard)", () => {
    const root = setup('<p data-block-id="a.b:c">text here</p>');
    const a: TextAnchor = { startBlockId: "a.b:c", endBlockId: "a.b:c", startChar: 0, endChar: 4, exact: "text" };
    const r = rangeFromAnchor(a, root);
    expect(r?.toString()).toBe("text");
  });
});
