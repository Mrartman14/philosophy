// src/features/canvas/editor/index.ts
export { canvasReducer, initEditorState } from "./canvas-reducer";
export { newId } from "./id";
export { screenToWorld, worldToScreen, applyZoomAtPoint, snapToGrid, snapPoint } from "./coords";
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
} from "./geometry-editor";
export type { Rect } from "./geometry-editor";
export type {
  EditorState,
  EditorCommand,
  Selection,
  Viewport,
  ResizeHandle,
  EntityRefDraft,
  Side,
} from "./editor-types";
export { GRID_SIZE, UNDO_LIMIT } from "./editor-types";
