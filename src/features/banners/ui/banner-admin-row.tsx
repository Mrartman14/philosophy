// src/features/banners/ui/banner-admin-row.tsx
import Link from "next/link";
import {
  audienceLabel,
  bannerPreviewText,
  formatBannerPeriod,
} from "../display";
import type { Banner } from "../types";
import { BannerDeleteButton } from "./banner-delete-button";
import { BannerExportLinks } from "./banner-export-links";

interface Props {
  banner: Banner;
  canEdit: boolean;
  canDelete: boolean;
}

export function BannerAdminRow({ banner, canEdit, canDelete }: Props) {
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
            {preview || "Баннер без текста"}
          </span>
          <span className="text-xs text-(--color-description)">
            {formatBannerPeriod(banner.start_at, banner.end_at)}
            {` · ${audienceLabel(banner.target_audience)}`}
            {banner.dismissible === false ? " · нельзя скрыть" : ""}
            {banner.event_id ? " · привязан к событию" : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {banner.id && <BannerExportLinks id={banner.id} />}
        {canEdit && banner.id && (
          <Link
            href={`/admin/banners/${banner.id}/edit`}
            className="text-sm hover:underline"
          >
            Редактировать
          </Link>
        )}
        {canDelete && banner.id && <BannerDeleteButton id={banner.id} />}
      </div>
    </li>
  );
}
