// src/features/media/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed, ownerOrCap } from "@/utils/permissions";

import type { Media } from "./types";

/**
 * Имена capabilities — строго из philosophy-api internal/rbac/capabilities.go:
 *   media.create     — RoleUser + RoleAdmin
 *   media.delete_any — только RoleAdmin
 */

/** POST /api/media — загрузка нового медиа. */
export function canCreateMedia(me: MaybeMe): boolean {
  return can(me, "media.create");
}

/** Бланкетное admin-удаление любого медиа (для UI-веток admin-кнопок). */
export function canDeleteAnyMedia(me: MaybeMe): boolean {
  return can(me, "media.delete_any");
}

/**
 * Доступ к admin-списку неприватных медиа (GET /api/admin/media). Гейт
 * media.delete_any. Зеркало canModerateAnnotations: используется Layer-3-гейтом
 * страницы /admin/media и nav-итемом. Семантически совпадает с canDeleteAnyMedia,
 * но имя выражает намерение «модерация/доступ к списку», а не «может удалить любое».
 */
export function canModerateMedia(me: MaybeMe): boolean {
  return can(me, "media.delete_any");
}

/**
 * DELETE /api/media/{id}. Бек: owner ИЛИ media.delete_any. Для media
 * delete_any действует НЕЗАВИСИМО от видимости (§6.2 спеки;
 * philosophy-api internal/media/service.go:Delete).
 */
export function canDeleteMedia(me: MaybeMe, media: Media): boolean {
  return ownerOrCap(me, media.owner?.id, "media.delete_any");
}

/**
 * PATCH /api/media/{id}/visibility. Бек: только владелец, и только
 * private→public (public иммутабелен вниз, 422 PUBLIC_IMMUTABLE; §6.1).
 * Admin НЕ редактирует чужой контент (admin power split, §6.2) — поэтому
 * без delete_any-override здесь.
 */
export function canChangeMediaVisibility(me: MaybeMe, media: Media): boolean {
  if (!isMutationAllowed(me)) return false;
  if (media.owner?.id !== me.id) return false;
  return media.visibility === "private";
}
