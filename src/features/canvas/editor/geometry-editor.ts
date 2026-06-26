// src/features/canvas/editor/geometry-editor.ts
import { sidePoint } from "@/components/canvas-render";
import type { Point, RenderNode, Side } from "@/components/canvas-render";

import type { ResizeHandle } from "./editor-types";

/** Прямоугольник в мировых координатах. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SIZE = 20;

/** Точка внутри бокса узла (границы включительно). */
export function pointInRect(p: Point, n: RenderNode): boolean {
  return p.x >= n.x && p.x <= n.x + n.width && p.y >= n.y && p.y <= n.y + n.height;
}

/**
 * Верхний узел под точкой (последний в массиве = визуально верхний, т.к.
 * рендерятся по порядку). null если мимо всех.
 */
export function hitTestNode(p: Point, nodes: RenderNode[]): RenderNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n && pointInRect(p, n)) return n;
  }
  return null;
}

/** Координаты 8 ручек ресайза в мировых координатах. */
export function resizeHandles(n: RenderNode): Record<ResizeHandle, Point> {
  const { x, y, width: w, height: h } = n;
  return {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  };
}

/**
 * Точка порта ребра: середина стороны узла, вынесенная наружу по внешней нормали
 * на `offset`. Нужна, чтобы видимый порт (старт ребра) не накладывался на среднюю
 * ручку ресайза (n/e/s/w) в той же точке. Привязка ребра остаётся к стороне узла
 * (sidePoint) — смещается только маркер/хит-зона.
 */
export function portPoint(n: RenderNode, side: Side, offset: number): Point {
  const p = sidePoint(n, side);
  switch (side) {
    case "top": return { x: p.x, y: p.y - offset };
    case "right": return { x: p.x + offset, y: p.y };
    case "bottom": return { x: p.x, y: p.y + offset };
    case "left": return { x: p.x - offset, y: p.y };
  }
}

/** Ручка ресайза в радиусе `tolerance` от точки, либо null. */
export function handleAtPoint(p: Point, n: RenderNode, tolerance: number): ResizeHandle | null {
  const handles = resizeHandles(n);
  let best: ResizeHandle | null = null;
  let bestDist = tolerance;
  for (const key of Object.keys(handles) as ResizeHandle[]) {
    const h = handles[key];
    const dist = Math.hypot(h.x - p.x, h.y - p.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return best;
}

/**
 * Применяет ресайз к узлу по ручке и смещению (dx, dy в мировых координатах).
 * Клампит минимальный размер MIN_SIZE, не давая боксу схлопнуться/вывернуться.
 * Возвращает новый Rect (x/y/width/height).
 */
export function applyResize(n: RenderNode, handle: ResizeHandle, dx: number, dy: number): Rect {
  let { x, y, width: w, height: h } = n;
  const right = x + w;
  const bottom = y + h;

  const movesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const movesTop = handle === "nw" || handle === "n" || handle === "ne";
  const movesRight = handle === "ne" || handle === "e" || handle === "se";
  const movesBottom = handle === "sw" || handle === "s" || handle === "se";

  if (movesLeft) {
    x = Math.min(x + dx, right - MIN_SIZE);
    w = right - x;
  }
  if (movesRight) {
    w = Math.max(MIN_SIZE, w + dx);
  }
  if (movesTop) {
    y = Math.min(y + dy, bottom - MIN_SIZE);
    h = bottom - y;
  }
  if (movesBottom) {
    h = Math.max(MIN_SIZE, h + dy);
  }

  return { x, y, width: w, height: h };
}

/** id узлов, чьи боксы пересекают marquee-рамку. */
export function marqueeHits(rect: Rect, nodes: RenderNode[]): string[] {
  const rx2 = rect.x + rect.width;
  const ry2 = rect.y + rect.height;
  return nodes
    .filter((n) => n.x < rx2 && n.x + n.width > rect.x && n.y < ry2 && n.y + n.height > rect.y)
    .map((n) => n.id);
}
