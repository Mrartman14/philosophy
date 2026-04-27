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
