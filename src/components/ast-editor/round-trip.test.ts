import { describe, it, expect } from "vitest";
import { serialize } from "./serializer";
import { deserialize } from "./deserializer";
import {
  fixtureParagraph,
  fixtureHeading,
  fixtureBlockquote,
  fixtureCodeBlock,
  fixtureBulletList,
  fixtureOrderedList,
  fixtureTaskList,
  fixtureImage,
  fixtureThematicBreak,
  fixtureTable,
  fixtureFormattingMarks,
  fixtureLink,
  fixtureNavMarks,
} from "./__fixtures__/sample-blocks";
import type { AstBlock, SchemaSnapshot } from "./types";

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

const cases: [string, AstBlock][] = [
  ["paragraph", fixtureParagraph],
  ["heading", fixtureHeading],
  ["blockquote", fixtureBlockquote],
  ["code_block", fixtureCodeBlock],
  ["bullet list", fixtureBulletList],
  ["ordered list", fixtureOrderedList],
  ["task list", fixtureTaskList],
  ["image", fixtureImage],
  ["thematic_break", fixtureThematicBreak],
  ["table", fixtureTable],
  ["formatting marks", fixtureFormattingMarks],
  ["link mark", fixtureLink],
  ["nav-ref marks", fixtureNavMarks],
];

describe("round-trip serialize ↔ deserialize", () => {
  for (const [name, block] of cases) {
    it(`preserves structure: ${name}`, () => {
      const pm = deserialize([block], fakeSnapshot);
      const out = serialize(pm);
      expect(out).toHaveLength(1);
      const result = out[0];
      if (result === undefined) throw new Error("serialize вернул пустой массив");
      expect(result.position).toBe(0);
      expect(result.type).toBe(block.type);
      expect(result.id).toBe(block.id);
      expect(result.attrs ?? {}).toEqual(block.attrs ?? {});
      if (block.content) {
        expect(result.content).toEqual(block.content);
      }
      if (block.type === "code_block") {
        expect(result.text).toBe(block.text);
      }
    });
  }
});
