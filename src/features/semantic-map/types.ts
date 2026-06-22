// Контракт /api/map — сужено из сгенерированной схемы бэкенда (semmap.*).
// Все поля optional (реальность ручки); устойчивость — в to-render-model.ts.
import type { components } from "@/api/schema";

export type MapBounds = components["schemas"]["semmap.Bounds"];
export type MapPoint = components["schemas"]["semmap.Point"];
export type MapTreeNode = components["schemas"]["semmap.TreeNode"];
export type MapData = components["schemas"]["semmap.Layout"];
export type MapPointDetail = components["schemas"]["semmap.PointDetail"];

// --- Внутренняя форма для рендерера (типизированные массивы, один draw-call) ---

export interface RenderCluster {
  id: number;
  label: string;
  color: string;
  size: number;
  centroid: [number, number, number];
}

export interface RenderModel {
  count: number;
  /** count*3, всегда 3 координаты (z=0 при dims<3). */
  positions: Float32Array;
  /** count*3, RGB 0..1. */
  colors: Float32Array;
  /** point.id (embeddings row id) — ключ, по которому рендерер подсвечивает точку. */
  ids: string[];
  /**
   * point.doc (id родительского документа) — ключ матча оверлея поиска.
   * Хиты поиска несут id документов/глоссария, точки карты — чанки; матчим по doc, не по id.
   */
  docs: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  clusters: RenderCluster[];
}

/** Overlay поиска: запрос + хиты (из llmretrieval.Hit, спроецированные на форму карты). */
export interface MapOverlay {
  query: string;
  hits: { id: string; type: string; score: number }[];
}
