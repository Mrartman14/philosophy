// src/features/preferences/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

/**
 * Изменение собственных настроек: любой залогиненный active-пользователь.
 * Бекенд гейтит только RequireMutator (suspended → 403 SUSPENDED),
 * специальной capability нет.
 */
export function canUpdatePreferences(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

/** Подписка/отписка на push: любой залогиненный active-пользователь. */
export function canSubscribePush(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

/**
 * Админская рассылка. Имя capability сверено с бекендом:
 * internal/rbac/capabilities.go:29 (CapPushSend = "push.send").
 */
export function canSendPush(me: MaybeMe): boolean {
  return can(me, "push.send");
}
