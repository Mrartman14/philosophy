// src/features/canvas/editor/hit-test.ts
// Чистый хит-тест сцены редактора: что под мировой точкой p. Без React/DOM —
// заменяет браузерный поэлементный hit-test (DOM-делегирование) для движок-
// нейтрального ввода. Точка p — в мировых координатах (после screenToWorld).
import { edgeSegment } from "@/components/canvas-render";
import type { Point, RenderEdge, RenderNode, Side } from "@/components/canvas-render";

import type { ResizeHandle } from "./editor-types";
import { handleAtPoint, hitTestNode, PORT_OFFSET, portPoint } from "./geometry-editor";

/** Допуски попадания в мировых единицах (SVG-хит-зоны живут внутри viewBox). */
export const RESIZE_HANDLE_HIT = 6;
export const PORT_HIT = 6;
export const EDGE_HIT = 6;

/** Что находится под точкой. Приоритет — порядок вариантов сверху вниз. */
export type HitResult =
  | { kind: "resize-handle"; nodeId: string; handle: ResizeHandle }
  | { kind: "port"; nodeId: string; side: Side }
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "background" };

/** Вход хит-теста — подмножество состояния редактора (движок-нейтрально). */
export interface HitTestInput {
  nodes: RenderNode[];
  edges: RenderEdge[];
  nodesById: Map<string, RenderNode>;
  /** id единственного выделенного узла — только тогда активны ручки/порты. */
  singleSelectedNodeId: string | null;
}

/** Дистанция от точки p до отрезка [a,b]. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Верхнее ребро под точкой в радиусе tol, либо null. */
export function hitTestEdge(
  p: Point,
  edges: RenderEdge[],
  nodesById: Map<string, RenderNode>,
  tol: number,
): string | null {
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    if (!e) continue;
    const from = nodesById.get(e.fromNode);
    const to = nodesById.get(e.toNode);
    if (!from || !to) continue;
    const { start, end } = edgeSegment(from, to, e.fromSide, e.toSide);
    if (distToSegment(p, start, end) <= tol) return e.id;
  }
  return null;
}

/** Сторона-порт узла под точкой в радиусе tol, либо null. */
export function portAtPoint(p: Point, n: RenderNode, offset: number, tol: number): Side | null {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  let best: Side | null = null;
  let bestDist = tol;
  for (const side of sides) {
    const pt = portPoint(n, side, offset);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d <= bestDist) {
      bestDist = d;
      best = side;
    }
  }
  return best;
}

/**
 * Что под мировой точкой p. Приоритет: ручка ресайза → порт → узел (верхний) →
 * ребро → фон. Ручки/порты активны только при одиночном выделении узла (зеркалит
 * рендер: оверлеи рисуются лишь для одиночного выделения).
 */
export function hitTest(p: Point, input: HitTestInput): HitResult {
  const { nodes, edges, nodesById, singleSelectedNodeId } = input;
  if (singleSelectedNodeId) {
    const sel = nodesById.get(singleSelectedNodeId);
    if (sel) {
      const handle = handleAtPoint(p, sel, RESIZE_HANDLE_HIT);
      if (handle) return { kind: "resize-handle", nodeId: sel.id, handle };
      const side = portAtPoint(p, sel, PORT_OFFSET, PORT_HIT);
      if (side) return { kind: "port", nodeId: sel.id, side };
    }
  }
  const node = hitTestNode(p, nodes);
  if (node) return { kind: "node", nodeId: node.id };
  const edgeId = hitTestEdge(p, edges, nodesById, EDGE_HIT);
  if (edgeId) return { kind: "edge", edgeId };
  return { kind: "background" };
}
