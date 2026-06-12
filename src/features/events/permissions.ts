// src/features/events/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Имена capabilities — строго из internal/rbac/capabilities.go бекенда:
 * event.read / event.create / event.update / event.delete.
 *
 * Глобальный union Capability (src/utils/permissions.ts — frozen zone) ещё не
 * содержит event.* — его расширяет foundation-touch волны 1. До этого
 * membership проверяется локально; гейт «не гость + active» переиспользуется
 * из isMutationAllowed(), чтобы не дублировать статус-чек.
 */
type EventCapability =
  | "event.read"
  | "event.create"
  | "event.update"
  | "event.delete";

function hasEventCap(me: MaybeMe, cap: EventCapability): boolean {
  return isMutationAllowed(me) && me.capabilities.includes(cap);
}

/** Admin-GETы событий (список, карточка, .md/.txt) бек гейтит на event.read. */
export function canReadEvents(me: MaybeMe): boolean {
  return hasEventCap(me, "event.read");
}

export function canCreateEvent(me: MaybeMe): boolean {
  return hasEventCap(me, "event.create");
}

/**
 * Ревизионные эндпоинты (GET …/revisions*) бек гейтит на event.update —
 * секция ревизий в UI показывается по этому же чеку.
 */
export function canUpdateEvent(me: MaybeMe): boolean {
  return hasEventCap(me, "event.update");
}

export function canDeleteEvent(me: MaybeMe): boolean {
  return hasEventCap(me, "event.delete");
}
