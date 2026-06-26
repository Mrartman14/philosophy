// src/features/canvas/engine/painter.ts
// Контракт движка рендеринга редактора. Реализация прячет ВСЮ специфику бэкенда
// отрисовки (SVG / canvas / …). Редактор знает только эти типы.
import type { ComponentType } from "react";

import type { EntityRefResolver, Point, RenderData } from "@/components/canvas-render";

import type { Rect, Viewport } from "../editor";

/** Пиксельные размеры поверхности (из ResizeObserver редактора). */
export interface SurfaceSize {
  width: number;
  height: number;
}

/**
 * Снапшот того, что нужно нарисовать: граф + вьюпорт + аффордансы взаимодействия.
 * Редактор собирает Scene из своего состояния и отдаёт painter'у. Painter НЕ несёт
 * бизнес-логики/коллбэков — он чистый «рисователь».
 */
export interface Scene {
  data: RenderData;
  viewport: Viewport;
  resolveEntityRef: EntityRefResolver;
  /** Выделенные узлы/рёбра. */
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  /** id единственного выделенного узла → ручки ресайза + порты. */
  handlesForNodeId: string | null;
  /** Узел-кандидат под курсором при протягивании ребра (подсветка цели). */
  edgeTargetId: string | null;
  /** Узел с ошибкой валидации (красная рамка). */
  invalidNodeId: string | null;
  /** Превью создаваемого ребра (мировые точки). */
  edgeDraft: { from: Point; to: Point } | null;
  /** Marquee-рамка (мировые координаты). */
  marquee: Rect | null;
}

/**
 * Контракт движка рендеринга редактора. Смена движка = новая реализация + одна
 * перепривязка в engine/index.ts.
 */
export interface CanvasPainter {
  /** Визуальная поверхность. Рисует картинку; pointer-events:none (ввод — у редактора). */
  Surface: ComponentType<{ scene: Scene; size: SurfaceSize }>;
  /** Экспорт чистого графа (без chrome редактора) в .svg. */
  exportSvg(data: RenderData, resolve: EntityRefResolver, title: string, rootEl: Element): void;
  /** Экспорт чистого графа в .png. */
  exportPng(data: RenderData, resolve: EntityRefResolver, title: string, rootEl: Element): Promise<void>;
}
