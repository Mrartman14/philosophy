import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import type { SchemaSnapshot } from "../types";

export const limitsPluginKey = new PluginKey("ast-editor-limits");

export function createLimitsPlugin(snapshot: SchemaSnapshot, contextLevel: string) {
  const { limits, entityBlockLimits } = snapshot;
  const blockCap = entityBlockLimits[contextLevel] ?? Number.MAX_SAFE_INTEGER;

  return new Plugin({
    key: limitsPluginKey,
    filterTransaction(tr) {
      if (!tr.docChanged) return true;
      const newDoc = tr.doc;

      if (newDoc.childCount > blockCap) return false;

      let ok = true;
      newDoc.descendants((node) => {
        if (!ok) return false;
        if (node.isText && node.text != null && node.text.length > limits.maxTextLen) {
          ok = false;
          return false;
        }
        if (node.marks.length > limits.maxMarksPerNode) {
          ok = false;
          return false;
        }
        if (node.childCount > limits.maxContentItems) {
          ok = false;
          return false;
        }
        return true;
      });
      if (!ok) return false;

      if (treeDepth(newDoc) > limits.maxDepth) return false;
      return true;
    },
  });
}

function treeDepth(node: PMNode, current = 0): number {
  if (node.childCount === 0) return current;
  let max = current;
  for (let i = 0; i < node.childCount; i++) {
    max = Math.max(max, treeDepth(node.child(i), current + 1));
  }
  return max;
}
