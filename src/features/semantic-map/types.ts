// Контракт /api/map — сужено из сгенерированной схемы бэкенда (semmap.*).
// Все поля optional (реальность ручки); устойчивость — в to-render-model.ts.
import type { components } from "@/api/schema";
import type { SceneRenderModel } from "@/components/scene-3d";

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

/** Модель карты = общая форма облака + карто-специфика (docs для матча оверлея, clusters для подписей). */
export type RenderModel = SceneRenderModel & {
  /** point.doc — ключ матча оверлея поиска (хиты несут id документов, точки — чанки). */
  docs: string[];
  clusters: RenderCluster[];
};

/** Overlay поиска: запрос + хиты (из llmretrieval.Hit, спроецированные на форму карты). */
export interface MapOverlay {
  query: string;
  hits: { id: string; type: string; score: number }[];
}
