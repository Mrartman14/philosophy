// src/components/scene-3d/scene-renderer.ts
// Порт базового 3D-рендерера: способность нарисовать облако точек + камеры/режимы/picking.
// three.js скрыт в реализации; UI-слой знает только этот интерфейс. = MapRenderer МИНУС setOverlay
// (overlay — карто-дельта, объявлена на собственном интерфейсе/классе карты).
import type { SceneRenderModel } from "./scene-render-model";

export type SceneRenderMode = "2d" | "3d";

/** Сериализуемый снимок камеры. 2d: [tx,ty,zoom]; 3d: [px,py,pz,tx,ty,tz]. */
export interface CameraState {
  mode: SceneRenderMode;
  values: number[];
}

export interface SceneRenderer {
  /** Привязать к <canvas> и запустить render-loop. */
  mount(canvas: HTMLCanvasElement): void;
  /** Загрузить/заменить данные (строит буферы, подгоняет камеру). */
  setModel(model: SceneRenderModel): void;
  /** Переключить 2D⇄3D на тех же буферах. */
  setMode(mode: SceneRenderMode): void;
  /** Подогнать камеру под bounds текущей модели. */
  fitToBounds(): void;
  /** Сообщить новый размер вьюпорта (CSS-пиксели) и DPR. */
  resize(width: number, height: number, dpr: number): void;
  /** Column-major 4×4 view-projection активной камеры (для overlay-подписей). null до mount/model. */
  getViewProjection(): Float32Array | null;
  /** Подписка на каждый отрисованный кадр (для синхронизации HTML-overlay подписей). */
  onChange(cb: () => void): void;
  /** Click-picking: cb с id ближайшей точки либо null. */
  onPick?(cb: (id: string | null) => void): void;
  /** Уменьшить движение: выключает инерцию камеры (OrbitControls damping). */
  setReducedMotion(reduce: boolean): void;
  /** Освободить GPU-ресурсы и остановить loop. */
  destroy(): void;
}
