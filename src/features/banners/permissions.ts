// src/features/banners/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

/**
 * Имена capabilities — строго из internal/rbac/capabilities.go бекенда:
 * banner.read / banner.create / banner.update / banner.delete.
 *
 * banner.view_admin_audience фронт НЕ проверяет: фильтрацию аудитории в
 * GET /api/banners/active делает бек (internal/banner/service.go ListActive).
 *
 * Чек делегирован `can()`: гость → false, не-active → false, иначе членство
 * в списке capabilities. Status-гейт не дублируем — он внутри `can()`.
 */

/** Admin-GETы баннеров (список, карточка, .md/.txt) бек гейтит на banner.read. */
export function canReadBanners(me: MaybeMe): boolean {
  return can(me, "banner.read");
}

export function canCreateBanner(me: MaybeMe): boolean {
  return can(me, "banner.create");
}

/**
 * Ревизионные эндпоинты (GET …/revisions*) бек гейтит на banner.update —
 * секция ревизий в UI показывается по этому же чеку.
 */
export function canUpdateBanner(me: MaybeMe): boolean {
  return can(me, "banner.update");
}

export function canDeleteBanner(me: MaybeMe): boolean {
  return can(me, "banner.delete");
}

/**
 * Dismiss на беке — requiredAuth БЕЗ capability (POST /api/banners/{id}/dismiss):
 * любой авторизованный active-пользователь. Видимость по аудитории
 * дополнительно проверяет бек (admin-баннер без view_admin_audience → 404).
 */
export function canDismissBanner(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
