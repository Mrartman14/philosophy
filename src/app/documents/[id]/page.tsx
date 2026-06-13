// src/app/documents/[id]/page.tsx
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import { SchemaContextProvider } from "@/components/ast-editor";
import {
  canEditDocument,
  canDeleteDocument,
  canSeeRevisions,
  getDocumentById,
  DocumentDetail,
  DocumentMetaForm,
  DocumentEditForm,
  DocumentVisibilityButton,
  DocumentDeleteButton,
  DocumentExportLinks,
  DocumentRevisions,
  DocumentContainers,
} from "@/features/documents";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision } = await searchParams;
  const me = await getMe();
  const document = await getDocumentById(id);
  if (!document) notFound();

  const canEdit = canEditDocument(me, document);
  const canDelete = canDeleteDocument(me, document);
  const showRevisions = canSeeRevisions(document);
  const isPrivateOwned = canEdit && document.visibility === "private";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{document.filename || "Документ"}</h1>
        {document.id && <DocumentExportLinks id={document.id} />}
      </header>

      <DocumentDetail document={document} />

      <DocumentContainers documentId={id} />

      {/* === СЛОТ ДЛЯ ANNOTATIONS (волна 3) ===
          annotations встраивается follow-up-коммитом ПОСЛЕ мержа documents.
          Точка композиции: здесь, под телом документа. Исполнитель annotations
          добавит <DocumentAnnotations documentId={id} entityType="document" />
          или аналог из своего слайса. Ничего другого менять не нужно. */}

      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <DocumentMetaForm document={document} />
          <SchemaContextProvider>
            <DocumentEditForm document={document} />
          </SchemaContextProvider>
          {isPrivateOwned && document.id && (
            <DocumentVisibilityButton id={document.id} />
          )}
        </section>
      )}

      {showRevisions && document.id && (
        <DocumentRevisions documentId={document.id} selectedRevisionId={revision} />
      )}

      {canDelete && document.id && (
        <div>
          <DocumentDeleteButton id={document.id} />
        </div>
      )}
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const document = await getDocumentById(id);
  return { title: document?.filename ?? "Документ" };
}
