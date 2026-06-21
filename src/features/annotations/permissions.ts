// src/features/annotations/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

import type { Annotation } from "./types";

/**
 * Создание аннотации. Бек требует capability `annotation.create`
 * (philosophy-api internal/rbac/capabilities.go — CapAnnotationCreate: есть у
 * роли user и admin). Чек делегирован `can()`: гость → false, не-active →
 * false, иначе членство в capabilities (status-гейт внутри can()).
 */
export function canCreateAnnotation(me: MaybeMe): boolean {
  return can(me, "annotation.create");
}

/**
 * Редактировать может ТОЛЬКО автор (бек: PUT /api/annotations/{id} — owner-only,
 * без admin-override). Status-гейт через isMutationAllowed.
 */
export function canEditAnnotation(
  me: MaybeMe,
  annotation: Pick<Annotation, "owner_id">,
): boolean {
  return isMutationAllowed(me) && annotation.owner_id === me.id;
}

/**
 * Удалить свою (любой видимости) может только автор
 * (DELETE /api/annotations/{id}). Админское удаление — отдельный хелпер.
 */
export function canDeleteAnnotation(
  me: MaybeMe,
  annotation: Pick<Annotation, "owner_id">,
): boolean {
  return isMutationAllowed(me) && annotation.owner_id === me.id;
}

/**
 * Admin-удаление через DELETE /api/admin/annotations/{id}. Капа
 * `annotation.delete_any` действует ТОЛЬКО на public (§6.2): для private бек
 * вернёт 404 (secure-by-default). UI прячем для private.
 */
export function canAdminDeleteAnnotation(
  me: MaybeMe,
  annotation: Annotation,
): boolean {
  return can(me, "annotation.delete_any") && annotation.visibility === "public";
}

/** Доступ к admin-списку публичных аннотаций (гейт annotation.delete_any). */
export function canModerateAnnotations(me: MaybeMe): boolean {
  return can(me, "annotation.delete_any");
}
