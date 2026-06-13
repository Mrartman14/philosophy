// src/features/trails/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed, ownerOrCap } from "@/utils/permissions";
import type { Trail } from "./types";

/**
 * Имена capabilities сверены с philosophy-api internal/rbac/capabilities.go
 * (CapTrailCreate = "trail.create", CapTrailDeleteAny = "trail.delete_any");
 * typo ловит tsc через union `Capability`. Чистые cap-чеки делегированы
 * `can()` (status-гейт внутри). Owner-aware-комбинации — через `ownerOrCap` /
 * `isMutationAllowed`.
 */

/** Создание маршрута — capability trail.create. */
export function canCreateTrail(me: MaybeMe): boolean {
  return can(me, "trail.create");
}

/**
 * Редактирование (title/description, items, visibility) — OWNER-ONLY без
 * admin-override (service.go: who.UserID == t.OwnerID).
 */
export function canEditTrail(me: MaybeMe, trail: Trail): boolean {
  return isMutationAllowed(me) && trail.owner_id === me.id;
}

/**
 * Удаление со страницы маршрута. Владелец — любая видимость. Admin с delete_any —
 * только public (private чужой → бек вернёт 404, кнопку не показываем).
 */
export function canDeleteTrail(me: MaybeMe, trail: Trail): boolean {
  return ownerOrCap(
    me,
    trail.owner_id,
    "trail.delete_any",
    () => trail.visibility === "public",
  );
}

/**
 * Удаление из admin-списка: только delete_any и только public (§6.2 спеки).
 * Admin-список (GET /api/admin/trails) и так отдаёт только public.
 */
export function canAdminDeleteTrail(me: MaybeMe, trail: Trail): boolean {
  return can(me, "trail.delete_any") && trail.visibility === "public";
}

/** Доступ к admin-списку маршрутов. */
export function canListAdminTrails(me: MaybeMe): boolean {
  return can(me, "trail.delete_any");
}
