// src/features/notifications/permissions.ts
import "server-only";

import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/** Чтение своих уведомлений: нужен залогиненный (active решает бек). */
export function canUseNotifications(me: MaybeMe): boolean {
  return me !== null;
}

/** Подписки и отметки прочтения: залогинен + active. */
export function canManageSubscriptions(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
