// src/app/admin/lectures/[id]/edit/page.tsx
import { forbidden, notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canDeleteLecture,
  canSetLectureVisibility,
  canUpdateLecture,
  getLectureById,
  LectureEditForm,
} from "@/features/lectures";

export const metadata = { title: "Редактирование лекции" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLecturePage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  const lecture = await getLectureById(id);
  if (!lecture) notFound();
  if (!canUpdateLecture(me, lecture)) forbidden();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{lecture.title}</h1>
      <LectureEditForm
        lecture={lecture}
        canSetVisibility={canSetLectureVisibility(me, lecture)}
        canDelete={canDeleteLecture(me)}
      />
    </div>
  );
}
