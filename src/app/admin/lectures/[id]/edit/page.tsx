// src/app/admin/lectures/[id]/edit/page.tsx
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import {
  canDeleteLecture,
  canManageCover,
  canSetLectureVisibility,
  canUpdateLecture,
  getLectureById,
  LectureCoverForm,
  LectureEditForm,
} from "@/features/lectures";
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

  const [allTags, lectureTags] = canAssign
    ? await Promise.all([getTags(), getLectureTags(lecture.id)])
    : [null, null];

  const t = await getT("admin");

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
              .map((t) => t.id)
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

      {canManageCover(me, lecture) && (
        <section className="max-w-xl border-t border-(--color-border) pt-4">
          <h2 className="mb-2 text-lg font-semibold">{t("editLectureAttachmentsHeading")}</h2>
          <a
            href={`/admin/lectures/${lecture.id}`}
            className="inline-flex items-center gap-1 text-sm underline hover:no-underline"
          >
            {t("editLectureAttachmentsLink")}
            <ChevronIcon className="rtl-flip" />
          </a>
        </section>
      )}
    </div>
  );
}
