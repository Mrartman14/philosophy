// src/app/admin/banners/[id]/edit/page.tsx
import { forbidden, notFound } from "next/navigation";

import { SchemaContextProvider } from "@/components/ast-editor";
import {
  canDeleteBanner,
  canReadBanners,
  canUpdateBanner,
  getAdminBannerById,
  bannerPreviewText,
  BannerDeleteButton,
  BannerEditForm,
  BannerExportLinks,
  BannerRevisions,
} from "@/features/banners";
import { getMe } from "@/utils/me";

export const metadata = { title: "Баннеры — редактирование" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export default async function AdminBannerEditPage({
  params,
  searchParams,
}: Props) {
  const me = await getMe();
  if (!canReadBanners(me)) forbidden();
  const canUpdate = canUpdateBanner(me);
  const canDelete = canDeleteBanner(me);

  const { id } = await params;
  const { revision } = await searchParams;
  const banner = await getAdminBannerById(id);
  if (!banner) notFound();

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-bold">
          {bannerPreviewText(banner.blocks, 60) || "Баннер"}
        </h1>
        {banner.id && <BannerExportLinks id={banner.id} />}
      </header>

      {canUpdate && (
        <SchemaContextProvider>
          <BannerEditForm banner={banner} />
        </SchemaContextProvider>
      )}

      {/* Ревизионные эндпоинты бек гейтит на banner.update — секция видна
          по тому же чеку. */}
      {canUpdate && banner.id && (
        <BannerRevisions bannerId={banner.id} selectedRevisionId={revision} />
      )}

      {canDelete && banner.id && (
        <div>
          <BannerDeleteButton id={banner.id} />
        </div>
      )}
    </section>
  );
}
