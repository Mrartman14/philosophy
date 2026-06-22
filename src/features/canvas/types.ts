// src/features/canvas/types.ts
import type { components } from "@/api/schema";

/** Полный канвас (GET /api/canvases/{id}). Включает data-блоб. */
export type Canvas = components["schemas"]["canvas.Canvas"];

/** Лёгкая сводка (GET /api/canvases — список). Без data. */
export type CanvasSummary = components["schemas"]["canvas.CanvasSummary"];

/** Корень графа: nodes[] + edges[]. */
export type CanvasData = components["schemas"]["canvas.Data"];

/** Узел графа (discriminated union по type). */
export type CanvasNode = components["schemas"]["canvas.Node"];

/** Тип цели entity_ref-узла (9 значений, бек: `canvas.RefEntityType` / AllowedRefEntityTypes). */
export type CanvasRefEntityType = components["schemas"]["canvas.RefEntityType"];

/** Сторона узла для привязки ребра (бек: `canvas.EdgeSide`). */
export type CanvasEdgeSide = components["schemas"]["canvas.EdgeSide"];

/** Ребро графа. */
export type CanvasEdge = components["schemas"]["canvas.Edge"];

/** Видимость: "private" | "public". */
export type { AccessVisibility as Visibility } from "@/api/types";

/** Мета-ревизии (элемент списка). У канваса нет id — ключ rev_num. */
export type CanvasRevisionMeta = components["schemas"]["canvas.RevisionMeta"];

/** Полная ревизия со снапшотом data. */
export type CanvasRevision = components["schemas"]["canvas.Revision"];

/** Один attachment (reverse-lookup лекций-контейнеров). */
export type AttachmentDTO = components["schemas"]["attachment.AttachmentDTO"];
