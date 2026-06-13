// src/features/canvas/editor/canvas-reducer.ts
import { canvasDataToRenderData } from "./render-map";
import { applyResize } from "./geometry-editor";
import { snapToGrid } from "./coords";
import { newId } from "./id";
import { GRID_SIZE, UNDO_LIMIT } from "./editor-types";
import type { CanvasData, CanvasEdge, CanvasNode } from "../types";
import type { EditorCommand, EditorState, Viewport } from "./editor-types";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

const TEXT_W = 160;
const TEXT_H = 60;
const SHAPE_W = 120;
const SHAPE_H = 80;
const REF_W = 200;
const REF_H = 72;

/** Клонирует CanvasData (структурно, для снапшотов undo). */
function cloneData(data: CanvasData): CanvasData {
  return {
    nodes: (data.nodes ?? []).map((n) => ({ ...n })),
    edges: (data.edges ?? []).map((e) => ({ ...e })),
  };
}

/** Глубокое сравнение графов по сериализации (граф мал — дёшево). */
function dataEquals(a: CanvasData, b: CanvasData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Инициализирует состояние редактора из загруженного CanvasData. */
export function initEditorState(data: CanvasData): EditorState {
  const normalized: CanvasData = { nodes: data.nodes ?? [], edges: data.edges ?? [] };
  return {
    data: normalized,
    selection: { nodeIds: [], edgeIds: [] },
    viewport: { ...DEFAULT_VIEWPORT },
    past: [],
    future: [],
    baseline: cloneData(normalized),
    dirty: false,
    gridEnabled: true,
  };
}

/**
 * Применяет мутацию графа: пушит текущий снапшот в past (с лимитом), чистит
 * future, ставит новый data, пересчитывает dirty относительно baseline.
 * `nextData` — уже изменённый граф. `selection` — опц. новое выделение.
 */
function commit(state: EditorState, nextData: CanvasData, selection?: EditorState["selection"]): EditorState {
  const past = [...state.past, cloneData(state.data)];
  if (past.length > UNDO_LIMIT) past.shift();
  return {
    ...state,
    data: nextData,
    past,
    future: [],
    dirty: !dataEquals(nextData, state.baseline),
    ...(selection ? { selection } : {}),
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function canvasReducer(state: EditorState, command: EditorCommand): EditorState {
  switch (command.type) {
    // ---------------- viewport ----------------
    case "panBy":
      return { ...state, viewport: { ...state.viewport, x: state.viewport.x + command.dx, y: state.viewport.y + command.dy } };
    case "setViewport":
      return { ...state, viewport: command.viewport };
    case "zoomAt": {
      // зум вычисляется в interaction-слое через applyZoomAtPoint и приходит как setViewport;
      // этот кейс оставлен для прямого вызова, повторяет coords.applyZoomAtPoint.
      const { factor, screenX, screenY } = command;
      const vp = state.viewport;
      const newZoom = Math.min(8, Math.max(0.1, vp.zoom * factor));
      const worldX = vp.x + screenX / vp.zoom;
      const worldY = vp.y + screenY / vp.zoom;
      return { ...state, viewport: { zoom: newZoom, x: worldX - screenX / newZoom, y: worldY - screenY / newZoom } };
    }
    case "toggleGrid":
      return { ...state, gridEnabled: !state.gridEnabled };

    // ---------------- selection ----------------
    case "selectNode":
      return {
        ...state,
        selection: command.additive
          ? { nodeIds: toggleId(state.selection.nodeIds, command.nodeId), edgeIds: state.selection.edgeIds }
          : { nodeIds: [command.nodeId], edgeIds: [] },
      };
    case "selectEdge":
      return {
        ...state,
        selection: command.additive
          ? { nodeIds: state.selection.nodeIds, edgeIds: toggleId(state.selection.edgeIds, command.edgeId) }
          : { nodeIds: [], edgeIds: [command.edgeId] },
      };
    case "selectMany":
      return { ...state, selection: { nodeIds: command.nodeIds, edgeIds: command.edgeIds } };
    case "clearSelection":
      return { ...state, selection: { nodeIds: [], edgeIds: [] } };

    // ---------------- add nodes ----------------
    case "addTextNode": {
      const id = newId();
      const node: CanvasNode = {
        id, type: "text",
        x: snapToGrid(command.x, state.gridEnabled), y: snapToGrid(command.y, state.gridEnabled),
        width: TEXT_W, height: TEXT_H, text: "",
      };
      return commit(state, { ...state.data, nodes: [...(state.data.nodes ?? []), node] }, { nodeIds: [id], edgeIds: [] });
    }
    case "addShapeNode": {
      const id = newId();
      const node: CanvasNode = {
        id, type: "shape",
        x: snapToGrid(command.x, state.gridEnabled), y: snapToGrid(command.y, state.gridEnabled),
        width: SHAPE_W, height: SHAPE_H, shape_kind: command.shapeKind,
      };
      return commit(state, { ...state.data, nodes: [...(state.data.nodes ?? []), node] }, { nodeIds: [id], edgeIds: [] });
    }
    case "addEntityRefNode": {
      const id = newId();
      const node: CanvasNode = {
        id, type: "entity_ref",
        x: snapToGrid(command.x, state.gridEnabled), y: snapToGrid(command.y, state.gridEnabled),
        width: REF_W, height: REF_H,
        entity_type: command.entityType, entity_id: command.entityId,
      };
      return commit(state, { ...state.data, nodes: [...(state.data.nodes ?? []), node] }, { nodeIds: [id], edgeIds: [] });
    }

    // ---------------- move / resize ----------------
    case "moveSelection": {
      const ids = new Set(state.selection.nodeIds);
      if (ids.size === 0) return state;
      const dx = snapToGrid(command.dx, false);
      const dy = snapToGrid(command.dy, false);
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id && ids.has(n.id) ? { ...n, x: (n.x ?? 0) + dx, y: (n.y ?? 0) + dy } : n,
      );
      return commit(state, { ...state.data, nodes });
    }
    case "resizeNode": {
      const nodes = (state.data.nodes ?? []).map((n) => {
        if (n.id !== command.nodeId) return n;
        const render = canvasDataToRenderData({ nodes: [n], edges: [] }).nodes[0];
        if (!render) return n;
        const r = applyResize(render, command.handle, command.dx, command.dy);
        return { ...n, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      });
      return commit(state, { ...state.data, nodes });
    }
    case "setNodeSize": {
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id === command.nodeId ? { ...n, width: Math.max(20, Math.round(command.width)), height: Math.max(20, Math.round(command.height)) } : n,
      );
      return commit(state, { ...state.data, nodes });
    }

    // ---------------- edit node ----------------
    case "setNodeText": {
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id === command.nodeId && (n.type === "text" || n.type === "shape") ? { ...n, text: command.text } : n,
      );
      return commit(state, { ...state.data, nodes });
    }
    case "setShapeKind": {
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id === command.nodeId && n.type === "shape" ? { ...n, shape_kind: command.shapeKind } : n,
      );
      return commit(state, { ...state.data, nodes });
    }

    // ---------------- edges ----------------
    case "addEdge": {
      if (command.fromNode === command.toNode) return state; // self-loop запрещаем в UI
      const id = newId();
      const edge: CanvasEdge = {
        id, from_node: command.fromNode, to_node: command.toNode,
        ...(command.fromSide ? { from_side: command.fromSide } : {}),
        ...(command.toSide ? { to_side: command.toSide } : {}),
      };
      return commit(state, { ...state.data, edges: [...(state.data.edges ?? []), edge] }, { nodeIds: [], edgeIds: [id] });
    }
    case "setEdgeLabel": {
      const edges = (state.data.edges ?? []).map((e) => (e.id === command.edgeId ? { ...e, label: command.label } : e));
      return commit(state, { ...state.data, edges });
    }
    case "setEdgeStyle": {
      const edges = (state.data.edges ?? []).map((e) => (e.id === command.edgeId ? { ...e, style: command.style } : e));
      return commit(state, { ...state.data, edges });
    }
    case "setEdgeEnd": {
      const edges = (state.data.edges ?? []).map((e) => (e.id === command.edgeId ? { ...e, end: command.end } : e));
      return commit(state, { ...state.data, edges });
    }
    case "setEdgeSides": {
      const edges = (state.data.edges ?? []).map((e) => {
        if (e.id !== command.edgeId) return e;
        // Пересобираем ребро без side-полей, затем добавляем только заданные
        // (exactOptionalPropertyTypes: нельзя присваивать undefined в опц. поле).
        const { from_side: _from, to_side: _to, ...rest } = e;
        const next: CanvasEdge = { ...rest };
        if (command.fromSide) next.from_side = command.fromSide;
        if (command.toSide) next.to_side = command.toSide;
        return next;
      });
      return commit(state, { ...state.data, edges });
    }

    // ---------------- delete ----------------
    case "deleteSelection": {
      const nodeIds = new Set(state.selection.nodeIds);
      const edgeIds = new Set(state.selection.edgeIds);
      if (nodeIds.size === 0 && edgeIds.size === 0) return state;
      const nodes = (state.data.nodes ?? []).filter((n) => !(n.id && nodeIds.has(n.id)));
      // удаляем выбранные рёбра + инцидентные удалённым узлам
      const edges = (state.data.edges ?? []).filter(
        (e) => !(e.id && edgeIds.has(e.id)) && !(e.from_node && nodeIds.has(e.from_node)) && !(e.to_node && nodeIds.has(e.to_node)),
      );
      return commit(state, { nodes, edges }, { nodeIds: [], edgeIds: [] });
    }

    // ---------------- history ----------------
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        data: previous,
        past: state.past.slice(0, -1),
        future: [cloneData(state.data), ...state.future],
        dirty: !dataEquals(previous, state.baseline),
        selection: { nodeIds: [], edgeIds: [] },
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        ...state,
        data: next,
        past: [...state.past, cloneData(state.data)],
        future: state.future.slice(1),
        dirty: !dataEquals(next, state.baseline),
        selection: { nodeIds: [], edgeIds: [] },
      };
    }

    // ---------------- meta ----------------
    case "markSaved":
      return { ...state, baseline: cloneData(command.data), dirty: false };

    default:
      return state;
  }
}

export { GRID_SIZE };
