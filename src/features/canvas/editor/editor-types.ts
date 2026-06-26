// src/features/canvas/editor/editor-types.ts
import type { CanvasData, CanvasRefEntityType, CanvasEdgeSide } from "../types";

/** Сторона бокса (= `canvas.EdgeSide`, совпадает с canvas-render Side). */
export type Side = CanvasEdgeSide;

/** Вид выделенного элемента. */
export type SelectionKind = "node" | "edge";

/** Текущее выделение: множество node id и edge id. */
export interface Selection {
  nodeIds: string[];
  edgeIds: string[];
}

/** Активный инструмент взаимодействия. */
export type CanvasTool = "select" | "hand";

/** Состояние вьюпорта (pan/zoom) в мировых координатах. */
export interface Viewport {
  /** Смещение мира относительно экрана (мировые координаты левого-верхнего угла). */
  x: number;
  y: number;
  /** Масштаб (1 = 100%). */
  zoom: number;
}

/** 8 ручек ресайза одиночного узла. */
export type ResizeHandle =
  | "nw" | "n" | "ne"
  | "e"  | "se" | "s"
  | "sw" | "w";

/** Черновик entity_ref для диалога создания. */
export interface EntityRefDraft {
  entityType: CanvasRefEntityType;
  entityId: string;
}

/**
 * Полное состояние редактора. `data` — единственный источник графа (snake_case
 * schema-форма, как CanvasData). Selection/viewport — UI-состояние (НЕ в undo).
 * past/future — стеки снапшотов CanvasData для undo/redo. baseline — снапшот
 * последнего сохранённого графа (для вычисления dirty).
 */
export interface EditorState {
  data: CanvasData;
  selection: Selection;
  viewport: Viewport;
  past: CanvasData[];
  future: CanvasData[];
  /** Транзиентный ключ коалесцирования undo (склейка непрерывного жеста в одну
   *  запись истории). НЕ часть графа. */
  coalesceKey: string | null;
  baseline: CanvasData;
  dirty: boolean;
  /** Активный инструмент (UI-состояние, НЕ в undo). */
  tool: CanvasTool;
}

/** Глубина undo-стека. */
export const UNDO_LIMIT = 100;

/** Шаг сетки (px в мировых координатах). */
export const GRID_SIZE = 8;

/**
 * Команды над состоянием. Discriminated union по `type`. Interaction-слой
 * транслирует pointer/keyboard в эти команды; ядро применяет их синхронно.
 * Имена — глаголы/существительные в camelCase значения `type`.
 */
export type EditorCommand =
  // --- viewport ---
  | { type: "setViewport"; viewport: Viewport }
  // --- selection ---
  | { type: "selectNode"; nodeId: string; additive: boolean }
  | { type: "selectEdge"; edgeId: string; additive: boolean }
  | { type: "selectMany"; nodeIds: string[]; edgeIds: string[] }
  | { type: "clearSelection" }
  // --- tool ---
  | { type: "setTool"; tool: CanvasTool }
  // --- node mutations ---
  | { type: "addTextNode"; x: number; y: number; id?: string }
  | { type: "addShapeNode"; shapeKind: "rect" | "ellipse" | "diamond"; x: number; y: number }
  | { type: "addEntityRefNode"; entityType: CanvasRefEntityType; entityId: string; x: number; y: number }
  | { type: "moveSelection"; dx: number; dy: number; coalesce?: string }
  | { type: "resizeNode"; nodeId: string; handle: ResizeHandle; dx: number; dy: number }
  | { type: "setNodeText"; nodeId: string; text: string }
  | { type: "setShapeKind"; nodeId: string; shapeKind: "rect" | "ellipse" | "diamond" }
  | { type: "setNodeSize"; nodeId: string; width: number; height: number }
  | { type: "setNodePosition"; nodeId: string; x: number; y: number }
  // --- z-order ---
  | { type: "bringToFront"; nodeIds: string[] }
  | { type: "sendToBack"; nodeIds: string[] }
  // --- edge mutations ---
  | { type: "addEdge"; fromNode: string; toNode: string; fromSide?: Side; toSide?: Side }
  | { type: "setEdgeLabel"; edgeId: string; label: string }
  | { type: "setEdgeStyle"; edgeId: string; style: "solid" | "dashed" }
  | { type: "setEdgeEnd"; edgeId: string; end: "none" | "arrow" }
  | { type: "setEdgeSides"; edgeId: string; fromSide?: Side; toSide?: Side }
  // --- delete ---
  | { type: "deleteSelection" }
  // --- history / meta ---
  | { type: "undo" }
  | { type: "redo" }
  // sealHistory — «запечатать» жест: сбросить coalesce-ключ, чтобы следующий
  // drag стал отдельной записью undo (редактор шлёт на pointerup).
  | { type: "sealHistory" }
  | { type: "reset" }
  | { type: "markSaved"; data: CanvasData };
