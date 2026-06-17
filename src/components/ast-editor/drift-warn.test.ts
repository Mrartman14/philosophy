import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";

vi.mock("@/services/observability/client", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { log } from "@/services/observability/client";

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
  // warnSpy suppresses console.warn noise; assertions use logWarn (the facade).
  let warnSpy: MockInstance<(...args: unknown[]) => void>;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const logWarn = vi.mocked(log).warn;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { /* suppress */ });
    logWarn.mockClear();
  });
  afterEach(() => { warnSpy.mockRestore(); });

  it("warns when runtime schema has a node missing from hardcode", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text", "future_block"],
      ["bold", "italic", "code", "link", "lecture_ref", "glossary_ref", "document_ref", "media_ref", "canvas_ref", "comment_ref"],
    );
    renderHook(() => { useDriftWarn(schema); });
    expect(logWarn).toHaveBeenCalled();
    const call = logWarn.mock.calls[0];
    const allArgs = (call ?? []).map((a) => JSON.stringify(a)).join(" ");
    expect(allArgs).toMatch(/future_block/);
  });

  it("warns when hardcode has a mark missing from runtime", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text"],
      ["bold", "italic"], // missing several
    );
    renderHook(() => { useDriftWarn(schema); });
    expect(logWarn).toHaveBeenCalled();
  });

  it("no warn when sets match", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text"],
      ["bold", "italic", "code", "link", "lecture_ref", "glossary_ref", "document_ref", "media_ref", "canvas_ref", "comment_ref"],
    );
    renderHook(() => { useDriftWarn(schema); });
    expect(logWarn).not.toHaveBeenCalled();
  });
});
