import { notFound } from "next/navigation";

import { AnnotationsSection } from "@/features/annotations";
import {
  getTermById,
  GlossaryDetail,
  GlossaryExportLinks,
} from "@/features/glossary";
import { getLocale, getT } from "@/i18n";
import { buildPageMetadata, ogLocale } from "@/seo/page-metadata";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <GlossaryDetail term={term} />
      {term.id && <GlossaryExportLinks termId={term.id} />}
      {term.id && (
        <AnnotationsSection parentEntityType="glossary" parentId={term.id} />
      )}
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [term, t, tMeta, locale] = await Promise.all([
    getTermById(id),
    getT("pages"),
    getT("metadata"),
    getLocale(),
  ]);
  return buildPageMetadata({
    title: term?.title ?? t("termDefaultTitle"),
    siteName: tMeta("appTitle"),
    locale: ogLocale(locale),
    path: `/glossary/${id}`,
  });
}
