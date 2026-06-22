// Контракт /api/graph — сужено из сгенерированной схемы (refgraph.*).
// Все поля optional (реальность ручки); устойчивость — в to-graph-render-model.ts.
import type { components } from "@/api/schema";
import type { SceneRenderModel } from "@/components/scene-3d";

export type GraphData = components["schemas"]["refgraph.Graph"];
export type GraphBounds = components["schemas"]["refgraph.Bounds"];
export type NodeType = components["schemas"]["refgraph.NodeType"];

/**
 * Внутренняя форма графа для рендерера: общее облако точек + рёбра.
 * edges — буфер пар вершин (2 точки/ребро, count_edges*6 чисел); edgeAlphas — альфа на ВЕРШИНУ
 * (count_edges*2), weight→прозрачность. Тип узла во view берётся прямо из data.nodes (NodeType).
 */
export type GraphRenderModel = SceneRenderModel & {
  edges: Float32Array;
  edgeAlphas: Float32Array;
};
