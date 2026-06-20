// src/app/admin/tags/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { EmptyState, Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  canCreateTag,
  canDeleteTag,
  canUpdateTag,
  getTags,
  TagAdminRow,
  TagCreateForm,
} from "@/features/tags";
import { getT, getLocale } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("tagsMetaTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminTagsPage({ searchParams }: Props) {
  const me = await getMe();
  const canCreate = canCreateTag(me);
  const canUpdate = canUpdateTag(me);
  const canDelete = canDeleteTag(me);
  if (!canCreate && !canUpdate && !canDelete) forbidden();

  const { offset } = await searchParams;
  const safeOffset = parseNonNegativeInt(offset, 0);

  // Admin-GET на беке не существует — список из публичного GET /api/tags.
  const [result, locale, t] = await Promise.all([
    getTags({ offset: safeOffset, limit: 100 }),
    getLocale(),
    getT("admin"),
  ]);
  const sorted = [...result.items].sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );

  const paginationLabels = await getPaginationLabels();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("tagsTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("tagsTotal", { total: result.total })}</p>
      </header>

      {canCreate && <TagCreateForm />}

      {sorted.length === 0 ? (
        <EmptyState
          title={t("tagsEmptyTitle")}
          description={canCreate ? t("tagsEmptyDescription") : undefined}
        />
      ) : (
        <ul className="flex max-w-xl flex-col divide-y divide-(--color-border)">
          {sorted.map((tag) => (
            <TagAdminRow
              key={tag.id ?? tag.name}
              tag={tag}
              canEdit={canUpdate}
              canDelete={canDelete}
            />
          ))}
        </ul>
      )}

      {result.total > result.limit && (
        <Pagination
          basePath="/admin/tags"
          offset={result.offset}
          limit={result.limit}
          total={result.total}
          labels={paginationLabels}
        />
      )}
    </section>
  );
}
