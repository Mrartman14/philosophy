import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const dedupBlockIdKey = new PluginKey("ast-editor-dedup-block-id");

/**
 * Soft post-fix для split/copy-paste, где Tiptap клонирует id на новый узел.
 * Инвариант бэка: id (block И node) уникален в документе. Обходим ВСЕ узлы
 * (descendants), а не только top-level: id несут и вложенные текстовые листы
 * (table_cell, абзацы списков/цитат). На дубле чистим все вхождения кроме
 * ПЕРВОГО (document-order) — insertion-side получит новый id от бэка на save.
 */
export function createDedupBlockIdPlugin() {
  return new Plugin({
    key: dedupBlockIdKey,
    appendTransaction(_trs, _oldState, newState) {
      const seen = new Set<string>();
      const toClear: number[] = [];
      newState.doc.descendants((node: PMNode, pos: number) => {
        const id = node.attrs.blockId as unknown;
        if (typeof id !== "string" || id === "") return;
        if (seen.has(id)) toClear.push(pos);
        else seen.add(id);
      });
      if (toClear.length === 0) return null;
      const tr = newState.tr;
      for (const pos of toClear) {
        const node = newState.doc.nodeAt(pos);
        if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: "" });
      }
      return tr.setMeta("addToHistory", false);
    },
  });
}
