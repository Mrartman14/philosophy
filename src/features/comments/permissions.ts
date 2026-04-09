import type { Comment } from "@/api/types";
import type { MaybeMe } from "@/utils/me";
import {
  can,
  isMutationAllowed,
  type DenyReason,
} from "@/utils/permissions";

export function canCreateComment(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

export function canEditComment(me: MaybeMe, comment: Comment): boolean {
  if (!isMutationAllowed(me)) return false;
  // Только владелец может редактировать. Модератор удаляет, но не редактирует
  // чужой контент — это сознательное ограничение, чтобы не было разрыва между
  // UI («кнопка показана») и бэком (вернёт 403 на edit foreign).
  return Boolean(comment.user_id && comment.user_id === me.id);
}

export function canDeleteComment(me: MaybeMe, comment: Comment): boolean {
  if (!isMutationAllowed(me)) return false;
  if (comment.user_id && comment.user_id === me.id) return true;
  // Модератор / админ может удалить чужой комментарий.
  return can(me, "comment.delete_any");
}

export function canReactToComment(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

export function canModerateComments(me: MaybeMe): boolean {
  return can(me, "comment.moderate");
}

/**
 * Причина, по которой нельзя оставить комментарий. `null` — можно.
 *
 * Используется для выбора UX (`<LoginCta>` для гостей,
 * `<ActionTooltip>` для suspended).
 */
export function whyCannotCreateComment(me: MaybeMe): DenyReason | null {
  if (!me) return "guest";
  if (me.status !== "active") return "status";
  return null;
}

/**
 * Причина, по которой нельзя поставить реакцию. Совпадает с `whyCannotCreateComment`,
 * но даём отдельную функцию для читаемости вызывающего кода.
 */
export function whyCannotReactToComment(me: MaybeMe): DenyReason | null {
  return whyCannotCreateComment(me);
}
