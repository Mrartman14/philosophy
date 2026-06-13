// src/components/canvas-render/types.ts
import type { ReactNode } from "react";

/** Сторона бокса для привязки рёбер. */
export type Side = "top" | "right" | "bottom" | "left";

/** Доменно-нейтральный узел для рендера (слайс мапит свой CanvasNode сюда). */
export interface RenderNode {
  id: string;
  type: "text" | "shape" | "entity_ref";
  x: number;
  y: number;
  width: number;
  height: number;
  /** text-узел / опц. подпись shape-узла. */
  text?: string | undefined;
  /** shape-узел. */
  shapeKind?: "rect" | "ellipse" | "diamond" | undefined;
  /** entity_ref. */
  entityType?: string | undefined;
  entityId?: string | undefined;
}

/** Доменно-нейтральное ребро для рендера. */
export interface RenderEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: Side | undefined;
  toSide?: Side | undefined;
  label?: string | undefined;
  style?: "solid" | "dashed" | undefined;
  end?: "none" | "arrow" | undefined;
}

export interface RenderData {
  nodes: RenderNode[];
  edges: RenderEdge[];
}

/**
 * Резолвер ссылки для entity_ref-узла. Слайс передаёт функцию, которая по
 * (entityType, entityId) возвращает href detail-страницы ИЛИ null, если
 * страницы для типа нет (annotation/banner/event/неизвестный → плашка без
 * ссылки). Также метку типа (ru) для подписи карточки.
 */
export interface EntityRefView {
  /** href detail-страницы или null (нет публичной страницы). */
  href: string | null;
  /** Человекочитаемая метка типа, напр. «Документ». */
  typeLabel: string;
}

export type EntityRefResolver = (entityType: string, entityId: string) => EntityRefView;

export interface CanvasRenderProps {
  data: RenderData;
  resolveEntityRef: EntityRefResolver;
  /** Подпись при пустом графе. По умолчанию «Граф пуст.». */
  emptyText?: string;
  className?: string;
  /** Доп. контент поверх (напр. бейдж ревизии). */
  children?: ReactNode;
}

/** Прямоугольник bounding-box всего графа. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
