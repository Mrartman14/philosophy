// src/app/forms/[id]/submissions/page.tsx
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  getFormById,
  getSubmissionsByForm,
  canListFormSubmissions,
  SubmissionList,
} from "@/features/forms";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Отклики формы" };

export default async function FormSubmissionsPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  const form = await getFormById(id);
  if (!form) notFound();
  // Только владелец видит отклики (бек 403/404 для остальных).
  if (!canListFormSubmissions(me, form)) notFound();

  const submissions = await getSubmissionsByForm(id);
  if (submissions === null) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Отклики: {form.title}</h1>
      <p className="text-sm text-(--color-description)">Всего: {submissions.length}</p>
      <SubmissionList submissions={submissions} />
    </div>
  );
}
