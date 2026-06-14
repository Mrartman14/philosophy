// src/features/canvas/schemas.ts
import "server-only";
import { z } from "zod";

import {
  VISIBILITY,
  CANVAS_SHAPE_KINDS,
  CANVAS_EDGE_SIDES,
  CANVAS_EDGE_STYLES,
  CANVAS_EDGE_ENDS,
  CANVAS_REF_ENTITY_TYPES,
} from "@/api/enums";

/**
 * Zod-зеркало canvas-графа. Источник истины — philosophy-api
 * internal/canvas/validate.go (ValidateData) + model.go (типы узлов/рёбер).
 * Эти схемы валидируют граф на фронте перед POST/PUT (raw-JSON редактор фазы 1).
 * Лимиты совпадают с беком; бек всё равно перепроверит.
 */

const MAX_NODES = 2000;
const MAX_EDGES = 2000;
const MAX_NODE_TEXT = 10_000;
const MAX_EDGE_LABEL = 200;

const PosInt = z.number().int();
const PosDim = z.number().int().positive();

const BaseNode = z.object({
  id: z.string().min(1),
  x: PosInt,
  y: PosInt,
  width: PosDim,
  height: PosDim,
});

const TextNode = BaseNode.extend({
  type: z.literal("text"),
  text: z.string().max(MAX_NODE_TEXT),
});

const ShapeNode = BaseNode.extend({
  type: z.literal("shape"),
  shape_kind: z.enum(CANVAS_SHAPE_KINDS),
  text: z.string().max(MAX_NODE_TEXT).optional(),
});

const EntityRefNode = BaseNode.extend({
  type: z.literal("entity_ref"),
  entity_type: z.enum(CANVAS_REF_ENTITY_TYPES),
  entity_id: z.string().min(1),
  // anchor — пробрасываем как есть; бек проверяет совместимость kind'а.
  anchor: z.record(z.string(), z.unknown()).optional(),
});

const NodeSchema = z.discriminatedUnion("type", [TextNode, ShapeNode, EntityRefNode]);

const EdgeSchema = z.object({
  id: z.string().min(1),
  from_node: z.string().min(1),
  to_node: z.string().min(1),
  from_side: z.enum(CANVAS_EDGE_SIDES).optional(),
  to_side: z.enum(CANVAS_EDGE_SIDES).optional(),
  label: z.string().max(MAX_EDGE_LABEL).optional(),
  style: z.enum(CANVAS_EDGE_STYLES).optional(),
  end: z.enum(CANVAS_EDGE_ENDS).optional(),
});

/** Полная структурная валидация графа (зеркало ValidateData). */
export const CanvasDataSchema = z
  .object({
    nodes: z.array(NodeSchema).max(MAX_NODES),
    edges: z.array(EdgeSchema).max(MAX_EDGES),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    for (const n of d.nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: "custom", message: `Дубликат node.id "${n.id}"` });
      }
      ids.add(n.id);
    }
    for (const e of d.edges) {
      if (!ids.has(e.from_node)) {
        ctx.addIssue({ code: "custom", message: `Ребро "${e.id}": from_node "${e.from_node}" не найден` });
      }
      if (!ids.has(e.to_node)) {
        ctx.addIssue({ code: "custom", message: `Ребро "${e.id}": to_node "${e.to_node}" не найден` });
      }
    }
  });

export type CanvasDataInput = z.infer<typeof CanvasDataSchema>;

export type ParseDataResult =
  | { ok: true; data: CanvasDataInput }
  | { ok: false; error: string };

/**
 * Парсит JSON-строку графа из textarea. Пустая строка → пустой граф.
 * Возвращает discriminated result (не бросает) — удобно для preview-валидации
 * в client-форме и для schemas в actions.
 */
export function parseCanvasDataJson(raw: string): ParseDataResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, data: { nodes: [], edges: [] } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Битый JSON в данных графа" };
  }
  const result = CanvasDataSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first?.message ?? "Граф не прошёл валидацию" };
  }
  return { ok: true, data: result.data };
}

/** Transform-обёртка: JSON-строка data → CanvasData (для FormData-схем). */
const DataJsonField = z.string().optional().transform((s, ctx) => {
  const result = parseCanvasDataJson(s ?? "");
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.data;
});

const TitleSchema = z.string().trim().min(1, "Введите название").max(200, "До 200 символов");
const VisibilityEnum = z.enum(VISIBILITY);
const UuidSchema = z.uuid("Некорректный id канваса");

/** POST /api/canvases. visibility/data опциональны. */
export const CanvasCreateSchema = z.object({
  title: TitleSchema,
  visibility: VisibilityEnum.optional(),
  data: DataJsonField,
});

/** PUT /api/canvases/{id}. id + title + data (заменяет целиком). */
export const CanvasUpdateSchema = z.object({
  id: UuidSchema,
  title: TitleSchema,
  data: DataJsonField,
});

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export const CanvasVisibilitySchema = z.object({
  id: UuidSchema,
  visibility: VisibilityEnum,
});

/** Для delete. */
export const CanvasIdSchema = z.object({ id: UuidSchema });

export type CanvasCreateInput = z.infer<typeof CanvasCreateSchema>;
export type CanvasUpdateInput = z.infer<typeof CanvasUpdateSchema>;
export type CanvasVisibilityInput = z.infer<typeof CanvasVisibilitySchema>;
export type CanvasIdInput = z.infer<typeof CanvasIdSchema>;
