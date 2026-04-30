import type { SchemaResponse, SchemaSnapshot, ExportedNode, ExportedElement } from "./types";

let cached: Promise<SchemaSnapshot> | null = null;

export function loadSchema(
  fetcher: () => Promise<SchemaResponse>,
): Promise<SchemaSnapshot> {
  if (!cached) {
    cached = fetcher().then(normalize).catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function __resetSchemaCache(): void {
  cached = null;
}

function normalize(resp: SchemaResponse): SchemaSnapshot {
  const nodes = new Map<string, ExportedNode>();
  for (const n of resp.nodes ?? []) {
    if (n.type) nodes.set(n.type, n);
  }
  const marks = new Map<string, ExportedElement>();
  for (const e of resp.elements ?? []) {
    if (e.name) marks.set(e.name, e);
  }
  return {
    blockLevels: resp.block_levels ?? {},
    entityBlockLimits: resp.entity_block_limits ?? {},
    entityContexts: resp.entity_contexts ?? {},
    limits: {
      maxDepth: resp.limits?.max_depth ?? 32,
      maxTextLen: resp.limits?.max_text_len ?? 1_000_000,
      maxContentItems: resp.limits?.max_content_items ?? 10_000,
      maxMarksPerNode: resp.limits?.max_marks_per_node ?? 100,
    },
    urlPolicy: {
      dangerousSchemes: resp.url_policy?.dangerous_schemes ?? [],
    },
    nodes,
    marks,
    exclusiveCategories: resp.exclusive_categories ?? [],
  };
}
