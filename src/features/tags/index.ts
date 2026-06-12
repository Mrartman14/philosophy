// src/features/tags/index.ts
// Public API слайса.
export { getTags, getLectureTags } from "./api";
export type { TagListFilter, TagListResult } from "./api";
export { createTag, updateTag, deleteTag, setLectureTags } from "./actions";
export {
  canCreateTag,
  canUpdateTag,
  canDeleteTag,
  canAssignTags,
} from "./permissions";
export { TagCreateForm } from "./ui/tag-create-form";
export { TagAdminRow } from "./ui/tag-admin-row";
export { TagDeleteButton } from "./ui/tag-delete-button";
export { LectureTagsForm } from "./ui/lecture-tags-form";
export type { Tag } from "./types";
