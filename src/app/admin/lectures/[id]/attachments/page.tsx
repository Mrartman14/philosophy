import { forbidden, notFound } from "next/navigation";

import {
  canAttachToLecture,
  canManageAttachments,
  getLectureById,
  getLectureDocuments,
  getLectureMedia,
  LectureAttachmentsManager,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "@/features/lectures";
import type { ManagedAttachment } from "@/features/lectures";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export const metadata = { title: "Прикрепления лекции" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LectureAttachmentsPage({ params }: Props) {
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("attachmentsPageTitle", { lectureTitle: lecture.title })}</h1>
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
    </div>
  );
}
