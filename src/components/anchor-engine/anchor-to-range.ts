// src/components/anchor-engine/anchor-to-range.ts
import { cssEscape } from "./css-escape";
import { locateOffset } from "./dom-text";
import { boundingBoxOf, rectangleCells } from "./table-grid";
import type { AnchorGeometry, TextAnchor } from "./types";

function leafEl(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-node-id="${cssEscape(id)}"]`);
}
function blockEl(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-block-id="${cssEscape(id)}"]`);
}
function isCell(el: Element | null): boolean {
  return !!el && (el.tagName === "TD" || el.tagName === "TH");
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
  const sLeaf = leafEl(root, a.startNodeId), eLeaf = leafEl(root, a.endNodeId);
  if (!sLeaf || !eLeaf) return null;
  const s = locateOffset(sLeaf, a.startChar), e = locateOffset(eLeaf, a.endChar);
  if (!s || !e) return null;
  const r = root.ownerDocument.createRange();
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r.toString() === a.exact ? r : null;
}

export function rangeFromAnchor(a: TextAnchor, root: HTMLElement): Range | null {
  // Phase 1: table-rectangle (разные ячейки) не поддержан → мягкий орфан.
  // ДОЛГ Phase 2: при включении rectangle добавить проверку «обе ячейки ОДНОЙ
  // таблицы» (одинаковый block_id) — anchors.md правило 4 (contract-MINOR).
  if (a.startNodeId !== a.endNodeId) {
    const sL = leafEl(root, a.startNodeId), eL = leafEl(root, a.endNodeId);
    if (isCell(sL) && isCell(eL)) return null;
  }
  // 1) Быстрый путь: офсеты внутри листа + сверка exact.
  const exact = tryExact(a, root);
  if (exact) return exact;
  // 2) Квота-поиск внутри стартового листа (within-leaf дрейф).
  const sLeaf = leafEl(root, a.startNodeId);
  if (sLeaf) { const r = searchQuote(sLeaf, a); if (r) return r; }
  // 3) Внутри объемлющего блока.
  const sBlock = blockEl(root, a.startBlockId);
  if (sBlock) { const r = searchQuote(sBlock, a); if (r) return r; }
  // 4) Последний резерв — по всему руту. ПРИМЕЧАНИЕ: линейный кросс-лист прозы
  //    (start_node_id != end_node_id, exact спанит границу двух листов) на
  //    быстром пути tryExact обычно НЕ сходится (r.toString() включает текст
  //    между листами) и резолвится именно здесь, по руту.
  return searchQuote(root, a);
}

/**
 * Нормализованный резолв: прямоугольник (две ячейки ОДНОЙ таблицы — правило 4)
 * структурно по node_id; иначе линейный через rangeFromAnchor. Прямоугольный
 * резолв ИГНОРИРУЕТ офсеты/exact (ячейки id-стабильны).
 */
export function resolveAnchor(a: TextAnchor, root: HTMLElement): AnchorGeometry | null {
  if (a.startNodeId !== a.endNodeId) {
    const sL = leafEl(root, a.startNodeId), eL = leafEl(root, a.endNodeId);
    if (isCell(sL) && isCell(eL) && sL && eL) {
      const cells = rectangleCells(sL, eL);
      const bbox = cells ? boundingBoxOf(cells) : null;
      if (!bbox) return null; // разные таблицы / мёртвый угол → орфан
      return { kind: "rect", boundingRect: bbox, clientRects: [bbox] };
    }
  }
  const range = rangeFromAnchor(a, root);
  if (!range) return null;
  // jsdom: Range.getBoundingClientRect/getClientRects ОТСУТСТВУЮТ (есть только у
  // Element; в браузере есть и у Range). Guard — иначе юнит-тест с резолвимым
  // линейным якорем падает с TypeError, а не на ассертах (C1 из ревью). TS-lib
  // типизирует метод как всегда-наличный → no-unnecessary-condition ложно срабатывает
  // на ?./??; guard рантайм-обязателен (jsdom), оставляем.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const boundingRect = range.getBoundingClientRect?.() ?? new DOMRect();
  const clientRects =
    typeof range.getClientRects === "function" ? Array.from(range.getClientRects()) : [];
  return { kind: "range", range, boundingRect, clientRects };
}
