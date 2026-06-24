import { describe, it, expect } from "vitest";

import { NODE_MAP, MARK_MAP, HOLE } from "@/components/ast-content-map";
import type { AstNode, AstMark } from "@/components/ast-content-map";

function node(type: keyof typeof NODE_MAP, attrs: Record<string, unknown>) {
  const r = NODE_MAP[type];
  if (!r) throw new Error(`no NODE_MAP entry for ${type}`);
  return r({ type, attrs } as AstNode);
}

function mark(type: keyof typeof MARK_MAP) {
  const r = MARK_MAP[type];
  if (!r) throw new Error(`no MARK_MAP entry for ${type}`);
  return r({ type } as AstMark);
}

describe("NODE_MAP — простые блоки", () => {
  it("blockquote → контейнер с data-block-id", () => {
    expect(node("blockquote", { blockId: "q1" })).toEqual([
      "blockquote",
      { "data-block-id": "q1" },
      HOLE,
    ]);
  });
  it("thematic_break → лист <hr> без HOLE", () => {
    expect(node("thematic_break", { blockId: "t1" })).toEqual(["hr", { "data-block-id": "t1" }]);
  });
  it("ordered list → ol с data-list и start", () => {
    expect(node("list", { ordered: true, start: 3, blockId: "l1" })).toEqual([
      "ol",
      { "data-block-id": "l1", "data-list": "", start: "3" },
      HOLE,
    ]);
  });
  it("bullet list → ul без start", () => {
    expect(node("list", { ordered: false, blockId: "l2" })).toEqual([
      "ul",
      { "data-block-id": "l2", "data-list": "" },
      HOLE,
    ]);
  });
  it("list_item с checked → data-checked", () => {
    expect(node("list_item", { checked: true })).toEqual([
      "li",
      { "data-checked": "true" },
      HOLE,
    ]);
  });
  it("list_item НЕ несёт data-block-id (якорится через объемлющий list-блок)", () => {
    // ast.Node без id; data-block-id живёт на list-блоке, не на пункте (anchors.md).
    expect(node("list_item", { blockId: "li1" })).toEqual(["li", {}, HOLE]);
  });
});

describe("MARK_MAP — простые марки", () => {
  it("italic → em", () => {
    expect(mark("italic")).toEqual(["em", {}]);
  });
  it("code → code dir=ltr", () => {
    expect(mark("code")).toEqual(["code", { dir: "ltr" }]);
  });
});
