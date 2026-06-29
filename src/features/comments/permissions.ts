// src/features/comments/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed, ownerOrCap } from "@/utils/permissions";

import type { Comment } from "./types";

/**
 * Создание комментария: гейт `comment.create` (есть у user И admin; сверено с
 * philosophy-api internal/rbac/capabilities.go — CapCommentCreate). Чек
 * делегирован `can()`: гость → false, не-active → false, иначе членство в
 * capabilities (status-гейт внутри can()).
 */
export function canCreateComment(me: MaybeMe): boolean {
  return can(me, "comment.create");
}

/**
 * Редактирование blocks — owner-only, без admin-override
 * (бек: service.go Update → c.UserID == me.id). Удалённый — нельзя.
 */
export function canEditComment(
  me: MaybeMe,
  comment: Pick<Comment, "author" | "is_deleted">,
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (comment.is_deleted) return false;
  return comment.author?.id === me.id;
}

/**
 * Удаление — owner ИЛИ admin с `comment.delete_any`.
 * Для comments delete_any действует НЕЗАВИСИМО от видимости/периметра лекции
 * (спека §6.2). Уже удалённый — нельзя (бек: 422 COMMENT_DELETED).
 */
export function canDeleteComment(
  me: MaybeMe,
  comment: Pick<Comment, "author" | "is_deleted">,
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (comment.is_deleted) return false;
  return ownerOrCap(me, comment.author?.id, "comment.delete_any");
}

/**
 * Реакция — любой active-пользователь на ЧУЖОЙ не-удалённый комментарий.
 * Свой → 403 SELF_REACTION (бек), поэтому прячем кнопки на своих.
 */
export function canReactToComment(
  me: MaybeMe,
  comment: Pick<Comment, "author" | "is_deleted">,
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (comment.is_deleted) return false;
  return comment.author?.id !== me.id;
}

/** Поиск по комментариям лекции требует auth (бек: requiredAuth). */
export function canSearchComments(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

/** Admin-модерация (GET /api/admin/comments, admin delete) — comment.delete_any. */
export function canModerateComments(me: MaybeMe): boolean {
  return can(me, "comment.delete_any");
}
