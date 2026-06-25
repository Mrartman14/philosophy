// src/app/admin/lectures/[id]/edit/page.tsx
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import {
  canAttachToLecture,
  canDeleteLecture,
  canManageAttachments,
  canManageCover,
  canSetLectureVisibility,
  canUpdateLecture,
  getLectureById,
  getLectureDocuments,
  getLectureMedia,
  LectureAttachmentsManager,
  LectureCoverForm,
  LectureEditForm,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "@/features/lectures";
import type { ManagedAttachment } from "@/features/lectures";
import {
  canAssignTags,
  getLectureTags,
  getTags,
  LectureTagsForm,
} from "@/features/tags";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("editLectureMetaTitle") };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLecturePage({ params }: Props) {
  const { id } = await params;
  const [me, lecture] = await Promise.all([getMe(), getLectureById(id)]);
  if (!lecture) notFound();

  const canUpdate = canUpdateLecture(me, lecture);
  const canAssign = canAssignTags(me);
  // Мутации лекции — owner-only (бек, спека §6.4); назначение тегов —
  // отдельная capability tag.assign без owner-чека. Страница доступна тем,
  // кому доступно хотя бы одно из действий.
  if (!canUpdate && !canAssign) forbidden();

  // Управление вложениями (attach/detach/reorder) — owner-only; списки грузим
  // только при наличии прав, иначе секция не рендерится.
  const canManage = canManageAttachments(me, lecture);

  const [allTags, lectureTags] = canAssign
    ? await Promise.all([getTags(), getLectureTags(lecture.id)])
    : [null, null];
  const [docs, media] = canManage
    ? await Promise.all([getLectureDocuments(id), getLectureMedia(id)])
    : [null, null];

  const t = await getT("admin");

  const docItems: ManagedAttachment[] = (docs ?? []).map((d, i) => ({
    entityId: d.id ?? "",
    entityType: "document",
    label: d.filename ?? d.id ?? t("attachmentsDocumentFallback"),
    sortOrder: i,
  }));
  const mediaItems: ManagedAttachment[] = (media ?? []).map((m, i) => ({
    entityId: m.id,
    entityType: "media",
    label: m.filename,
    sortOrder: i,
  }));
  const canAttach = canAttachToLecture(me, lecture);

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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{lecture.title}</h1>
      {canUpdate && (
        <LectureEditForm
          lecture={lecture}
          canSetVisibility={canSetLectureVisibility(me, lecture)}
          canDelete={canDeleteLecture(me)}
        />
      )}
      {canAssign && allTags && (
        <section className="max-w-xl border-t border-(--color-border) pt-4">
          <h2 className="mb-3 text-lg font-semibold">{t("editLectureTagsHeading")}</h2>
          <LectureTagsForm
            lectureId={lecture.id}
            allTags={allTags.items}
            assignedTagIds={lectureTags
              .map((tag) => tag.id)
              .filter((tagId): tagId is number => typeof tagId === "number")}
          />
        </section>
      )}

      {canManageCover(me, lecture) && (
        <section className="max-w-xl border-t border-(--color-border) pt-4">
          <LectureCoverForm
            lectureId={lecture.id}
            coverImageKey={lecture.cover_image_key ?? null}
            coverImageAlt={lecture.cover_image_alt ?? null}
          />
        </section>
      )}

      {canManage && (
        <section className="flex flex-col gap-6 border-t border-(--color-border) pt-4">
          <h2 className="text-lg font-semibold">{t("editLectureAttachmentsHeading")}</h2>
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
      )}
    </div>
  );
}
