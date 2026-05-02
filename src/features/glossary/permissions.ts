import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

export function canCreateTerm(me: MaybeMe): boolean {
  return can(me, "glossary.create");
}

export function canUpdateTerm(me: MaybeMe): boolean {
  return can(me, "glossary.update");
}

export function canDeleteTerm(me: MaybeMe): boolean {
  return can(me, "glossary.delete");
}
