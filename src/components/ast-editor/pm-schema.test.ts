import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { buildExtensions } from "./extensions";
import { deserialize } from "./deserializer";
import { serialize } from "./serializer";
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

/**
 * Round-trip via the real ProseMirror schema (not just JSON↔JSON). Catches
 * cases where AST → PM-JSON would be rejected by PM's content-model parser
 * (e.g. table_cell content mismatch, node-name camelCase vs snake_case).
 */

const fullSnapshot: SchemaSnapshot = {
  blockLevels: {
    full: ["paragraph", "heading", "blockquote", "code_block", "list", "image", "table", "thematic_break"],
  },
  entityBlockLimits: { full: 20000 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const extensions = buildExtensions({ snapshot: fullSnapshot, context: "document" });
const schema = getSchema(extensions);

const cases: Array<[string, AstBlock]> = [
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

describe("PM-schema round-trip", () => {
  for (const [name, block] of cases) {
    it(`PM accepts and re-emits: ${name}`, () => {
      const pmJson = deserialize([block], fullSnapshot);

      // PM rejects invalid content models — this is the actual schema gate.
      const doc = PMNode.fromJSON(schema, pmJson);
      doc.check();

      // Re-serialize from the PM-validated tree and compare.
      const out = serialize(doc.toJSON());
      expect(out).toHaveLength(1);
      const result = out[0]!;
      expect(result.type).toBe(block.type);
      expect(result.id).toBe(block.id);
      expect(result.attrs ?? {}).toEqual(block.attrs ?? {});
      if (block.content) expect(result.content).toEqual(block.content);
      if (block.type === "code_block") expect(result.text).toBe(block.text);
    });
  }

  it("registers expected node names in PM schema", () => {
    expect(schema.nodes["table"]).toBeDefined();
    expect(schema.nodes["table_row"]).toBeDefined();
    expect(schema.nodes["table_cell"]).toBeDefined();
    expect(schema.nodes["hard_break"]).toBeDefined();
    expect(schema.nodes["thematic_break"]).toBeDefined();
    expect(schema.nodes["list"]).toBeDefined();
    expect(schema.nodes["list_item"]).toBeDefined();
    expect(schema.nodes["code_block"]).toBeDefined();
    // Ensure camelCase defaults didn't leak through.
    expect(schema.nodes["tableRow"]).toBeUndefined();
    expect(schema.nodes["tableCell"]).toBeUndefined();
    expect(schema.nodes["hardBreak"]).toBeUndefined();
    expect(schema.nodes["horizontalRule"]).toBeUndefined();
  });
});
