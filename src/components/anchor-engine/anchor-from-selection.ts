// src/components/anchor-engine/anchor-from-selection.ts
import { blockPlainText, offsetWithinBlock } from "./dom-text";
import { isCell } from "./table-grid";
import type { TextAnchor } from "./types";

function closestAttr(node: Node, root: HTMLElement, attr: string): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const found = el?.closest<HTMLElement>(`[${attr}]`) ?? null;
  return found && root.contains(found) ? found : null;
}

export function anchorFromRange(range: Range, root: HTMLElement, contextLen = 32): TextAnchor | null {
  if (range.collapsed) return null;
  const sLeaf = closestAttr(range.startContainer, root, "data-node-id");
  const eLeaf = closestAttr(range.endContainer, root, "data-node-id");
  if (!sLeaf || !eLeaf) return null;

  const sBlock = closestAttr(range.startContainer, root, "data-block-id");
  const eBlock = closestAttr(range.endContainer, root, "data-block-id");
  if (!sBlock || !eBlock) return null;

  // Правило 4 (контракт): если хоть один конец — ячейка, ОБА обязаны быть
  // ячейками ОДНОЙ таблицы (sBlock === eBlock) → прямоугольник. Иначе (cross-table
  // ячейки ИЛИ ячейка+проза) — не создаём якорь. Линейная проза (ни одной ячейки)
  // — без ограничений.
  if (isCell(sLeaf) || isCell(eLeaf)) {
    const bothCells = isCell(sLeaf) && isCell(eLeaf);
    if (!bothCells || sBlock !== eBlock) return null;
  }

  const startNodeId = sLeaf.getAttribute("data-node-id");
  const endNodeId = eLeaf.getAttribute("data-node-id");
  const startBlockId = sBlock.getAttribute("data-block-id");
  const endBlockId = eBlock.getAttribute("data-block-id");
  if (!startNodeId || !endNodeId || !startBlockId || !endBlockId) return null;

  const startChar = offsetWithinBlock(sLeaf, range.startContainer, range.startOffset);
  const endChar = offsetWithinBlock(eLeaf, range.endContainer, range.endOffset);
  const exact = range.toString();
  if (exact.length === 0) return null;
  const prefix = blockPlainText(sLeaf).slice(Math.max(0, startChar - contextLen), startChar);
  const suffix = blockPlainText(eLeaf).slice(endChar, endChar + contextLen);

  const anchor: TextAnchor = { startBlockId, startNodeId, endBlockId, endNodeId, startChar, endChar, exact };
  if (prefix) anchor.prefix = prefix;
  if (suffix) anchor.suffix = suffix;
  return anchor;
}

export function anchorFromSelection(sel: Selection | null, root: HTMLElement): TextAnchor | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return anchorFromRange(sel.getRangeAt(0), root);
}
