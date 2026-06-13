// src/features/canvas/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";
import type { Canvas } from "./types";

/**
 * Локальный capability-чек: canvas.create / canvas.delete_any ЕЩЁ НЕ в union
 * `Capability` (`@/utils/permissions`) — это foundation-touch (мигрируем на
 * can() отдельным PR). До тех пор используем isMutationAllowed + членство в
 * capabilities напрямую (паттерн волн forms/trails/comments). Имена сверены с
 * philosophy-api internal/rbac/capabilities.go (CapCanvasCreate="canvas.create",
 * CapCanvasDeleteAny="canvas.delete_any").
 */
function hasCap(me: MaybeMe, cap: string): boolean {
  return isMutationAllowed(me) && me.capabilities.includes(cap);
}

/** Создание канваса — capability canvas.create. */
export function canCreateCanvas(me: MaybeMe): boolean {
  return hasCap(me, "canvas.create");
}

/**
 * Редактирование (title + data) — OWNER-ONLY без admin-override.
 * Бек: existing.OwnerID == actor.UserID (service.go Update).
 */
export function canEditCanvas(me: MaybeMe, canvas: Canvas): boolean {
  if (!isMutationAllowed(me)) return false;
  return canvas.owner_id === me.id;
}

/**
 * Смена видимости — OWNER, и только private→public (downgrade → 422
 * PUBLIC_IMMUTABLE). Кнопку показываем только владельцу приватного канваса.
 */
export function canChangeVisibility(me: MaybeMe, canvas: Canvas): boolean {
  if (!isMutationAllowed(me)) return false;
  if (canvas.owner_id !== me.id) return false;
  return canvas.visibility === "private";
}

/**
 * Удаление. Владелец — любая видимость. Admin с delete_any — только public
 * (чужой private → бек 404, кнопку не показываем).
 */
export function canDeleteCanvas(me: MaybeMe, canvas: Canvas): boolean {
  if (!isMutationAllowed(me)) return false;
  if (canvas.owner_id === me.id) return true;
  if (!me.capabilities.includes("canvas.delete_any")) return false;
  return canvas.visibility === "public";
}

/**
 * Ревизии бек создаёт только при мутации public-канваса. У private список
 * всегда пуст — секцию показываем только для public.
 */
export function canSeeRevisions(canvas: Canvas): boolean {
  return canvas.visibility === "public";
}
