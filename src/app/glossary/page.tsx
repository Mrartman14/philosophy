import {
  getTerms,
  GlossaryExportLinks,
  GlossaryList,
  GlossarySearchForm,
} from "@/features/glossary";

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function GlossaryIndexPage({ searchParams }: Props) {
  const { q, offset } = await searchParams;
  const result = await getTerms({
    ...(q ? { q } : {}),
    offset: offset ? Number(offset) : 0,
    limit: 50,
  });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Глоссарий</h1>
      <GlossarySearchForm defaultQ={q ?? ""} />
      <GlossaryList items={result.items} total={result.total} />
      <GlossaryExportLinks />
    </main>
  );
}

export const metadata = { title: "Глоссарий" };
