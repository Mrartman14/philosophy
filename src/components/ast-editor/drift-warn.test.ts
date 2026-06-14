import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDriftWarn } from "./drift-warn";
import type { SchemaSnapshot } from "./types";

const baseSnapshot = (nodes: string[], marks: string[]): SchemaSnapshot => ({
  blockLevels: {},
  entityBlockLimits: {},
  entityContexts: {},
  limits: { maxDepth: 32, maxTextLen: 1, maxContentItems: 1, maxMarksPerNode: 1 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(nodes.map((n) => [n, { attrs: {} }])),
  marks: new Map(marks.map((m) => [m, { attrs: {} }])),
  exclusiveCategories: [],
});

describe("useDriftWarn", () => {
  let warnSpy: MockInstance<(...args: unknown[]) => void>;
  // Suppress console.warn during test — warnSpy captures calls for assertions.
  beforeEach(() => { warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { /* suppress */ }); });
  afterEach(() => { warnSpy.mockRestore(); });

  it("warns when runtime schema has a node missing from hardcode", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text", "future_block"],
      ["bold", "italic", "code", "link", "lecture_ref", "glossary_ref", "document_ref", "media_ref", "canvas_ref", "comment_ref"],
    );
    renderHook(() => { useDriftWarn(schema); });
    expect(warnSpy).toHaveBeenCalled();
    const allArgs = warnSpy.mock.calls[0]?.map((a) => JSON.stringify(a)).join(" ") ?? "";
    expect(allArgs).toMatch(/future_block/);
  });

  it("warns when hardcode has a mark missing from runtime", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text"],
      ["bold", "italic"], // missing several
    );
    renderHook(() => { useDriftWarn(schema); });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("no warn when sets match", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text"],
      ["bold", "italic", "code", "link", "lecture_ref", "glossary_ref", "document_ref", "media_ref", "canvas_ref", "comment_ref"],
    );
    renderHook(() => { useDriftWarn(schema); });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
