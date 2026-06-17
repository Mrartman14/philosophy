// src/app/documents/[id]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { Skeleton } from "@/components/ui";
import { AnnotationsSection } from "@/features/annotations";
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
import {
  DocumentSubscribeButton,
  getDocumentSubscription,
} from "@/features/notifications";
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; token?: string }>;
}

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision, token } = await searchParams;
  const [me, document] = await Promise.all([getMe(), getDocumentById(id, token)]);
  if (!document) notFound();

  const canEdit = canEditDocument(me, document);
  const canDelete = canDeleteDocument(me, document);
  const showRevisions = canSeeRevisions(document);
  const isPrivateOwned = canEdit && document.visibility === "private";

  const astSchema = canEdit ? await getAstSchema() : null;

  const canShare = canCreateShareLink(me, document);
  const [shareLinks, subscribed] = await Promise.all([
    canShare && document.id
      ? getShareLinksFor("document", document.id)
      : Promise.resolve([]),
    me && document.id ? getDocumentSubscription(document.id) : Promise.resolve(false),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{document.filename ?? "Документ"}</h1>
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
          {me && document.id && (
            <DocumentSubscribeButton
              documentId={document.id}
              initialSubscribed={subscribed}
            />
          )}
        </div>
      </header>

      <DocumentDetail document={document} />

      {/* DocumentContainers всегда рендерит AttachmentsPanel с заголовком
          «Включён в лекции» + список или пустое-состояние — используем Skeleton. */}
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <DocumentContainers documentId={id} />
      </Suspense>

      {/* Аннотации на документе. Композиция через страницу (не cross-feature
          импорт): слайс annotations экспонирует AnnotationsSection из своего
          index.ts. Видимые аннотации фетчатся внутри секции (матрица
          видимости — на беке). */}
      {/* AnnotationsSection всегда рендерит заголовок «Аннотации» + контент
          (список или пустое-состояние) + форму создания — используем Skeleton. */}
      {document.id && (
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <AnnotationsSection parentEntityType="document" parentId={document.id} />
        </Suspense>
      )}

      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <DocumentMetaForm document={document} />
          <SchemaContextProvider initial={astSchema ?? undefined}>
            <DocumentEditForm document={document} />
          </SchemaContextProvider>
          {isPrivateOwned && document.id && (
            <DocumentVisibilityButton id={document.id} />
          )}
        </section>
      )}

      {/* DocumentRevisions всегда рендерит контент (история ревизий) — Skeleton. */}
      {showRevisions && document.id && (
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <DocumentRevisions documentId={document.id} selectedRevisionId={revision} />
        </Suspense>
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
