// Контракт /api/map — сужено из сгенерированной схемы бэкенда (semmap.*).
// Все поля optional (реальность ручки); устойчивость — в to-render-model.ts.
import type { components } from "@/api/schema";

export type MapBounds = components["schemas"]["semmap.Bounds"];
export type MapCluster = components["schemas"]["semmap.Cluster"];
export type MapPoint = components["schemas"]["semmap.Point"];
export type MapData = components["schemas"]["semmap.Layout"];

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
  ids: string[];
  /** Индекс в typeTable. */
  typeCodes: Uint8Array;
  typeTable: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  clusters: RenderCluster[];
}

/** Overlay поиска: запрос + хиты (из llmretrieval.Hit, спроецированные на форму карты). */
export interface MapOverlay {
  query: string;
  hits: { id: string; type: string; score: number }[];
}
