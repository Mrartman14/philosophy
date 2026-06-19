import {
  getTerms,
  GlossaryExportLinks,
  GlossaryList,
  GlossarySearchForm,
} from "@/features/glossary";
import { getT } from "@/i18n";
import { parseNonNegativeInt } from "@/utils/paging";

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("glossaryTitle") };
}

export default async function GlossaryIndexPage({ searchParams }: Props) {
  const { q, offset } = await searchParams;
  const result = await getTerms({
    ...(q ? { q } : {}),
    offset: parseNonNegativeInt(offset, 0),
    limit: 50,
  });
  const t = await getT("pages");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">{t("glossaryHeading")}</h1>
      <GlossarySearchForm defaultQ={q ?? ""} />
      <GlossaryList items={result.items} total={result.total} />
      <GlossaryExportLinks />
    </div>
  );
}

