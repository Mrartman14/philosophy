// src/features/tags/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

/**
 * Имена capability сверены с philosophy-api
 * `internal/rbac/capabilities.go` (CapTagCreate/CapTagUpdate/CapTagDelete/CapTagAssign).
 *
 * Чек делегирован `can()`: гость → false, не-active → false, иначе членство
 * в списке capabilities. Status-гейт не дублируем — он внутри `can()`.
 */
export function canCreateTag(me: MaybeMe): boolean {
  return can(me, "tag.create");
}

export function canUpdateTag(me: MaybeMe): boolean {
  return can(me, "tag.update");
}

export function canDeleteTag(me: MaybeMe): boolean {
  return can(me, "tag.delete");
}

export function canAssignTags(me: MaybeMe): boolean {
  return can(me, "tag.assign");
}
