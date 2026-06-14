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
});
