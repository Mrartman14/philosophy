// src/components/anchor-engine/anchor-to-range.ts
import { cssEscape } from "./css-escape";
import { locateOffset } from "./dom-text";
import type { TextAnchor } from "./types";

function block(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-block-id="${cssEscape(id)}"]`);
}

// Один SHOW_TEXT-walker по scope: возвращает текстовые узлы с их глобальным офсетом
// и конкатенированный full. Строится один раз в searchQuote и переиспользуется rangeAt.
function textIndex(scope: Element): { nodes: { node: Text; start: number }[]; full: string } {
  const walker = scope.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let full = "";
  let n = walker.nextNode() as Text | null;
  while (n) { nodes.push({ node: n, start: full.length }); full += n.textContent; n = walker.nextNode() as Text | null; }
  return { nodes, full };
}

function rangeAt(
  scope: Element,
  index: { nodes: { node: Text; start: number }[] },
  globalStart: number,
  length: number,
): Range | null {
  const locate = (g: number) => {
    for (let i = index.nodes.length - 1; i >= 0; i--) {
      const item = index.nodes[i];
      if (item && g >= item.start) return { node: item.node, offset: g - item.start };
    }
    return null;
  };
  const s = locate(globalStart), e = locate(globalStart + length);
  if (!s || !e) return null;
  const r = scope.ownerDocument.createRange();
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r;
}

// Квота-поиск exact (дизамбигуация по prefix/suffix) ВНУТРИ scope.
function searchQuote(scope: Element, a: TextAnchor): Range | null {
  const index = textIndex(scope);
  const full = index.full;
  const withCtx = `${a.prefix ?? ""}${a.exact}${a.suffix ?? ""}`;
  if (withCtx !== a.exact) {
    const ctxAt = full.indexOf(withCtx);
    if (ctxAt >= 0) return rangeAt(scope, index, ctxAt + (a.prefix?.length ?? 0), a.exact.length);
  }
  const at = full.indexOf(a.exact);
  return at >= 0 ? rangeAt(scope, index, at, a.exact.length) : null;
}

function tryExact(a: TextAnchor, root: HTMLElement): Range | null {
  const sb = block(root, a.startBlockId), eb = block(root, a.endBlockId);
  if (!sb || !eb) return null;
  const s = locateOffset(sb, a.startChar), e = locateOffset(eb, a.endChar);
  if (!s || !e) return null;
  const r = root.ownerDocument.createRange();
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r.toString() === a.exact ? r : null;
}

export function rangeFromAnchor(a: TextAnchor, root: HTMLElement): Range | null {
  // 1) Быстрый путь: офсеты block_id+char, сверка с exact (authoritative).
  const exact = tryExact(a, root);
  if (exact) return exact;
  // 2) Дрейф: блок гарантированно жив (бэк отвечает 409 BLOCKS_HAVE_ANCHORS на
  //    удаление запинённого блока) → ищем цитату ВНУТРИ того же блока — точнее
  //    дизамбигуация дубликатов, чем поиск по всему документу.
  const startBlock = block(root, a.startBlockId);
  if (startBlock) { const r = searchQuote(startBlock, a); if (r) return r; }
  // 3) Последний резерв: квота-поиск по всему руту.
  return searchQuote(root, a);
}
