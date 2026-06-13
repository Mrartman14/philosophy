// src/features/comments/index.ts
export {
  getCommentSchema,
  getLectureComments,
  getCommentSubtree,
  searchComments,
  getCommentRevisions,
  getCommentRevision,
  getBlock,
  getAdminLectureComments,
} from "./api";
export type {
  CommentListResult,
  SearchResult,
} from "./api";

export {
  createComment,
  updateCommentBlocks,
  deleteComment,
  adminDeleteComment,
  setReaction,
  removeReaction,
} from "./actions";

export {
  canCreateComment,
  canEditComment,
  canDeleteComment,
  canReactToComment,
  canSearchComments,
  canModerateComments,
} from "./permissions";

export {
  REACTION_AXES,
  axisAllowedForType,
  axisLabel,
  axisValueLabel,
} from "./reactions";

export type {
  Comment,
  RootSubtree,
  CommentType,
  ReactionAxis,
  ReactionSummary,
  MyReactions,
  CommentSummary,
  CommentSchema,
  CommentRevision,
  CommentRevisionMeta,
  AstBlock,
  ResolvedBlock,
} from "./types";

export { CommentSection } from "./ui/comment-section";
export { CommentTree } from "./ui/comment-tree";
export { CommentRevisions } from "./ui/comment-revisions";
export { CommentExportLinks } from "./ui/comment-export-links";
export { AdminCommentRow } from "./ui/admin-comment-row";
export { commentTypeLabel } from "./ui/comment-type-badge";
