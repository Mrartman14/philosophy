// Контракт /api/graph — сужено из сгенерированной схемы (refgraph.*).
// Все поля optional (реальность ручки); устойчивость — в to-graph-render-model.ts.
import type { components } from "@/api/schema";
import type { SceneRenderModel } from "@/components/scene-3d";

export type GraphData = components["schemas"]["refgraph.Graph"];
export type GraphNode = components["schemas"]["refgraph.Node"];
export type GraphEdge = components["schemas"]["refgraph.Edge"];
export type GraphBounds = components["schemas"]["refgraph.Bounds"];

/**
 * Внутренняя форма графа для рендерера: общее облако точек + рёбра + типы узлов.
 * edges — буфер пар вершин (2 точки/ребро, count_edges*6 чисел); edgeAlphas — альфа на ВЕРШИНУ
 * (count_edges*2), weight→прозрачность; types — node.type на индекс узла (для node-route).
 */
export type GraphRenderModel = SceneRenderModel & {
  edges: Float32Array;
  edgeAlphas: Float32Array;
  types: string[];
};
