// src/components/canvas-render/geometry.ts
import type { BBox, RenderNode, Side } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** Bounding box всех узлов. Пустой список → нулевой бокс. */
export function boundingBox(nodes: RenderNode[]): BBox {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { minX, minY, maxX, maxY };
}

/** Центр узла. */
export function center(n: RenderNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

/** Центральная точка указанной грани бокса. */
export function sidePoint(n: RenderNode, side: Side): Point {
  switch (side) {
    case "top": return { x: n.x + n.width / 2, y: n.y };
    case "right": return { x: n.x + n.width, y: n.y + n.height / 2 };
    case "bottom": return { x: n.x + n.width / 2, y: n.y + n.height };
    case "left": return { x: n.x, y: n.y + n.height / 2 };
  }
}

/**
 * Точка пересечения границы бокса узла с лучом из центра узла к `target`.
 * Используется, когда у ребра не заданы from_side/to_side. Если target
 * совпадает с центром — возвращает центр (защита от деления на ноль).
 */
export function boxBorderIntersection(n: RenderNode, target: Point): Point {
  const c = center(n);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = n.width / 2;
  const hh = n.height / 2;
  // Параметр t вдоль луча до пересечения с ближайшей гранью.
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export interface EdgeGeometry {
  /** SVG path `d` атрибут (прямая линия). */
  d: string;
  /** Середина ребра — для размещения label. */
  mid: Point;
  /** Конечная точка (для разворота стрелки её хватает marker'у). */
  end: Point;
}

/**
 * Геометрические точки отрезка ребра (без SVG-форматирования). Если сторона
 * задана — точка на ней; иначе — пересечение границы бокса с лучом к центру
 * другого узла. Делится между рендером (edgePath) и хит-тестом (hitTestEdge).
 */
export function edgeSegment(
  from: RenderNode,
  to: RenderNode,
  fromSide: Side | undefined,
  toSide: Side | undefined,
): { start: Point; end: Point } {
  const start = fromSide ? sidePoint(from, fromSide) : boxBorderIntersection(from, center(to));
  const end = toSide ? sidePoint(to, toSide) : boxBorderIntersection(to, center(from));
  return { start, end };
}

/**
 * Геометрия ребра между двумя узлами для SVG: путь `d`, середина (label) и конец.
 */
export function edgePath(
  from: RenderNode,
  to: RenderNode,
  fromSide: Side | undefined,
  toSide: Side | undefined,
): EdgeGeometry {
  const { start, end } = edgeSegment(from, to, fromSide, toSide);
  const d = `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`;
  return {
    d,
    mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    end,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
