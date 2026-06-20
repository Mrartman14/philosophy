// src/features/banners/ui/banner-admin-row.tsx
import { RouterLink } from "@/components/ui";
import { getT, getLocale } from "@/i18n";

import {
  bannerPreviewText,
  formatBannerPeriod,
  audienceLabel,
} from "../display";
import type { Banner } from "../types";

import { BannerDeleteButton } from "./banner-delete-button";
import { BannerExportLinks } from "./banner-export-links";

interface Props {
  banner: Banner;
  canEdit: boolean;
  canDelete: boolean;
}

export async function BannerAdminRow({ banner, canEdit, canDelete }: Props) {
  const [t, locale] = await Promise.all([getT("banners"), getLocale()]);
  const preview = bannerPreviewText(banner.blocks);
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded border border-(--color-border)"
          style={{ backgroundColor: banner.background_color }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">
            {preview || t("noText")}
          </span>
          <span className="text-xs text-(--color-fg-muted)">
            {formatBannerPeriod(banner.start_at, banner.end_at, locale)}
            {` · ${audienceLabel(banner.target_audience)}`}
            {banner.dismissible === false ? t("notDismissible") : ""}
            {banner.event_id ? t("hasEvent") : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {banner.id && <BannerExportLinks id={banner.id} />}
        {canEdit && banner.id && (
          <RouterLink
            href={`/admin/banners/${banner.id}/edit`}
            className="text-sm hover:underline"
          >
            {t("btnEdit")}
          </RouterLink>
        )}
        {canDelete && banner.id && <BannerDeleteButton id={banner.id} />}
      </div>
    </li>
  );
}
