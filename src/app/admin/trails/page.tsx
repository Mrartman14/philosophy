// src/app/admin/trails/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  canListAdminTrails,
  canAdminDeleteTrail,
  getAdminTrails,
  TrailAdminRow,
} from "@/features/trails";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("trailsMetaTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminTrailsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canListAdminTrails(me)) forbidden();

  const { offset } = await searchParams;
  const result = await getAdminTrails({ offset: parseNonNegativeInt(offset, 0), limit: 20 });

  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("trailsTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("trailsTotal", { total: result.total })}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((trail) => (
          <TrailAdminRow
            key={trail.id}
            trail={trail}
            canDelete={canAdminDeleteTrail(me, trail)}
          />
        ))}
      </ul>

      <Pagination
        basePath="/admin/trails"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
      />
    </section>
  );
}
