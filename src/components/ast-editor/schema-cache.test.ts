import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSchema, __resetSchemaCache } from "./schema-cache";

describe("schema-cache", () => {
  beforeEach(() => {
    __resetSchemaCache();
    vi.restoreAllMocks();
  });

  it("returns same promise on repeated calls", () => {
    const fetcher = vi.fn().mockResolvedValue({
      block_levels: {}, entity_block_limits: {}, entity_contexts: {},
      limits: { max_depth: 32, max_text_len: 100, max_content_items: 10, max_marks_per_node: 5 },
      url_policy: { dangerous_schemes: [] },
      nodes: [], elements: [], exclusive_categories: [],
    });
    const a = loadSchema(fetcher);
    const b = loadSchema(fetcher);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("normalizes nodes and marks into Maps", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      block_levels: { full: ["paragraph"] },
      entity_block_limits: { document: 20000 },
      entity_contexts: { document: "full" },
      limits: { max_depth: 32, max_text_len: 100, max_content_items: 10, max_marks_per_node: 5 },
      url_policy: { dangerous_schemes: ["javascript"] },
      nodes: [{ type: "paragraph", content: ["text"], marks: ["bold"], leaf: false }],
      elements: [{ name: "bold", category: "formatting" }],
      exclusive_categories: ["navigation"],
    });
    const snap = await loadSchema(fetcher);
    expect(snap.nodes.get("paragraph")?.content).toEqual(["text"]);
    expect(snap.marks.get("bold")?.category).toBe("formatting");
    expect(snap.limits.maxTextLen).toBe(100);
    expect(snap.urlPolicy.dangerousSchemes).toEqual(["javascript"]);
  });

  it("resets cache via __resetSchemaCache", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      block_levels: {}, entity_block_limits: {}, entity_contexts: {},
      limits: { max_depth: 32, max_text_len: 100, max_content_items: 10, max_marks_per_node: 5 },
      url_policy: { dangerous_schemes: [] },
      nodes: [], elements: [], exclusive_categories: [],
    });
    await loadSchema(fetcher);
    __resetSchemaCache();
    await loadSchema(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
