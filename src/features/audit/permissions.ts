// src/features/audit/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

/**
 * "audit.read" сверен с philosophy-api internal/rbac/capabilities.go
 * (CapAuditRead); typo ловит tsc через union `Capability`. Чек делегирован
 * `can()`: гость → false, не-active → false, иначе членство в capabilities.
 */
export function canReadAudit(me: MaybeMe): boolean {
  return can(me, "audit.read");
}
