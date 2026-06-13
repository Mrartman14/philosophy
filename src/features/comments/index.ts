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
