// src/app/admin/banners/[id]/edit/page.tsx
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
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
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("bannerEditMetaTitle") };
}

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

  const astSchema = canUpdate ? await getAstSchema() : null;

  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="truncate text-2xl font-bold">
          {bannerPreviewText(banner.blocks, 60) || t("bannerFallbackTitle")}
        </h1>
        {banner.id && <BannerExportLinks id={banner.id} />}
      </header>

      {canUpdate && (
        <SchemaContextProvider initial={astSchema ?? undefined}>
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
