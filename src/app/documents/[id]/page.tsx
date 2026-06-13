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
import { AnnotationsSection } from "@/features/annotations";
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; token?: string }>;
}

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision, token } = await searchParams;
  const me = await getMe();
  const document = await getDocumentById(id, token);
  if (!document) notFound();

  const canEdit = canEditDocument(me, document);
  const canDelete = canDeleteDocument(me, document);
  const showRevisions = canSeeRevisions(document);
  const isPrivateOwned = canEdit && document.visibility === "private";

  const canShare = canCreateShareLink(me, document);
  const shareLinks =
    canShare && document.id
      ? await getShareLinksFor("document", document.id)
      : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{document.filename || "Документ"}</h1>
        <div className="flex items-center gap-2">
          {document.id && (
            <ShareButton
              resourceType="document"
              resourceId={document.id}
              canCreate={canShare}
              initialLinks={shareLinks}
            />
          )}
          {document.id && <DocumentExportLinks id={document.id} />}
        </div>
      </header>

      <DocumentDetail document={document} />

      <DocumentContainers documentId={id} />

      {/* Аннотации на документе. Композиция через страницу (не cross-feature
          импорт): слайс annotations экспонирует AnnotationsSection из своего
          index.ts. Видимые аннотации фетчатся внутри секции (матрица
          видимости — на беке). */}
      {document.id && (
        <AnnotationsSection parentEntityType="document" parentId={document.id} />
      )}

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
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const document = await getDocumentById(id);
  return { title: document?.filename ?? "Документ" };
}
