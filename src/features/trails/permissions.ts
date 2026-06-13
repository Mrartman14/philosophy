// src/features/trails/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";
import type { Trail } from "./types";

/**
 * Имена capabilities сверены с philosophy-api internal/rbac/capabilities.go
 * (CapTrailCreate = "trail.create", CapTrailDeleteAny = "trail.delete_any");
 * typo ловит tsc через union `Capability`. Чистые cap-чеки делегированы
 * `can()`: гость → false, не-active → false, иначе членство в capabilities
 * (status-гейт внутри can()). Owner-aware хелперы ниже комбинируют
 * can()-семантику с owner_id вручную.
 */

/** Создание маршрута — capability trail.create. */
export function canCreateTrail(me: MaybeMe): boolean {
  return can(me, "trail.create");
}

/**
 * Редактирование (title/description, items, visibility) — OWNER-ONLY без
 * admin-override (service.go: who.UserID == t.OwnerID). Статус-гейт обязателен.
 */
export function canEditTrail(me: MaybeMe, trail: Trail): boolean {
  if (!me || me.status !== "active") return false;
  return trail.owner_id === me.id;
}

/**
 * Удаление со страницы маршрута. Владелец — любая видимость. Admin с delete_any —
 * только НЕ-private (private чужой → бек вернёт 404, кнопку не показываем).
 */
export function canDeleteTrail(me: MaybeMe, trail: Trail): boolean {
  if (!me || me.status !== "active") return false;
  if (trail.owner_id === me.id) return true;
  if (!can(me, "trail.delete_any")) return false;
  return trail.visibility !== "private";
}

/**
 * Удаление из admin-списка: только delete_any и только НЕ-private (§6.2 спеки).
 * Admin-список (GET /api/admin/trails) и так отдаёт только public.
 */
export function canAdminDeleteTrail(me: MaybeMe, trail: Trail): boolean {
  if (!can(me, "trail.delete_any")) return false;
  return trail.visibility !== "private";
}

/** Доступ к admin-списку маршрутов. */
export function canListAdminTrails(me: MaybeMe): boolean {
  return can(me, "trail.delete_any");
}
