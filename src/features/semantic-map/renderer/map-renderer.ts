// src/features/semantic-map/renderer/map-renderer.ts
// Порт рендерера: единственная точка, где наружу торчит способность рисовать карту.
// three.js скрыт в реализации; UI-слой знает только этот интерфейс.
import type { RenderModel } from "../types";

export type RenderMode = "2d" | "3d";

/** Состояние overlay поиска: какие точки подсветить (по id) + позиция маркера-центроида. */
export interface MapOverlayState {
  highlightIds: Set<string>;
  marker: [number, number, number] | null;
}

export interface MapRenderer {
  /** Привязать к <canvas> и запустить render-loop. */
  mount(canvas: HTMLCanvasElement): void;
  /** Загрузить/заменить данные (строит буферы, подгоняет камеру). */
  setModel(model: RenderModel): void;
  /** Переключить 2D⇄3D на тех же буферах. */
  setMode(mode: RenderMode): void;
  /** Подогнать камеру под bounds текущей модели. */
  fitToBounds(): void;
  /** Сообщить новый размер вьюпорта (CSS-пиксели) и DPR. */
  resize(width: number, height: number, dpr: number): void;
  /** Column-major 4×4 view-projection активной камеры (для overlay-подписей). null до mount/model. */
  getViewProjection(): Float32Array | null;
  /** Подписка на каждый отрисованный кадр (для синхронизации HTML-overlay подписей). */
  onChange(cb: () => void): void;
  /** Стаб v1: hover/click-picking (overlay/lazy-детали — будущая фаза). Реализация может игнорировать cb. */
  onPick?(cb: (id: string | null) => void): void;
  /** Overlay поиска: подсветить точки (по id) + маркер. null — снять overlay. */
  setOverlay(overlay: MapOverlayState | null): void;
  /** Уменьшить движение: выключает инерцию камеры (OrbitControls damping). Навигация drag/zoom не затрагивается. */
  setReducedMotion(reduce: boolean): void;
  /** Освободить GPU-ресурсы и остановить loop. */
  destroy(): void;
}
