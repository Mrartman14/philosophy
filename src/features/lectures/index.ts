// src/features/lectures/index.ts
// Public API слайса.
export { getLectures, getLectureById } from "./api";
export type { LectureListFilter, LectureListResult } from "./api";
export {
  createLecture,
  updateLecture,
  deleteLecture,
  setLectureVisibility,
} from "./actions";
export {
  canCreateLecture,
  canUpdateLecture,
  canDeleteLecture,
  canSetLectureVisibility,
} from "./permissions";
export { LectureList } from "./ui/lecture-list";
export { LectureCard } from "./ui/lecture-card";
export { LectureDetail } from "./ui/lecture-detail";
export { LectureSearchForm } from "./ui/lecture-search-form";
export { LectureCreateForm } from "./ui/lecture-create-form";
export { LectureEditForm } from "./ui/lecture-edit-form";
export { LectureAdminRow } from "./ui/lecture-admin-row";
export type { Lecture, LectureListItem, LectureVisibility } from "./types";

// lecture-enrichment (волна 3) — cover.
export { lectureCoverUrl } from "./cover-url";
export { LectureCoverForm } from "./ui/lecture-cover-form";
export { canManageCover } from "./permissions";
export { setLectureCover, clearLectureCover } from "./actions";

// lecture-enrichment (волна 3) — attachments.
export { getLectureDocuments, getLectureMedia } from "./api";
export {
  attachToLecture,
  detachFromLecture,
  reorderLectureAttachment,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "./actions";
export { canManageAttachments, canAttachToLecture } from "./permissions";
export { LectureAttachmentsManager } from "./ui/lecture-attachments-manager";
export type { ManagedAttachment } from "./ui/lecture-attachments-manager";
export type {
  LectureDocument,
  LectureMediaItem,
  LectureAttachment,
  AttachmentEntityType,
} from "./types";

// lecture-enrichment (волна 3) — публичная страница: exports + секции.
export { lectureExportUrls } from "./export-urls";
export type { LectureExportUrls } from "./export-urls";
export { LectureExportLinks } from "./ui/lecture-export-links";
export { LectureDocumentsSection } from "./ui/lecture-documents-section";
export { LectureMediaSection } from "./ui/lecture-media-section";
