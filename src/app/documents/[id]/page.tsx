// src/app/documents/[id]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnchorActionsProvider, SelectionAffordanceHost } from "@/components/anchor-engine";
import { AstToc, extractHeadings } from "@/components/ast-toc";
import { MarginNote, RouterLink, Skeleton } from "@/components/ui";
import { DocumentAnnotations } from "@/features/annotations";
import {
  canEditDocument,
  canDeleteDocument,
  canSeeRevisions,
  getDocumentById,
  DocumentDetail,
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
import { getT } from "@/i18n";
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

  const tocHeadings = extractHeadings(document.blocks ?? []);

  const canEdit = canEditDocument(me, document);
  const canDelete = canDeleteDocument(me, document);
  const showRevisions = canSeeRevisions(document);

  const canShare = canCreateShareLink(me, document);
  const [shareLinks, subscribed, t] = await Promise.all([
    canShare && document.id
      ? getShareLinksFor("document", document.id)
      : Promise.resolve([]),
    me && document.id ? getDocumentSubscription(document.id) : Promise.resolve(false),
    getT("pages"),
  ]);

  return (
    <AnchorActionsProvider>
      {/* Единый хост захвата выделения + аффорданса (PR3 dual-affordance fix):
          охватывает контент с data-ast-root И MarginNote с аннотациями. */}
      <SelectionAffordanceHost />
      <div className="flex flex-col gap-8 p-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{document.filename ?? t("documentDefaultTitle")}</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <RouterLink
              href={`/documents/${id}/edit`}
              className="text-sm text-(--color-link)"
            >
              {t("documentEdit")}
            </RouterLink>
          )}
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

      <div data-ast-root>
        <DocumentDetail document={document} />
      </div>

      {/* DocumentContainers всегда рендерит AttachmentsPanel с заголовком
          «Включён в лекции» + список или пустое-состояние — используем Skeleton. */}
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <DocumentContainers documentId={id} />
      </Suspense>

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

      {tocHeadings.length > 0 && (
        <aside className="margin-nav margin-nav--hide-narrow">
          <AstToc headings={tocHeadings} label={t("documentToc")} />
        </aside>
      )}

      {/* ps-0 когда поле раскрыто (@container, тот же порог что и reveal — см.
          layout.css §13, НЕ вьюпортный xl): внутренний (к хребту) отступ убираем —
          его роль играет грид-гаттер (--layout-gutter), как у TOC-сайдбара. Внешний
          (pe, к краю экрана) ОСТАЁТСЯ — иначе панель упирается в край. На схлопнутом
          поле (панель втекает в поток, гаттера нет) — собственный p-4. */}
      <MarginNote side="end" grow className="p-4 @min-[80em]:ps-0">
        {document.id ? (
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DocumentAnnotations parentId={document.id} />
          </Suspense>
        ) : (
          <p className="text-sm text-(--color-fg-muted)">{t("documentMarginHint")}</p>
        )}
      </MarginNote>
    </AnchorActionsProvider>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [document, t] = await Promise.all([getDocumentById(id), getT("pages")]);
  return { title: document?.filename ?? t("documentDefaultTitle") };
}
