// src/app/admin/share-links/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import {
  ShareLookupForm,
  ShareLinkList,
  getAdminShareLinksFor,
  canModerateShareLinks,
  ShareLinkLookupSchema,
} from "@/features/share-links";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("shareLinksMetaTitle") };
}

interface Props {
  searchParams: Promise<{ resource_type?: string; resource_id?: string }>;
}

export default async function AdminShareLinksPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateShareLinks(me)) forbidden();

  const raw = await searchParams;
  const parsed = ShareLinkLookupSchema.safeParse(raw);

  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("shareLinksTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("shareLinksDescription")}
        </p>
      </header>

      <ShareLookupForm admin />

      {parsed.success ? (
        <ShareLinkList
          links={await getAdminShareLinksFor(
            parsed.data.resource_type,
            parsed.data.resource_id,
          )}
          resourceType={parsed.data.resource_type}
          resourceId={parsed.data.resource_id}
          admin
          showUrl={false}
        />
      ) : (
        <p className="text-sm text-(--color-fg-muted)">
          {t("shareLinksHint")}
        </p>
      )}
    </section>
  );
}

