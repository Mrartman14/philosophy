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
import type { NamespaceT } from "@/i18n";

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

type ValidationT = NamespaceT<"validation">;

/** Полная структурная валидация графа (зеркало ValidateData). */
export function makeCanvasDataSchema(t: ValidationT) {
  return z
    .object({
      nodes: z.array(NodeSchema).max(MAX_NODES),
      edges: z.array(EdgeSchema).max(MAX_EDGES),
    })
    .superRefine((d, ctx) => {
      const ids = new Set<string>();
      for (const n of d.nodes) {
        if (ids.has(n.id)) {
          ctx.addIssue({
            code: "custom",
            message: t("canvas.duplicateNodeId", { id: n.id }),
          });
        }
        ids.add(n.id);
      }
      for (const e of d.edges) {
        if (!ids.has(e.from_node)) {
          ctx.addIssue({
            code: "custom",
            message: t("canvas.edgeFromNotFound", { edgeId: e.id, nodeId: e.from_node }),
          });
        }
        if (!ids.has(e.to_node)) {
          ctx.addIssue({
            code: "custom",
            message: t("canvas.edgeToNotFound", { edgeId: e.id, nodeId: e.to_node }),
          });
        }
      }
    });
}

/** Вариант без переводчика для тестов и server-only контекстов без request-scope.
 * Используй `makeCanvasDataSchema(t)` в production-коде (actions). */
export const CanvasDataSchema = makeCanvasDataSchema(
  ((key: string) => key) as unknown as ValidationT,
);

export type CanvasDataInput = z.infer<typeof CanvasDataSchema>;

export type ParseDataResult =
  | { ok: true; data: CanvasDataInput }
  | { ok: false; error: string };

/**
 * Парсит JSON-строку графа из textarea. Пустая строка → пустой граф.
 * Возвращает discriminated result (не бросает) — удобно для preview-валидации
 * в client-форме и для schemas в actions.
 */
export function parseCanvasDataJson(raw: string, t?: ValidationT): ParseDataResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, data: { nodes: [], edges: [] } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      error: t ? t("canvas.badJson") : "canvas.badJson",
    };
  }
  const schema = t ? makeCanvasDataSchema(t) : CanvasDataSchema;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? (t ? t("canvas.graphInvalid") : "canvas.graphInvalid"),
    };
  }
  return { ok: true, data: result.data };
}

/** Transform-обёртка: JSON-строка data → CanvasData (для FormData-схем).
 * Принимает переводчик для локализованных ошибок валидации. */
function makeDataJsonField(t: ValidationT) {
  return z.string().optional().transform((s, ctx) => {
    const result = parseCanvasDataJson(s ?? "", t);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.data;
  });
}

/** POST /api/canvases. visibility/data опциональны. */
export function makeCanvasCreateSchema(t: ValidationT) {
  return z.object({
    title: z.string().trim().min(1, t("canvas.titleRequired")).max(200, t("canvas.titleMax")),
    visibility: z.enum(VISIBILITY).optional(),
    data: makeDataJsonField(t),
  });
}

/** PUT /api/canvases/{id}. id + title + data (заменяет целиком). */
export function makeCanvasUpdateSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("canvas.invalidId")),
    title: z.string().trim().min(1, t("canvas.titleRequired")).max(200, t("canvas.titleMax")),
    data: makeDataJsonField(t),
  });
}

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export function makeCanvasVisibilitySchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("canvas.invalidId")),
    visibility: z.enum(VISIBILITY),
  });
}

/** Для delete. */
export function makeCanvasIdSchema(t: ValidationT) {
  return z.object({ id: z.uuid(t("canvas.invalidId")) });
}

// --- Совместимые const-алиасы (для тестов и мест, не имеющих request-scope t). ---
// В production-коде (actions) использовать фабрики с getT("validation").
const _tPassthrough = ((key: string) => key) as unknown as ValidationT;
export const CanvasCreateSchema = makeCanvasCreateSchema(_tPassthrough);
export const CanvasUpdateSchema = makeCanvasUpdateSchema(_tPassthrough);
export const CanvasVisibilitySchema = makeCanvasVisibilitySchema(_tPassthrough);
export const CanvasIdSchema = makeCanvasIdSchema(_tPassthrough);

export type CanvasCreateInput = z.infer<ReturnType<typeof makeCanvasCreateSchema>>;
export type CanvasUpdateInput = z.infer<ReturnType<typeof makeCanvasUpdateSchema>>;
export type CanvasVisibilityInput = z.infer<ReturnType<typeof makeCanvasVisibilitySchema>>;
export type CanvasIdInput = z.infer<ReturnType<typeof makeCanvasIdSchema>>;
