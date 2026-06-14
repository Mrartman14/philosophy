// src/features/canvas/editor/coords.ts
import type { Point } from "@/components/canvas-render";

import type { Viewport } from "./editor-types";
import { GRID_SIZE } from "./editor-types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/**
 * Экранная точка (внутри SVG-контейнера, пиксели) → мировая (координаты графа).
 * Модель вьюпорта: world = viewport.{x,y} + screen / zoom.
 */
export function screenToWorld(screen: Point, vp: Viewport): Point {
  return {
    x: vp.x + screen.x / vp.zoom,
    y: vp.y + screen.y / vp.zoom,
  };
}

/** Мировая точка → экранная. screen = (world - viewport.{x,y}) * zoom. */
export function worldToScreen(world: Point, vp: Viewport): Point {
  return {
    x: (world.x - vp.x) * vp.zoom,
    y: (world.y - vp.y) * vp.zoom,
  };
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * Множит зум на factor, сохраняя мировую точку под экранным курсором на месте.
 * Возвращает новый Viewport.
 */
export function applyZoomAtPoint(vp: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  const newZoom = clampZoom(vp.zoom * factor);
  // мировая точка под курсором до зума
  const worldX = vp.x + screenX / vp.zoom;
  const worldY = vp.y + screenY / vp.zoom;
  // подбираем смещение так, чтобы та же мировая точка осталась под курсором
  return {
    zoom: newZoom,
    x: worldX - screenX / newZoom,
    y: worldY - screenY / newZoom,
  };
}

/** Округляет к ближайшему GRID_SIZE при enabled, иначе к ближайшему int. */
export function snapToGrid(value: number, enabled: boolean): number {
  // `+ 0` нормализует -0 в +0 (Math.round(-0.375) даёт -0, ломает toBe(0)).
  if (!enabled) return Math.round(value) + 0;
  return Math.round(value / GRID_SIZE) * GRID_SIZE + 0;
}

/** Снапит обе координаты точки. */
export function snapPoint(p: Point, enabled: boolean): Point {
  return { x: snapToGrid(p.x, enabled), y: snapToGrid(p.y, enabled) };
}
