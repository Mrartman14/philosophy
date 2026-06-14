// src/features/canvas/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed, ownerOrCap } from "@/utils/permissions";

import type { Canvas } from "./types";

/**
 * canvas.create / canvas.delete_any теперь в union `Capability`
 * (`@/utils/permissions`) — плоские cap-чеки идут через `can()` (он уже
 * проверяет status === "active"). Owner-aware-комбинации остаются здесь.
 * Имена сверены с philosophy-api internal/rbac/capabilities.go
 * (CapCanvasCreate="canvas.create", CapCanvasDeleteAny="canvas.delete_any").
 */

/** Создание канваса — capability canvas.create. */
export function canCreateCanvas(me: MaybeMe): boolean {
  return can(me, "canvas.create");
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
  return ownerOrCap(
    me,
    canvas.owner_id,
    "canvas.delete_any",
    () => canvas.visibility === "public",
  );
}

/**
 * Ревизии бек создаёт только при мутации public-канваса. У private список
 * всегда пуст — секцию показываем только для public.
 */
export function canSeeRevisions(canvas: Canvas): boolean {
  return canvas.visibility === "public";
}
