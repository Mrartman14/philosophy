// src/components/scene-3d/index.ts
// Публичный API foundation-модуля 3D-сцены: pure-хелперы + (после Task 2-3) база/порт/шеллы.
// Слайсы импортируют отсюда (src/components/* — shared infra, не cross-feature).
export { projectToScreen } from "./project";
export { pickNearestPoint } from "./pick";
export { fit2D, fit3D, type Frame2D, type Frame3D } from "./camera-fit";
export { clusterColor, hexToRgb01 } from "./palette";
export type { SceneRenderer, SceneRenderMode } from "./scene-renderer";
export type { SceneRenderModel } from "./scene-render-model";
export { ThreeSceneRenderer } from "./three-scene-renderer";
