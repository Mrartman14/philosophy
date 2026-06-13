// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import {
  getLectureById,
  LectureDetail,
  LectureDocumentsSection,
  LectureExportLinks,
  LectureMediaSection,
} from "@/features/lectures";
import { getLectureTags } from "@/features/tags";
import { CommentSection } from "@/features/comments";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cq?: string }>;
}

export default async function LecturePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cq } = await searchParams;
  const [lecture, tags] = await Promise.all([
    getLectureById(id),
    getLectureTags(id),
  ]);
  if (!lecture) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <LectureDetail lecture={lecture} tags={tags} />
      <LectureExportLinks id={id} />
      {/* Секции документов/медиа лекции (lecture-enrichment, волна 3).
          Каждая сама возвращает null, если список пуст. */}
      <LectureDocumentsSection lectureId={id} />
      <LectureMediaSection lectureId={id} />
      {/* === slot: share-кнопка (share-links, волна 3, follow-up ПОСЛЕ) === */}
      <CommentSection lectureId={id} query={cq} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture?.title ?? "Лекция" };
}
