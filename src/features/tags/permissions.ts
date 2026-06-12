// src/features/tags/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Имена capability сверены с philosophy-api
 * `internal/rbac/capabilities.go` (CapTagCreate/CapTagUpdate/CapTagDelete/CapTagAssign).
 *
 * Union `Capability` в `src/utils/permissions.ts` (запретная зона) пока не
 * содержит `tag.*`, поэтому чек написан через `isMutationAllowed` +
 * `capabilities.includes(...)` — это в точности семантика `can()`:
 * гость → false, не-active → false, иначе членство в списке capabilities.
 * После foundation-touch волны 1 (расширение union) перевести на `can()`.
 */
const TAG_CREATE = "tag.create";
const TAG_UPDATE = "tag.update";
const TAG_DELETE = "tag.delete";
const TAG_ASSIGN = "tag.assign";

function hasTagCapability(me: MaybeMe, capability: string): boolean {
  return isMutationAllowed(me) && me.capabilities.includes(capability);
}

export function canCreateTag(me: MaybeMe): boolean {
  return hasTagCapability(me, TAG_CREATE);
}

export function canUpdateTag(me: MaybeMe): boolean {
  return hasTagCapability(me, TAG_UPDATE);
}

export function canDeleteTag(me: MaybeMe): boolean {
  return hasTagCapability(me, TAG_DELETE);
}

export function canAssignTags(me: MaybeMe): boolean {
  return hasTagCapability(me, TAG_ASSIGN);
}
