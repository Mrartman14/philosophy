// src/features/canvas/index.ts
export {
  getCanvases,
  getCanvasById,
  getCanvasRevisions,
  getCanvasRevision,
  getCanvasContainers,
} from "./api";
export type { CanvasListFilter, CanvasListResult, CanvasWithETag } from "./api";

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

export { resolveEntityRefView } from "./entity-ref";

export { CanvasMyList } from "./ui/canvas-my-list";
export { CanvasSearch } from "./ui/canvas-search";
export { CanvasCreateForm } from "./ui/canvas-create-form";
export { CanvasEditForm } from "./ui/canvas-edit-form";
export { CanvasVisibilityButton } from "./ui/canvas-visibility-button";
export { CanvasDeleteButton } from "./ui/canvas-delete-button";
export { CanvasDetail } from "./ui/canvas-detail";
export { CanvasContainers } from "./ui/canvas-containers";
export { CanvasRevisions } from "./ui/canvas-revisions";
export { CanvasEditor } from "./ui/canvas-editor";
