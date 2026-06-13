// src/features/annotations/index.ts
export {
  getAnnotationsFor,
  getAnnotationById,
  getMyAnnotations,
  getLectureAnnotations,
  getAdminAnnotations,
  getAnnotationRevisions,
  getAnnotationRevision,
  getBlockContext,
} from "./api";
export {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  adminDeleteAnnotation,
} from "./actions";
export {
  canCreateAnnotation,
  canEditAnnotation,
  canDeleteAnnotation,
  canAdminDeleteAnnotation,
  canModerateAnnotations,
} from "./permissions";
export {
  buildTextAnchor,
  buildMediaAnchor,
  isValidTextAnchor,
  isValidMediaAnchor,
} from "./anchor";
export { AnnotationsSection } from "./ui/annotations-section";
export { AnnotationCard } from "./ui/annotation-card";
export { AnnotationList } from "./ui/annotation-list";
export { AnnotationCreateForm } from "./ui/annotation-create-form";
export { AnnotationEditForm } from "./ui/annotation-edit-form";
export { AnnotationDeleteButton } from "./ui/annotation-delete-button";
export { AnnotationVisibilityField } from "./ui/annotation-visibility-field";
export { AnnotationExportLinks } from "./ui/annotation-export-links";
export { AnnotationRevisions } from "./ui/annotation-revisions";
export { AnnotationAnchorContext } from "./ui/annotation-anchor-context";
export { AnnotationAdminRow } from "./ui/annotation-admin-row";
export { AnnotationAdminFilterForm } from "./ui/annotation-admin-filter-form";
export { AnnotationPagination } from "./ui/annotation-pagination";
export type {
  Annotation,
  AnnotationVisibility,
  Anchor,
  ParentEntityType,
  AnnotationListResult,
} from "./types";
