import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
  getTerms,
  GlossaryAdminRow,
  GlossaryCreateForm,
  GlossarySearchForm,
} from "@/features/glossary";

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
  const result = await getTerms({
    ...(q ? { q } : {}),
    offset: offset ? Number(offset) : 0,
    limit: 50,
  });
  const sorted = [...result.items].sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? "", "ru")
  );

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Глоссарий</h1>
        <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
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
