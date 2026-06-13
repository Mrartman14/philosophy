// src/features/lectures/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

export function canCreateLecture(me: MaybeMe): boolean {
  return can(me, "lecture.create");
}

export function canUpdateLecture(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

export function canSetLectureVisibility(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

export function canDeleteLecture(me: MaybeMe): boolean {
  return can(me, "lecture.delete");
}

/**
 * Управление обложкой (set/clear cover) — OWNER-ONLY без admin-override.
 * Бек (internal/lecture/service.go SetCover/ClearCover): lec.OwnerID ==
 * actor.UserID, никакой capability не проверяется. Status-гейт обязателен.
 */
export function canManageCover(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

/**
 * Detach/reorder прикреплений — OWNER-ONLY (бек: только ownership лекции,
 * capability НЕ проверяется — internal/attachment/service.go).
 */
export function canManageAttachments(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

/**
 * Attach (POST) — capability entity.attach И ownership лекции (оба условия,
 * §6.3 спеки; бек internal/attachment/service.go). can() уже проверяет
 * status==active.
 */
export function canAttachToLecture(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  // isMutationAllowed сужает me к NonNullable (тип-гард) и проверяет
  // status==active; can() покрывает наличие capability.
  if (!isMutationAllowed(me)) return false;
  if (!can(me, "entity.attach")) return false;
  return lecture.owner_id === me.id;
}
