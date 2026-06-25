import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import type { AstBlock } from "@/components/ast-render";
import { RouterLink } from "@/components/ui";
import { DocumentDetail, getDocumentById } from "@/features/documents";
import {
  canAttachToLecture,
  canManageAttachments,
  getLectureById,
  getLectureDocuments,
  getLectureMedia,
  LectureAttachmentsManager,
  LectureDocumentTabs,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "@/features/lectures";
import type { ManagedAttachment } from "@/features/lectures";
import { getMediaById, MediaPlayer } from "@/features/media";
import { getT } from "@/i18n";
import type { ActionResult } from "@/utils/create-action";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("cardMetaTitle") };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LectureCardPage({ params }: Props) {
  const { id } = await params;
  const [me, lecture] = await Promise.all([getMe(), getLectureById(id)]);
  if (!lecture) notFound();
  if (!canManageAttachments(me, lecture)) forbidden();

  const [docs, media] = await Promise.all([
    getLectureDocuments(id),
    getLectureMedia(id),
  ]);
  const canAttach = canAttachToLecture(me, lecture);
  const t = await getT("admin");

  // — менеджеры (управление) —
  const docItems: ManagedAttachment[] = docs.map((d, i) => ({
    entityId: d.id ?? "",
    entityType: "document",
    label: d.filename ?? d.id ?? t("attachmentsDocumentFallback"),
    sortOrder: i,
  }));
  const mediaItems: ManagedAttachment[] = media.map((m, i) => ({
    entityId: m.id,
    entityType: "media",
    label: m.filename,
    sortOrder: i,
  }));

  async function docFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchDocumentsForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }
  async function mediaFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchMediaForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }

  // Ленивая подгрузка тела неосновного документа (inline server action: страница
  // вправе импортировать @/features/documents, слайс — нет, см. ESLint-гард).
  async function loadDocBlocks(docId: string): Promise<ActionResult<AstBlock[]>> {
    "use server";
    try {
      const doc = await getDocumentById(docId);
      // doc.blocks (ast.Block[]) ⟷ AstBlock[] — один и тот же тип, каста НЕ нужно
      // (no-unnecessary-type-assertion в strictTypeChecked иначе красит линт).
      return { success: true, data: doc?.blocks ?? [] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "load failed" };
    }
  }

  // — рендер документов —
  // СТОПГАП: «основной» = первый по sort_order. В контракте бэка нет is_primary
  // (см. spec 2026-06-25-lecture-card-attachments-render-design.md). Снять, когда
  // бэк добавит явный флаг.
  const tabDocs = docs
    .filter((d): d is typeof d & { id: string } => Boolean(d.id))
    .map((d) => ({ id: d.id, label: d.filename ?? d.id }));
  const primaryId = tabDocs[0]?.id ?? null;
  const primaryDoc = primaryId ? await getDocumentById(primaryId) : null;

  // — рендер медиа — плееру нужен url; в списке media он опционален (media.Media.url?),
  // поэтому добираем getMediaById ТОЛЬКО когда url отсутствует (без N+1 в общем случае).
  const mediaWithUrl = await Promise.all(
    media.map(async (m) => (m.url ? m : ((await getMediaById(m.id)) ?? m))),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{lecture.title}</h1>
        <RouterLink
          href={`/admin/lectures/${lecture.id}/edit`}
          className="text-sm underline hover:no-underline"
        >
          {t("cardEditLink")}
        </RouterLink>
      </header>

      {/* Управление вложениями (сверху) */}
      <section className="flex flex-col gap-6">
        <LectureAttachmentsManager
          lectureId={id}
          attachments={docItems}
          canAttach={canAttach}
          pickerEntityType="document"
          targetFetcher={docFetcher}
          title={t("attachmentsDocsSectionTitle")}
        />
        <LectureAttachmentsManager
          lectureId={id}
          attachments={mediaItems}
          canAttach={canAttach}
          pickerEntityType="media"
          targetFetcher={mediaFetcher}
          title={t("attachmentsMediaSectionTitle")}
        />
      </section>

      {/* Рендер документов (ниже) */}
      {primaryDoc && primaryId && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("cardDocumentsHeading")}</h2>
          {tabDocs.length <= 1 ? (
            <DocumentDetail document={primaryDoc} />
          ) : (
            <LectureDocumentTabs
              docs={tabDocs}
              primaryId={primaryId}
              primaryPanel={<DocumentDetail document={primaryDoc} />}
              loadBlocks={loadDocBlocks}
            />
          )}
        </section>
      )}

      {/* Рендер медиа (превью-плееры) */}
      {mediaWithUrl.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("cardMediaHeading")}</h2>
          <ul className="flex flex-col gap-6">
            {mediaWithUrl.map((m) => (
              <li key={m.id}>
                {m.url ? (
                  <MediaPlayer url={m.url} type={m.type} filename={m.filename} mediaId={m.id} />
                ) : (
                  <p className="text-sm text-(--color-fg-muted)">{t("cardMediaUnavailable")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
