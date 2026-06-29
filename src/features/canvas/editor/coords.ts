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

/** Вьюпорт, центрирующий мировую точку `center` в середине поверхности `size`
 *  при текущем зуме (только пан, зум не трогаем). */
export function centerViewport(center: Point, size: { width: number; height: number }, zoom: number): Viewport {
  return { zoom, x: center.x - size.width / 2 / zoom, y: center.y - size.height / 2 / zoom };
}

/** Засечка линейки: мировое значение координаты + её экранная позиция (px). */
export interface RulerTick {
  world: number;
  screen: number;
}

/** Ближайшее «красивое» число (1/2/5 × 10^k) НЕ меньше raw — шаг засечек. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / pow; // [1, 10)
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * Засечки линейки вдоль одной оси (Figma-стиль). Мир, видимый на отрезке длиной
 * `lengthPx`: [originWorld, originWorld + lengthPx/zoom]. Шаг — «красивое» число,
 * подобранное так, чтобы экранный интервал был ≈ `targetPx` (адаптивно к зуму).
 * Линейка всегда у края экрана → координаты видны, даже когда мировой 0 ушёл.
 */
export function rulerTicks(originWorld: number, lengthPx: number, zoom: number, targetPx = 80): RulerTick[] {
  if (lengthPx <= 0 || zoom <= 0) return [];
  const step = niceStep(targetPx / zoom);
  const worldMax = originWorld + lengthPx / zoom;
  const ticks: RulerTick[] = [];
  // первая засечка — ближайшее кратное шага, не меньше левого/верхнего края.
  for (let w = Math.ceil(originWorld / step) * step; w <= worldMax; w += step) {
    ticks.push({ world: w, screen: (w - originWorld) * zoom });
  }
  return ticks;
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

/** Строка SVG `viewBox` из вьюпорта и размера поверхности (px). Владелец зум-математики — этот модуль. */
export function viewBoxFromViewport(vp: Viewport, size: { width: number; height: number }): string {
  return `${vp.x} ${vp.y} ${size.width / vp.zoom} ${size.height / vp.zoom}`;
}

/** Шаг зума кнопкой тулбара/клавишей — крупнее одного «щелчка» колеса (комфортнее кликом). */
export const BTN_ZOOM_IN = 1.4;
export const BTN_ZOOM_OUT = 1 / 1.4;
