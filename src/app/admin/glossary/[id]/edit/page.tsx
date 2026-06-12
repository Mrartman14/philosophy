import { forbidden, notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canUpdateTerm,
  canDeleteTerm,
  getTermById,
  GlossaryEditForm,
  GlossaryDeleteButton,
  GlossaryRevisions,
} from "@/features/glossary";
import { SchemaContextProvider } from "@/components/ast-editor";

export const metadata = { title: "Глоссарий — редактирование термина" };

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

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{term.title}</h1>
        <p className="text-xs text-(--color-description)">
          Название термина нельзя изменить. Можно редактировать только тело.
        </p>
      </header>

      {canUpdate && (
        <SchemaContextProvider>
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
