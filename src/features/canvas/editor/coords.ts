// src/features/canvas/editor/coords.ts
import type { BBox, Point } from "@/components/canvas-render";

import type { Viewport } from "./editor-types";
import { GRID_SIZE } from "./editor-types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/** Шаг зума колеса/пинча (один «щелчок» = ±10%). Владелец зум-математики — этот модуль. */
export const ZOOM_IN = 1.1;
export const ZOOM_OUT = 1 / 1.1;

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

/**
 * Вьюпорт, при котором весь bbox влезает в поверхность `size` и центрируется
 * (с отступом `pad` — доля занимаемого экрана, 0.9 ≈ 10% полей). Зум зажат в
 * [MIN_ZOOM, MAX_ZOOM]. Пустой/вырожденный bbox или нулевой размер → дефолт
 * {x:0,y:0,zoom:1} (звать имеет смысл только при непустом графе).
 */
export function fitViewport(bbox: BBox, size: { width: number; height: number }, pad = 0.9): Viewport {
  const bw = bbox.maxX - bbox.minX;
  const bh = bbox.maxY - bbox.minY;
  if (bw <= 0 || bh <= 0 || size.width <= 0 || size.height <= 0) return { x: 0, y: 0, zoom: 1 };
  const zoom = clampZoom(Math.min(size.width / bw, size.height / bh) * pad);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  // центр bbox → центр поверхности: worldToScreen(center) === size/2.
  return { zoom, x: cx - size.width / 2 / zoom, y: cy - size.height / 2 / zoom };
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
