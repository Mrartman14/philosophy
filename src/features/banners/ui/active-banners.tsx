// src/features/banners/ui/active-banners.tsx
import { AstRender } from "@/components/ast-render";
import { getMe } from "@/utils/me";

import { getActiveBanners } from "../api";
import type { Banner } from "../types";

import { BannerDismissButton } from "./banner-dismiss-button";

/**
 * Site-wide показ активных баннеров. Вставляется в src/app/layout.tsx
 * foundation-touch-коммитом волны 1 (root layout — запретная зона, слайс
 * его не трогает).
 *
 * Аудиторию (all/authenticated/admin) и dismissed-фильтр считает БЕК
 * (GET /api/banners/active, optionalAuth) — фронт ничего не фильтрует.
 *
 * Graceful degradation: бек недоступен или токен в cookie протух
 * (optionalAuth отвечает 401 на невалидный Bearer) → рендерим null,
 * сайт живёт дальше.
 */
export async function ActiveBanners() {
  let banners: Banner[];
  let authenticated = false;
  try {
    const me = await getMe();
    authenticated = me !== null;
    banners = await getActiveBanners();
  } catch {
    return null;
  }
  if (banners.length === 0) return null;

  return (
    <aside aria-label="Объявления" className="w-full">
      {banners.map((banner) =>
        banner.id ? (
          <div
            key={banner.id}
            style={{ backgroundColor: banner.background_color }}
            className="flex w-full items-start justify-between gap-3 border-b border-(--color-border) px-4 py-2"
          >
            <div className="prose min-w-0 flex-1 text-sm">
              <AstRender blocks={banner.blocks ?? []} />
            </div>
            {authenticated && banner.dismissible !== false && (
              <BannerDismissButton id={banner.id} />
            )}
          </div>
        ) : null,
      )}
    </aside>
  );
}
