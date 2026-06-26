// src/features/canvas/engine/index.ts
import type { CanvasPainter } from "./painter";
import { svgPainter } from "./svg/svg-painter";

export type { Scene, SurfaceSize, CanvasPainter } from "./painter";
export { svgPainter } from "./svg/svg-painter";
// Экспорт графа как данных (.json) — движко-нейтрален (не часть painter-контракта).
export { downloadCanvasJson } from "./svg/svg-export";

/**
 * Активный движок рендеринга редактора. Смена движка (SVG → canvas → …) =
 * заменить эту привязку на другую реализацию CanvasPainter.
 */
export const painter: CanvasPainter = svgPainter;
