import { describe, it, expect } from "vitest";

import { fixtureParagraph, fixtureCodeBlock, fixtureLink } from "./__fixtures__/sample-blocks";
import { deserialize } from "./deserializer";
import type { SchemaSnapshot } from "./types";

const fakeSnapshot: SchemaSnapshot = {
  blockLevels: {},
  entityBlockLimits: {},
  entityContexts: {},
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

describe("deserializer", () => {
  it("paragraph", () => {
    const doc = deserialize([fixtureParagraph], fakeSnapshot);
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [{ type: "text", text: "Привет, мир." }],
        },
      ],
    });
  });

  it("code_block puts Block.Text into text-node content", () => {
    const doc = deserialize([fixtureCodeBlock], fakeSnapshot);
    expect(doc.content?.[0]).toEqual({
      type: "code_block",
      attrs: { blockId: "cb1", language: "go" },
      content: [{ type: "text", text: "func main() {}\n" }],
    });
  });

  it("link mark on text", () => {
    const doc = deserialize([fixtureLink], fakeSnapshot);
    expect(doc.content?.[0]?.content?.[0]?.marks?.[0]).toEqual({
      type: "link",
      attrs: { href: "https://example.com", title: "пример" },
    });
  });

  it("empty input returns empty doc", () => {
    expect(deserialize([], fakeSnapshot)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("deserializeNode: node.id текст-листа → attrs.blockId", () => {
    const blocks = [
      { id: "tbl-1", type: "table" as const, position: 0, content: [
        { type: "table_row" as const, content: [
          { type: "table_cell" as const, id: "cell-1", content: [{ type: "text" as const, text: "x" }] },
        ] },
      ] },
    ];
    const cell = deserialize(blocks).content?.[0]?.content?.[0]?.content?.[0];
    expect(cell?.attrs?.blockId).toBe("cell-1");
  });

  it("deserializeNode: id структурного узла НЕ гидрируется в blockId", () => {
    const blocks = [
      { id: "tbl-1", type: "table" as const, position: 0, content: [
        { type: "table_row" as const, id: "row-x", content: [
          { type: "table_cell" as const, id: "cell-1", content: [{ type: "text" as const, text: "x" }] },
        ] },
      ] },
    ];
    const row = deserialize(blocks).content?.[0]?.content?.[0];
    expect(row?.attrs?.blockId).toBeUndefined();
  });
});
