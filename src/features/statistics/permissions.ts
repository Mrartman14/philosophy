// src/features/statistics/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Изменение собственных настроек истории просмотров: любой залогиненный
 * active-пользователь. Бэк гейтит только RequireMutator (suspended → 403
 * SUSPENDED), специальной capability нет.
 */
export function canManageOwnHistory(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
