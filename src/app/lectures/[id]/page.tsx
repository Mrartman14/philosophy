// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import { getLectureById, LectureDetail } from "@/features/lectures";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LecturePage({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  if (!lecture) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <LectureDetail lecture={lecture} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture?.title ?? "Лекция" };
}
