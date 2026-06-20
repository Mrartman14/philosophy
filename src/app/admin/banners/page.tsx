// src/app/admin/banners/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  canCreateBanner,
  canDeleteBanner,
  canReadBanners,
  canUpdateBanner,
  getAdminBanners,
  BannerAdminRow,
  BannerCreateForm,
} from "@/features/banners";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("bannersMetaTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminBannersPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canReadBanners(me)) forbidden();
  const canCreate = canCreateBanner(me);
  const canUpdate = canUpdateBanner(me);
  const canDelete = canDeleteBanner(me);

  const { offset } = await searchParams;
  const result = await getAdminBanners({
    offset: parseNonNegativeInt(offset, 0),
    limit: 20,
  });

  const t = await getT("admin");

  const paginationLabels = await getPaginationLabels();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("bannersTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("bannersTotal", { total: result.total })}
        </p>
      </header>

      {canCreate && <BannerCreateForm />}

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((banner) => (
          <BannerAdminRow
            key={banner.id}
            banner={banner}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        ))}
      </ul>

      <Pagination
        basePath="/admin/banners"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
        labels={paginationLabels}
      />
    </section>
  );
}

