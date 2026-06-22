// src/features/reference-graph/index.ts
// Public API слайса reference-graph: серверный fetcher + lazy client-обёртка графа.
export { getGraph, type GraphResult } from "./api";
export { Graph } from "./ui/graph";
export type { GraphData } from "./types";
