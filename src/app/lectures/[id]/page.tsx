// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";

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
          Каждая сама возвращает null, если список пуст. */}
      <LectureDocumentsSection lectureId={id} />
      <LectureMediaSection lectureId={id} />
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
      <CommentSection lectureId={id} query={cq} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture?.title ?? "Лекция" };
}
