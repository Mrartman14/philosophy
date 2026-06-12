// src/features/banners/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Имена capabilities — строго из internal/rbac/capabilities.go бекенда:
 * banner.read / banner.create / banner.update / banner.delete.
 *
 * banner.view_admin_audience фронт НЕ проверяет: фильтрацию аудитории в
 * GET /api/banners/active делает бек (internal/banner/service.go ListActive).
 *
 * Глобальный union Capability (src/utils/permissions.ts — frozen zone) ещё не
 * содержит banner.* — его расширяет foundation-touch волны 1. До этого
 * membership проверяется локально; гейт «не гость + active» переиспользуется
 * из isMutationAllowed(), чтобы не дублировать статус-чек.
 */
type BannerCapability =
  | "banner.read"
  | "banner.create"
  | "banner.update"
  | "banner.delete";

function hasBannerCap(me: MaybeMe, cap: BannerCapability): boolean {
  return isMutationAllowed(me) && me.capabilities.includes(cap);
}

/** Admin-GETы баннеров (список, карточка, .md/.txt) бек гейтит на banner.read. */
export function canReadBanners(me: MaybeMe): boolean {
  return hasBannerCap(me, "banner.read");
}

export function canCreateBanner(me: MaybeMe): boolean {
  return hasBannerCap(me, "banner.create");
}

/**
 * Ревизионные эндпоинты (GET …/revisions*) бек гейтит на banner.update —
 * секция ревизий в UI показывается по этому же чеку.
 */
export function canUpdateBanner(me: MaybeMe): boolean {
  return hasBannerCap(me, "banner.update");
}

export function canDeleteBanner(me: MaybeMe): boolean {
  return hasBannerCap(me, "banner.delete");
}

/**
 * Dismiss на беке — requiredAuth БЕЗ capability (POST /api/banners/{id}/dismiss):
 * любой авторизованный active-пользователь. Видимость по аудитории
 * дополнительно проверяет бек (admin-баннер без view_admin_audience → 404).
 */
export function canDismissBanner(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
