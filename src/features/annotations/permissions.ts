import type { Annotation } from "@/api/types";
import type { MaybeMe } from "@/utils/me";
import {
  can,
  isMutationAllowed,
  type DenyReason,
} from "@/utils/permissions";

export function canCreateAnnotation(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

export function canEditAnnotation(
  me: MaybeMe,
  annotation: Annotation
): boolean {
  if (!isMutationAllowed(me)) return false;
  // Только владелец редактирует. См. комментарий в canEditComment про
  // намеренный разрыв «модератор удаляет, но не редактирует».
  return Boolean(annotation.user_id && annotation.user_id === me.id);
}

export function canDeleteAnnotation(
  me: MaybeMe,
  annotation: Annotation
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (annotation.user_id && annotation.user_id === me.id) return true;
  return can(me, "annotation.delete_any");
}

export function canModerateAnnotations(me: MaybeMe): boolean {
  return can(me, "annotation.moderate");
}

export function whyCannotCreateAnnotation(me: MaybeMe): DenyReason | null {
  if (!me) return "guest";
  if (me.status !== "active") return "status";
  return null;
}
