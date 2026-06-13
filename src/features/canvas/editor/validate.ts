// src/features/canvas/editor/validate.ts
import type { CanvasData } from "../types";

const MAX_NODES = 2000;
const MAX_EDGES = 2000;
const MAX_NODE_TEXT = 10_000;
const MAX_EDGE_LABEL = 200;

/** Одна ошибка валидации с привязкой к узлу/ребру для подсветки в UI. */
export interface GraphError {
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface GraphValidation {
  ok: boolean;
  errors: GraphError[];
}

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
    errors.push({ message: `Слишком много узлов: ${nodes.length} > ${MAX_NODES}` });
  }
  if (edges.length > MAX_EDGES) {
    errors.push({ message: `Слишком много рёбер: ${edges.length} > ${MAX_EDGES}` });
  }

  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n.id) {
      errors.push({ message: "У узла нет id" });
      continue;
    }
    if (ids.has(n.id)) {
      errors.push({ nodeId: n.id, message: `Дубликат id узла "${n.id}"` });
    }
    ids.add(n.id);

    if ((n.width ?? 0) <= 0 || (n.height ?? 0) <= 0) {
      errors.push({ nodeId: n.id, message: `Узел "${n.id}": размеры должны быть положительными` });
    }

    if (n.type === "text") {
      if (n.text == null) errors.push({ nodeId: n.id, message: `Текстовый узел "${n.id}" без текста` });
      else if (n.text.length > MAX_NODE_TEXT) errors.push({ nodeId: n.id, message: `Узел "${n.id}": текст слишком длинный` });
    } else if (n.type === "shape") {
      if (!n.shape_kind) errors.push({ nodeId: n.id, message: `Фигура "${n.id}" без типа фигуры` });
      if (n.text != null && n.text.length > MAX_NODE_TEXT) errors.push({ nodeId: n.id, message: `Узел "${n.id}": текст слишком длинный` });
    } else if (n.type === "entity_ref") {
      if (!n.entity_type) errors.push({ nodeId: n.id, message: `Ссылка "${n.id}" без типа сущности` });
      if (!n.entity_id) errors.push({ nodeId: n.id, message: `Ссылка "${n.id}" без id сущности` });
    } else {
      errors.push({ nodeId: n.id, message: `Узел "${n.id}": неизвестный тип` });
    }
  }

  for (const e of edges) {
    if (!e.id) {
      errors.push({ message: "У ребра нет id" });
      continue;
    }
    if (!e.from_node || !ids.has(e.from_node)) {
      errors.push({ edgeId: e.id, message: `Ребро "${e.id}": from_node не найден` });
    }
    if (!e.to_node || !ids.has(e.to_node)) {
      errors.push({ edgeId: e.id, message: `Ребро "${e.id}": to_node не найден` });
    }
    if (e.label != null && e.label.length > MAX_EDGE_LABEL) {
      errors.push({ edgeId: e.id, message: `Ребро "${e.id}": подпись слишком длинная` });
    }
  }

  return { ok: errors.length === 0, errors };
}
