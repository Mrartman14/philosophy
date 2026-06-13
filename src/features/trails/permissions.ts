// src/features/trails/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import type { Trail } from "./types";

/**
 * Имена capabilities сверены с philosophy-api internal/rbac/capabilities.go:
 * CapTrailCreate = "trail.create", CapTrailDeleteAny = "trail.delete_any".
 *
 * Локальный cap-чек вместо `can()` из @/utils/permissions: на момент написания
 * фичи union `Capability` ещё НЕ содержит trail.* (их добавит foundation-touch
 * волны 3 — см. docs/superpowers/plans/2026-06-12-trails.md, секция Foundation).
 * Чтобы воркдерево собиралось независимо, проверяем членство в me.capabilities
 * напрямую. Семантика идентична can(): null/не-active → false, статус-гейт
 * глобальный. После расширения union foundation-агент МОЖЕТ заменить hasTrailCap
 * на can(me, cap) — поведение не изменится.
 */
type TrailCapability = "trail.create" | "trail.delete_any";

function hasTrailCap(me: MaybeMe, cap: TrailCapability): boolean {
  if (!me || me.status !== "active") return false;
  return me.capabilities.includes(cap);
}

/** Создание маршрута — capability trail.create. */
export function canCreateTrail(me: MaybeMe): boolean {
  return hasTrailCap(me, "trail.create");
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
  if (!hasTrailCap(me, "trail.delete_any")) return false;
  return trail.visibility !== "private";
}

/**
 * Удаление из admin-списка: только delete_any и только НЕ-private (§6.2 спеки).
 * Admin-список (GET /api/admin/trails) и так отдаёт только public.
 */
export function canAdminDeleteTrail(me: MaybeMe, trail: Trail): boolean {
  if (!hasTrailCap(me, "trail.delete_any")) return false;
  return trail.visibility !== "private";
}

/** Доступ к admin-списку маршрутов. */
export function canListAdminTrails(me: MaybeMe): boolean {
  return hasTrailCap(me, "trail.delete_any");
}
