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
