import { forbidden } from "next/navigation";

import {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
  getTerms,
  GlossaryAdminRow,
  GlossaryCreateForm,
  GlossarySearchForm,
} from "@/features/glossary";
import { getT, getLocale } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

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
      <header>
        <h1 className="text-2xl font-bold">{t("glossaryTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("glossaryTotal", { total: result.total })}</p>
      </header>

      {canCreate && <GlossaryCreateForm />}

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

export const metadata = { title: "Глоссарий — админ" };
