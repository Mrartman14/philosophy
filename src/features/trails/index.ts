// src/features/trails/index.ts
export {
  getTrails,
  getMyTrails,
  getTrailById,
  getAdminTrails,
  getLectureSummary,
} from "./api";
export type {
  TrailListFilter,
  AdminTrailListFilter,
  TrailListResult,
} from "./api";

export {
  canCreateTrail,
  canEditTrail,
  canDeleteTrail,
  canAdminDeleteTrail,
  canListAdminTrails,
} from "./permissions";

export {
  createTrail,
  updateTrailMeta,
  setTrailItems,
  setTrailVisibility,
  deleteTrail,
  adminDeleteTrail,
} from "./actions";

export type {
  Trail,
  TrailWithItems,
  TrailItem,
  TrailVisibility,
  TrailLectureSummary,
} from "./types";

export { TrailMyList } from "./ui/trail-my-list";
export { TrailPublicList } from "./ui/trail-public-list";
export { TrailAdminRow } from "./ui/trail-admin-row";
export { TrailDetail } from "./ui/trail-detail";
export { TrailCreateForm } from "./ui/trail-create-form";
export { TrailMetaForm } from "./ui/trail-meta-form";
export { TrailVisibilityButton } from "./ui/trail-visibility-button";
export { TrailDeleteButton } from "./ui/trail-delete-button";
export { TrailItemsEditor } from "./ui/trail-items-editor";
