// src/components/annotation-layer/anchor-from-selection.ts
import { blockPlainText, offsetWithinBlock } from "./dom-text";
import type { TextAnchor } from "./types";

function astBlock(node: Node, root: HTMLElement): Element | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const block = el?.closest<HTMLElement>("[data-block-id]") ?? null;
  // AST-субстрат-гард: блок обязан быть внутри переданного AST-рута.
  return block && root.contains(block) ? block : null;
}

export function anchorFromRange(range: Range, root: HTMLElement, contextLen = 32): TextAnchor | null {
  if (range.collapsed) return null;
  const sb = astBlock(range.startContainer, root);
  const eb = astBlock(range.endContainer, root);
  if (!sb || !eb) return null;
  const startId = sb.getAttribute("data-block-id");
  const endId = eb.getAttribute("data-block-id");
  if (!startId || !endId) return null;
  const startChar = offsetWithinBlock(sb, range.startContainer, range.startOffset);
  const endChar = offsetWithinBlock(eb, range.endContainer, range.endOffset);
  const exact = range.toString();
  if (exact.length === 0) return null;
  const prefix = blockPlainText(sb).slice(Math.max(0, startChar - contextLen), startChar);
  const suffix = blockPlainText(eb).slice(endChar, endChar + contextLen);
  const anchor: TextAnchor = { startBlockId: startId, endBlockId: endId, startChar, endChar, exact };
  if (prefix) anchor.prefix = prefix;
  if (suffix) anchor.suffix = suffix;
  return anchor;
}

export function anchorFromSelection(sel: Selection | null, root: HTMLElement): TextAnchor | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return anchorFromRange(sel.getRangeAt(0), root);
}
