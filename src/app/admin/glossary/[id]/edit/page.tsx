import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import {
  canUpdateTerm,
  canDeleteTerm,
  getTermById,
  GlossaryEditForm,
  GlossaryDeleteButton,
  GlossaryRevisions,
} from "@/features/glossary";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("glossaryEditMetaTitle") };
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export default async function AdminGlossaryEditPage({
  params,
  searchParams,
}: Props) {
  const me = await getMe();
  const canUpdate = canUpdateTerm(me);
  const canDelete = canDeleteTerm(me);
  if (!canUpdate && !canDelete) forbidden();

  const { id } = await params;
  const { revision } = await searchParams;
  const term = await getTermById(id);
  if (!term) notFound();

  const astSchema = canUpdate ? await getAstSchema() : null;

  const t = await getT("admin");

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{term.title}</h1>
        <p className="text-xs text-(--color-fg-muted)">
          {t("glossaryEditHint")}
        </p>
      </header>

      {canUpdate && (
        <SchemaContextProvider initial={astSchema ?? undefined}>
          <GlossaryEditForm term={term} />
        </SchemaContextProvider>
      )}

      {term.id && (
        <GlossaryRevisions termId={term.id} selectedRevisionId={revision} />
      )}

      {canDelete && term.id && (
        <div>
          <GlossaryDeleteButton id={term.id} />
        </div>
      )}
    </section>
  );
}
