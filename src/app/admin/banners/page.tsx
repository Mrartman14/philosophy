// src/app/admin/banners/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { Pagination } from "@/components/ui";
import { parseNonNegativeInt } from "@/utils/paging";
import {
  canCreateBanner,
  canDeleteBanner,
  canReadBanners,
  canUpdateBanner,
  getAdminBanners,
  BannerAdminRow,
  BannerCreateForm,
} from "@/features/banners";

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

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Баннеры</h1>
        <p className="text-sm text-(--color-description)">
          Всего: {result.total}
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
      />
    </section>
  );
}

export const metadata = { title: "Баннеры — админ" };
