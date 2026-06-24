import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { RouterLink } from "@/components/ui";
import {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
  getTerms,
  GlossaryAdminRow,
  GlossarySearchForm,
} from "@/features/glossary";
import { getT, getLocale } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("glossaryMetaTitle") };
}

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function AdminGlossaryPage({ searchParams }: Props) {
  const me = await getMe();
  const canCreate = canCreateTerm(me);
  const canUpdate = canUpdateTerm(me);
  const canDelete = canDeleteTerm(me);
  if (!canCreate && !canUpdate && !canDelete) forbidden();

  const { q, offset } = await searchParams;
  const [result, locale, t] = await Promise.all([
    getTerms({
      ...(q ? { q } : {}),
      offset: parseNonNegativeInt(offset, 0),
      limit: 50,
    }),
    getLocale(),
    getT("admin"),
  ]);
  const sorted = [...result.items].sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? "", locale)
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("glossaryTitle")}</h1>
          <p className="text-sm text-(--color-fg-muted)">{t("glossaryTotal", { total: result.total })}</p>
        </div>
        {canCreate && (
          <RouterLink
            href="/admin/glossary/new"
            className="inline-flex shrink-0 items-center rounded bg-(--color-fg) px-4 py-2 text-sm font-medium text-(--color-surface) hover:opacity-90"
          >
            {t("glossaryCreateLink")}
          </RouterLink>
        )}
      </header>

      <GlossarySearchForm defaultQ={q ?? ""} />

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {sorted.map((term) => (
          <GlossaryAdminRow
            key={term.id}
            term={term}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        ))}
      </ul>
    </section>
  );
}

