// src/features/users/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

/**
 * Capability-имена строго из RBAC бекенда
 * (philosophy-api/internal/rbac/capabilities.go: user.list, user.moderate).
 * Status-чек (active) уже внутри can() — не дублировать.
 */

export function canListUsers(me: MaybeMe): boolean {
  return can(me, "user.list");
}

export function canModerateUsers(me: MaybeMe): boolean {
  return can(me, "user.moderate");
}
