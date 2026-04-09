import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLectureById,
  getLectureFiles,
  getTranscript,
} from "@/features/lectures/api";
import { LectureEditor } from "@/features/admin/lectures/lecture-editor";
import { FileManager } from "@/features/admin/lectures/file-manager";
import { TranscriptEditor } from "@/features/admin/lectures/transcript-editor";
import type { Segment } from "@/api/types";

export const metadata = { title: "Редактирование лекции — Админ" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminLectureEditPage({ params }: PageProps) {
  const { id } = await params;

  let lecture, files;
  try {
    [lecture, files] = await Promise.all([
      getLectureById(id),
      getLectureFiles(id),
    ]);
  } catch {
    return notFound();
  }

  let segments: Segment[] = [];
  try {
    const transcript = await getTranscript(id);
    segments = transcript.segments ?? [];
  } catch {
    // транскрипт может отсутствовать — это не ошибка
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{lecture.title}</h1>
        <Link
          href="/admin/lectures"
          className="text-sm text-(--color-description) hover:underline"
        >
          ← К списку
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Метаданные</h2>
        <LectureEditor lecture={lecture} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Файлы</h2>
        <FileManager lectureId={id} files={files} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Транскрипт</h2>
        <TranscriptEditor lectureId={id} initialSegments={segments} />
      </section>
    </div>
  );
}
