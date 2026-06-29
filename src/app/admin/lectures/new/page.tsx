// src/app/admin/lectures/new/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import {
  canAttachToLecture,
  canCreateLecture,
  LectureCreateForm,
} from "@/features/lectures";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("newLectureMetaTitle") };
}

export default async function NewLecturePage() {
  const me = await getMe();
  if (!canCreateLecture(me)) forbidden();

  // Создатель будет владельцем лекции → ownership гарантирован; гейт сводится к
  // capability entity.attach. Если её нет — пикер документов не показываем.
  const canAttach = canAttachToLecture(me, { owner: { id: me?.id ?? "" } });

  const t = await getT("admin");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("newLectureTitle")}</h1>
      <LectureCreateForm canAttach={canAttach} />
    </div>
  );
}
