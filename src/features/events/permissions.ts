// src/features/events/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

/**
 * Имена capabilities — строго из internal/rbac/capabilities.go бекенда:
 * event.read / event.create / event.update / event.delete.
 *
 * Чек делегирован `can()`: гость → false, не-active → false, иначе членство
 * в списке capabilities. Status-гейт не дублируем — он внутри `can()`.
 */

/** Admin-GETы событий (список, карточка, .md/.txt) бек гейтит на event.read. */
export function canReadEvents(me: MaybeMe): boolean {
  return can(me, "event.read");
}

export function canCreateEvent(me: MaybeMe): boolean {
  return can(me, "event.create");
}

/**
 * Ревизионные эндпоинты (GET …/revisions*) бек гейтит на event.update —
 * секция ревизий в UI показывается по этому же чеку.
 */
export function canUpdateEvent(me: MaybeMe): boolean {
  return can(me, "event.update");
}

export function canDeleteEvent(me: MaybeMe): boolean {
  return can(me, "event.delete");
}
