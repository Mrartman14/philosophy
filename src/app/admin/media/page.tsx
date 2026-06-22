// src/app/admin/media/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import { getAdminMedia, canModerateMedia, MediaAdminRow } from "@/features/media";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("mediaMetaTitle") };
}

interface Props {
  searchParams: Promise<{
    owner_id?: string;
    offset?: string;
  }>;
}

const LIMIT = 20;

export default async function AdminMediaPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateMedia(me)) forbidden();

  const sp = await searchParams;
  const offset = parseNonNegativeInt(sp.offset, 0);
  const { items, total } = await getAdminMedia({
    offset,
    limit: LIMIT,
    ...(sp.owner_id ? { owner_id: sp.owner_id } : {}),
  });

  const t = await getT("admin");
  const paginationLabels = await getPaginationLabels();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("mediaTitle")}</h1>
      <p className="text-sm text-(--color-fg-muted)">{t("mediaDescription")}</p>
      <p className="text-sm text-(--color-fg-muted)">{t("mediaTotal", { total })}</p>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("mediaEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((m) => (
            <li key={m.id}>
              <MediaAdminRow media={m} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        basePath="/admin/media"
        offset={offset}
        limit={LIMIT}
        total={total}
        searchParams={sp}
        labels={paginationLabels}
      />
    </section>
  );
}
