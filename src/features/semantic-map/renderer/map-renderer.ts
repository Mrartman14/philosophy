// src/features/semantic-map/renderer/map-renderer.ts
// Порт рендерера карты = базовый SceneRenderer + карто-дельта setOverlay.
import type { SceneRenderer, SceneRenderMode } from "@/components/scene-3d";

export type RenderMode = SceneRenderMode;

/** Состояние overlay поиска: какие точки подсветить (по id) + позиция маркера-центроида. */
export interface MapOverlayState {
  highlightIds: Set<string>;
  marker: [number, number, number] | null;
}

export interface MapRenderer extends SceneRenderer {
  /** Overlay поиска: подсветить точки (по id) + маркер. null — снять overlay. */
  setOverlay(overlay: MapOverlayState | null): void;
}
