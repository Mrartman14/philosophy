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
