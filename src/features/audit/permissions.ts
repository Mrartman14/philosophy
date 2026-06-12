// src/features/audit/permissions.ts
import "server-only";
import type { components } from "@/api/schema";
import type { MaybeMe } from "@/utils/me";

/**
 * "audit.read" пока отсутствует в узком union Capability
 * (src/utils/permissions.ts — запретная зона, правится только
 * foundation-touch'ем волны), поэтому can() здесь недоступен. Чек локально
 * повторяет его семантику: гость → false, не-active → false, иначе
 * членство в capabilities. Константа типизирована против rbac.Capability
 * из сгенерированного schema.ts — typo ловит tsc.
 *
 * Foundation-touch волны 1: добавить "audit.read" в union Capability и
 * заменить тело на `can(me, "audit.read")`.
 */
const AUDIT_READ = "audit.read" satisfies components["schemas"]["rbac.Capability"];

export function canReadAudit(me: MaybeMe): boolean {
  if (!me) return false;
  if (me.status !== "active") return false;
  return me.capabilities.includes(AUDIT_READ);
}
