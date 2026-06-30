// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SaveOfflineButton } from "@/app/_offline/save-offline-button";
import {
  anchorScopeAttr,
  AnchorScopeProvider,
  MarginRail,
  SelectionAffordanceHost,
} from "@/components/anchor-engine";
import { MarginNote, RouterLink, Skeleton } from "@/components/ui";
import { DocumentAnnotations } from "@/features/annotations";
import { CommentSection, DocumentComments } from "@/features/comments";
import { DocumentDetail, getDocumentById } from "@/features/documents";
import {
  canUpdateLecture,
  getLectureById,
  getLectureCanvases,
  getLectureDocuments,
  getLectureForms,
  getLectureMedia,
  LectureCanvasList,
  LectureFormList,
  lectureCoverUrl,
  LectureDetail,
  LectureDocumentSelector,
  lectureExportUrls,
  resolveActiveDocId,
} from "@/features/lectures";
import { getMediaById, MediaPlayer } from "@/features/media";
import {
  getLectureSubscription,
  LectureSubscribeButton,
} from "@/features/notifications";
import {
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import { getLectureTags } from "@/features/tags";
import { getLocale, getT } from "@/i18n";
import { buildPageMetadata, ogLocale } from "@/seo/page-metadata";
import { getMe } from "@/utils/me";

import { LectureActionsMenu } from "./lecture-actions-menu";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cq?: string; token?: string; doc?: string }>;
}

export default async function LecturePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cq, token, doc } = await searchParams;
  const [me, lecture, tags, documents, media, canvases, forms] = await Promise.all([
    getMe(),
    getLectureById(id, token),
    getLectureTags(id),
    getLectureDocuments(id, token),
    getLectureMedia(id, token),
    getLectureCanvases(id, token),
    getLectureForms(id, token),
  ]);
  if (!lecture) notFound();

  // URL-driven активный документ (?doc=); тело — только активного (ленивость).
  const activeId = resolveActiveDocId(documents, doc);
  const activeDoc = activeId ? await getDocumentById(activeId, token) : null;

  // Медиа-плееры: url в списке опционален → добираем getMediaById только когда пуст.
  const mediaWithUrl = await Promise.all(
    media.map(async (m) => (m.url ? m : ((await getMediaById(m.id, token)) ?? m))),
  );

  const canShare = canCreateShareLink(me, lecture);
  const canEdit = canUpdateLecture(me, lecture);
  const [subscribed, shareLinks, t] = await Promise.all([
    me && lecture.id ? getLectureSubscription(lecture.id) : Promise.resolve(false),
    canShare ? getShareLinksFor("lecture", lecture.id) : Promise.resolve([]),
    getT("pages"),
  ]);

  return (
    <AnchorScopeProvider>
      {/* Единый хост захвата выделения + аффорданса (PR3 dual-affordance fix):
          охватывает контент с data-ast-root И оба MarginNote (annotations +
          comments), чтобы их useRegisterAnchorAction достигли провайдера. */}
      <SelectionAffordanceHost />
      <div className="flex flex-col gap-8 p-4">
        {/* Тулбар действий: владелец — правка; залогинен — подписка; офлайн;
            ⋯-меню (скачать .md/.txt + поделиться). */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <RouterLink href={`/admin/lectures/${id}/edit`} className="text-sm text-(--color-link)">
              {t("lectureEditLink")}
            </RouterLink>
          )}
          {me && lecture.id && (
            <LectureSubscribeButton lectureId={lecture.id} initialSubscribed={subscribed} />
          )}
          <SaveOfflineButton entity="lectures" id={id} />
          <LectureActionsMenu
            exportUrls={lectureExportUrls(id)}
            share={
              canShare && lecture.id ? { resourceId: lecture.id, initialLinks: shareLinks } : null
            }
          />
        </div>

        <LectureDetail lecture={lecture} tags={tags} />

        {/* Документы — инлайн активный (URL-driven ?doc=); один data-ast-root. */}
        {activeId && (
          <section className="flex flex-col gap-3">
            <LectureDocumentSelector
              documents={documents}
              activeId={activeId}
              token={token}
              navLabel={t("lectureDocumentsNavLabel")}
            />
            <div data-ast-root {...anchorScopeAttr("document", activeId)}>
              {activeDoc ? (
                <DocumentDetail document={activeDoc} />
              ) : (
                <p className="text-sm text-(--color-fg-muted)">
                  {t("lectureDocumentUnavailable")}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Медиа — плееры (audio/video). */}
        {mediaWithUrl.length > 0 && (
          <section className="flex flex-col gap-3" aria-label={t("lectureMediaHeading")}>
            <h2 className="text-lg font-semibold">{t("lectureMediaHeading")}</h2>
            <ul className="flex flex-col gap-6">
              {mediaWithUrl.map((m) => (
                <li key={m.id}>
                  {m.url ? (
                    <MediaPlayer url={m.url} type={m.type} filename={m.filename} mediaId={m.id} />
                  ) : (
                    <p className="text-sm text-(--color-fg-muted)">{t("lectureMediaUnavailable")}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Канвасы — ссылки на /canvases/{id} (лёгкий листинг, без data графа). */}
        <LectureCanvasList
          canvases={canvases}
          token={token}
          heading={t("lectureCanvasesHeading")}
          entryBadge={t("lectureCanvasEntryBadge")}
          untitledLabel={t("lectureCanvasUntitled")}
        />

        {/* Формы — листинг прикреплённых форм (опросы/анкеты лекции). */}
        <LectureFormList
          forms={forms}
          token={token}
          heading={t("lectureFormsHeading")}
          entryBadge={t("lectureFormEntryBadge")}
          untitledLabel={t("lectureFormUntitled")}
        />

        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <CommentSection lectureId={id} query={cq} />
        </Suspense>
      </div>

      {/* Аннотации активного документа — правое поле грида (как /documents/[id]).
          @marginalia:ps-0 — гасим внутренний паддинг, когда поле раскрыто (тот же
          @container-порог что и reveal, см. layout.css §13; не вьюпортный xl). */}
      {activeDoc && activeId && (
        <MarginNote side="end" grow className="p-4 @marginalia:ps-0">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DocumentAnnotations parentId={activeId} />
          </Suspense>
          <MarginRail tone="annotation" highlightName="annotation" />
        </MarginNote>
      )}

      {/* Заякоренные комментарии активного документа — ЛЕВОЕ поле грида.
          @marginalia:pe-0 — гасим внутренний паддинг (к хребту), когда поле раскрыто. */}
      {activeDoc && activeId && (
        <MarginNote side="start" grow className="p-4 @marginalia:pe-0">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DocumentComments lectureId={id} documentId={activeId} />
          </Suspense>
        </MarginNote>
      )}
    </AnchorScopeProvider>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [lecture, t, tMeta, locale] = await Promise.all([
    getLectureById(id),
    getT("pages"),
    getT("metadata"),
    getLocale(),
  ]);
  return buildPageMetadata({
    title: lecture?.title ?? t("lectureDefaultTitle"),
    siteName: tMeta("appTitle"),
    description: lecture?.description,
    image: lectureCoverUrl(lecture?.cover_image_key),
    imageAlt: lecture?.cover_image_alt,
    locale: ogLocale(locale),
    publishedTime: lecture?.created_at,
    path: `/lectures/${id}`,
  });
}
