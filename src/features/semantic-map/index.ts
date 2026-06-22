// src/features/semantic-map/index.ts
// Public API слайса: серверный fetcher + lazy client-обёртка карты.
export { getMap, type MapResult } from "./api";
export { getMapPointDetails } from "./actions";
export { SemanticMap } from "./ui/semantic-map";
export { MapStatePanel } from "./ui/map-state-panel";
export type { MapOverlay, MapPointDetail } from "./types";
