// src/app/admin/lectures/new/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { canCreateLecture, LectureCreateForm } from "@/features/lectures";

export const metadata = { title: "Новая лекция" };

export default async function NewLecturePage() {
  const me = await getMe();
  if (!canCreateLecture(me)) forbidden();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Новая лекция</h1>
      <LectureCreateForm />
    </div>
  );
}
