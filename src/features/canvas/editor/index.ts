// src/features/canvas/editor/index.ts
export { canvasReducer, initEditorState, NODE_DEFAULT_SIZE } from "./canvas-reducer";
export { newId } from "./id";
export { screenToWorld, worldToScreen, applyZoomAtPoint, fitViewport, centerViewport, rulerTicks, snapToGrid, snapPoint } from "./coords";
export type { RulerTick } from "./coords";
export { canvasDataToRenderData } from "./render-map";
export { validateGraph } from "./validate";
export type { GraphError, GraphErrorKey, GraphValidation } from "./validate";
export {
  pointInRect,
  hitTestNode,
  resizeHandles,
  handleAtPoint,
  applyResize,
  marqueeHits,
  portPoint,
  PORT_OFFSET,
} from "./geometry-editor";
export type { Rect } from "./geometry-editor";
export { hitTest, hitTestEdge, portAtPoint, RESIZE_HANDLE_HIT, PORT_HIT, EDGE_HIT } from "./hit-test";
export type { HitResult, HitTestInput } from "./hit-test";
export {
  resolveBackgroundGesture,
  resolveNodeGesture,
  resolveWheel,
  resolveNudge,
} from "./interaction";
export type { GestureInput, WheelInput, WheelAction } from "./interaction";
export type {
  EditorState,
  EditorCommand,
  Selection,
  Viewport,
  ResizeHandle,
  EntityRefDraft,
  Side,
  CanvasTool,
} from "./editor-types";
export { GRID_SIZE, UNDO_LIMIT } from "./editor-types";
export { usePanZoom } from "./use-pan-zoom";
export type { UsePanZoomOptions } from "./use-pan-zoom";
