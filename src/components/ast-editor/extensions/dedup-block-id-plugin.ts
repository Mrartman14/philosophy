import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const dedupBlockIdKey = new PluginKey("ast-editor-dedup-block-id");

/**
 * Soft post-fix for split/copy-paste cases where Tiptap clones blockId onto
 * a new top-level node. Backend invariant: Block.id is unique within a
 * document. We scan top-level blocks; on duplicate blockId, clear it on all
 * but the FIRST occurrence (lowest position = original survivor of split,
 * insertion-side gets re-assigned by backend on save).
 *
 * Walks only `doc.children` — nested Nodes (list_item, table_row, …) don't
 * carry blockId.
 */
export function createDedupBlockIdPlugin() {
  return new Plugin({
    key: dedupBlockIdKey,
    appendTransaction(_trs, _oldState, newState) {
      const seen = new Set<string>();
      const toClear: { pos: number; node: PMNode }[] = [];
      newState.doc.forEach((node, pos) => {
        const id = node.attrs.blockId as unknown;
        if (typeof id !== "string" || id === "") return;
        if (seen.has(id)) {
          toClear.push({ pos, node });
        } else {
          seen.add(id);
        }
      });
      if (toClear.length === 0) return null;
      const tr = newState.tr;
      for (const { pos, node } of toClear) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: "" });
      }
      return tr.setMeta("addToHistory", false);
    },
  });
}
