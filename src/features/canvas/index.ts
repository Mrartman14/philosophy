// src/features/canvas/index.ts
export {
  getCanvases,
  getCanvasById,
  getCanvasRevisions,
  getCanvasRevision,
  getCanvasContainers,
} from "./api";
export type { CanvasListFilter, CanvasListResult } from "./api";

export {
  canCreateCanvas,
  canEditCanvas,
  canChangeVisibility,
  canDeleteCanvas,
  canSeeRevisions,
} from "./permissions";

export {
  createCanvas,
  updateCanvas,
  setCanvasVisibility,
  deleteCanvas,
} from "./actions";

export type {
  Canvas,
  CanvasSummary,
  CanvasData,
  CanvasNode,
  CanvasEdge,
  Visibility,
  CanvasRevision,
  CanvasRevisionMeta,
  AttachmentDTO,
} from "./types";

// UI-экспорты добавляются в Задаче 13.
