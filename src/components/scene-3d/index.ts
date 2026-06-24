// src/components/scene-3d/index.ts
// Публичный API foundation-модуля 3D-сцены: pure-хелперы + (после Task 2-3) база/порт/шеллы.
// Слайсы импортируют отсюда (src/components/* — shared infra, не cross-feature).
export { projectToScreen } from "./project";
export { pickNearestPoint } from "./pick";
export { computeBounds } from "./compute-bounds";
export { fit2D, fit3D, type Frame2D, type Frame3D } from "./camera-fit";
export { hexToRgb01 } from "./palette";
export type { SceneRenderer, SceneRenderMode, CameraState } from "./scene-renderer";
export type { SceneRenderModel } from "./scene-render-model";
export { parseView, formatView, writeViewToUrl, type ParsedView } from "./url-view";
export { ThreeSceneRenderer } from "./three-scene-renderer";
export { SceneStatePanel } from "./ui/scene-state-panel";
export { SceneCanvasIsolation } from "./ui/scene-canvas-isolation";
export { SceneModeToggle, readSavedMode } from "./ui/scene-mode-toggle";
export { SceneRegionLabels, type ProjectedLabel } from "./ui/scene-region-labels";
export { useCameraUrlSync, type CameraUrlSync } from "./use-camera-url-sync";
