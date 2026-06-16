// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SaveOfflineButton } from "@/app/_offline/save-offline-button";
import { Skeleton } from "@/components/ui";
import { CommentSection } from "@/features/comments";
import {
  getLectureById,
  LectureDetail,
  LectureDocumentsSection,
  LectureExportLinks,
  LectureMediaSection,
} from "@/features/lectures";
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import { getLectureTags } from "@/features/tags";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cq?: string; token?: string }>;
}

export default async function LecturePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cq, token } = await searchParams;
  const [me, lecture, tags] = await Promise.all([
    getMe(),
    getLectureById(id, token),
    getLectureTags(id),
  ]);
  if (!lecture) notFound();

  const canShare = canCreateShareLink(me, lecture);
  const shareLinks = canShare
    ? await getShareLinksFor("lecture", lecture.id)
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <LectureDetail lecture={lecture} tags={tags} />
      <LectureExportLinks id={id} />
      {/* Секции документов/медиа лекции (lecture-enrichment, волна 3).
          Каждая сама возвращает null, если список пуст — fallback={null},
          чтобы не было скелетона, который пропадает в пустом случае (CLS). */}
      <Suspense fallback={null}>
        <LectureDocumentsSection lectureId={id} />
      </Suspense>
      <Suspense fallback={null}>
        <LectureMediaSection lectureId={id} />
      </Suspense>
      <div className="flex justify-end">
        <SaveOfflineButton entity="lectures" id={id} />
      </div>
      {/* === slot: share-кнопка (share-links, волна 3) === */}
      {canShare && (
        <div className="flex justify-end">
          <ShareButton
            resourceType="lecture"
            resourceId={lecture.id}
            canCreate={canShare}
            initialLinks={shareLinks}
          />
        </div>
      )}
      {/* CommentSection всегда рендерит контент (заголовок «Обсуждение» +
          форму/дерево) — используем Skeleton как fallback. */}
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <CommentSection lectureId={id} query={cq} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture?.title ?? "Лекция" };
}
