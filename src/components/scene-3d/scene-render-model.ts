// src/components/scene-3d/scene-render-model.ts
// Общая форма облака точек для базового рендерера. Доменные модели расширяют её:
// карта — { docs; clusters }, граф — { edges; edgeAlphas }.
export interface SceneRenderModel {
  count: number;
  /** count*3, всегда 3 координаты (z=0 при dims<3). */
  positions: Float32Array;
  /** count*3, RGB 0..1. */
  colors: Float32Array;
  /** id узла/точки — ключ для onPick. */
  ids: string[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
}
