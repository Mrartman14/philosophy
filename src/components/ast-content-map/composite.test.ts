import { describe, it, expect } from "vitest";

import { NODE_MAP, HOLE } from "@/components/ast-content-map";

import { must } from "./test-support";

const KEY = "a".repeat(64); // валидный 64-hex

describe("NODE_MAP — композиты", () => {
  it("code_block → pre>code, dir=ltr, data-language, data-block-id", () => {
    expect(must(NODE_MAP.code_block)({ type: "code_block", attrs: { language: "ts", blockId: "c1" } }))
      .toEqual(["pre", { "data-block-id": "c1", dir: "ltr", "data-language": "ts" }, ["code", {}, HOLE]]);
  });
  it("image → figure>img(+figcaption), БЕЗ data-block-id", () => {
    const spec = must(NODE_MAP.image)({ type: "image", attrs: { storage_key: KEY, alt: "A", caption: "Cap", blockId: "i1" } });
    expect(spec[0]).toBe("figure");
    expect(spec[1]).toEqual({}); // нет data-block-id на image
    const img = spec[2];
    if (!Array.isArray(img)) throw new Error("ожидался <img> spec");
    expect(img[0]).toBe("img");
    const imgAttrs = img[1];
    expect(imgAttrs.src).toContain(KEY);
    expect(imgAttrs.alt).toBe("A");
    expect(imgAttrs.loading).toBe("lazy");
    expect(spec[3]).toEqual(["figcaption", {}, "Cap"]);
  });
  it("image с невалидным key → figure без img", () => {
    const spec = must(NODE_MAP.image)({ type: "image", attrs: { storage_key: "bad", blockId: "i2" } });
    expect(spec).toEqual(["figure", {}]);
  });
  it("table → table>tbody, БЕЗ data-block-id", () => {
    expect(must(NODE_MAP.table)({ type: "table", attrs: { blockId: "tb1" } }))
      .toEqual(["table", {}, ["tbody", {}, HOLE]]);
  });
  it("header-строка → tr data-header", () => {
    expect(must(NODE_MAP.table_row)({ type: "table_row", attrs: { header: true } }))
      .toEqual(["tr", { "data-header": "true" }, HOLE]);
  });
  it("ячейка с align → td data-align", () => {
    expect(must(NODE_MAP.table_cell)({ type: "table_cell", attrs: { align: "center" } }))
      .toEqual(["td", { "data-align": "center" }, HOLE]);
  });
});
