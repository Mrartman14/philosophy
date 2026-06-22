// src/features/canvas/editor/validate.ts
import type { CanvasData } from "../types";

const MAX_NODES = 2000;
const MAX_EDGES = 2000;
const MAX_NODE_TEXT = 10_000;
const MAX_EDGE_LABEL = 200;

/**
 * Одна ошибка валидации с привязкой к узлу/ребру для подсветки в UI.
 *
 * ИЗОМОРФНЫЙ КОНТРАКТ: validate.ts чистый (вызывается из client ДО сохранения,
 * покрыт юнит-тестом) и НЕ держит getT/useT. Сообщение несётся как КЛЮЧ каталога
 * canvas.validate.* + ICU-параметры; client-вызыватель (canvas-editor) резолвит
 * через useT("canvas") при показе.
 */
export interface GraphError {
  /** Ключ каталога под namespace canvas.validate.* */
  messageKey: GraphErrorKey;
  /** ICU-параметры для подстановки в шаблон сообщения. */
  params?: Record<string, string | number>;
  nodeId?: string;
  edgeId?: string;
}

/** Ключи сообщений валидации (под-объект canvas.validate.* в каталоге). */
export type GraphErrorKey =
  | "tooManyNodes"
  | "tooManyEdges"
  | "nodeNoId"
  | "duplicateNodeId"
  | "nodeSizePositive"
  | "textNodeNoText"
  | "nodeTextTooLong"
  | "shapeNoKind"
  | "entityRefNoType"
  | "entityRefNoId"
  | "nodeUnknownType"
  | "edgeNoId"
  | "edgeFromNotFound"
  | "edgeToNotFound"
  | "edgeLabelTooLong";

export interface GraphValidation {
  ok: boolean;
  errors: GraphError[];
}

/** Известные типы узлов. Закрытый union в TS — это КОНТРАКТ, НЕ рантайм-гарантия:
 * валидатор-зеркало обязан ловить дрейф-тип с бэка, а не молча трактовать его. */
const KNOWN_NODE_TYPES = new Set<string>(["text", "shape", "entity_ref"]);

/**
 * Клиентская структурная валидация графа — зеркало philosophy-api
 * internal/canvas/validate.go (ValidateData + validateNode). Вызывается из
 * client ДО сохранения, чтобы поймать ошибки локально и подсветить узел/ребро.
 * Бек всё равно перепроверит. anchor НЕ валидируем (редактор его не создаёт,
 * существующие переносим как есть; anchor-compat проверит бек).
 */
export function validateGraph(data: CanvasData): GraphValidation {
  const errors: GraphError[] = [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];

  if (nodes.length > MAX_NODES) {
    errors.push({ messageKey: "tooManyNodes", params: { count: nodes.length, max: MAX_NODES } });
  }
  if (edges.length > MAX_EDGES) {
    errors.push({ messageKey: "tooManyEdges", params: { count: edges.length, max: MAX_EDGES } });
  }

  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n.id) {
      errors.push({ messageKey: "nodeNoId" });
      continue;
    }
    if (ids.has(n.id)) {
      errors.push({ nodeId: n.id, messageKey: "duplicateNodeId", params: { id: n.id } });
    }
    ids.add(n.id);

    if ((n.width ?? 0) <= 0 || (n.height ?? 0) <= 0) {
      errors.push({ nodeId: n.id, messageKey: "nodeSizePositive", params: { id: n.id } });
    }

    if (!KNOWN_NODE_TYPES.has(n.type)) {
      // Неизвестный тип = дрейф контракта бэка (closed union в TS его
      // рантайм-невозможным НЕ делает). Ловим явно, не маскируя под entity_ref.
      errors.push({ nodeId: n.id, messageKey: "nodeUnknownType", params: { id: n.id } });
    } else if (n.type === "text") {
      if (n.text == null) errors.push({ nodeId: n.id, messageKey: "textNodeNoText", params: { id: n.id } });
      else if (n.text.length > MAX_NODE_TEXT) errors.push({ nodeId: n.id, messageKey: "nodeTextTooLong", params: { id: n.id } });
    } else if (n.type === "shape") {
      if (!n.shape_kind) errors.push({ nodeId: n.id, messageKey: "shapeNoKind", params: { id: n.id } });
      if (n.text != null && n.text.length > MAX_NODE_TEXT) errors.push({ nodeId: n.id, messageKey: "nodeTextTooLong", params: { id: n.id } });
    } else {
      // entity_ref
      if (!n.entity_type) errors.push({ nodeId: n.id, messageKey: "entityRefNoType", params: { id: n.id } });
      if (!n.entity_id) errors.push({ nodeId: n.id, messageKey: "entityRefNoId", params: { id: n.id } });
    }
  }

  for (const e of edges) {
    if (!e.id) {
      errors.push({ messageKey: "edgeNoId" });
      continue;
    }
    if (!e.from_node || !ids.has(e.from_node)) {
      errors.push({ edgeId: e.id, messageKey: "edgeFromNotFound", params: { id: e.id } });
    }
    if (!e.to_node || !ids.has(e.to_node)) {
      errors.push({ edgeId: e.id, messageKey: "edgeToNotFound", params: { id: e.id } });
    }
    if (e.label != null && e.label.length > MAX_EDGE_LABEL) {
      errors.push({ edgeId: e.id, messageKey: "edgeLabelTooLong", params: { id: e.id } });
    }
  }

  return { ok: errors.length === 0, errors };
}
