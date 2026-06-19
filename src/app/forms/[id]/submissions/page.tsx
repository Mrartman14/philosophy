// src/app/forms/[id]/submissions/page.tsx
import { notFound } from "next/navigation";

import {
  getFormById,
  getSubmissionsByForm,
  canListFormSubmissions,
  SubmissionList,
} from "@/features/forms";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("formSubmissionsTitle") };
}

export default async function FormSubmissionsPage({ params }: Props) {
  const { id } = await params;
  const [me, form] = await Promise.all([getMe(), getFormById(id)]);
  if (!form) notFound();
  // Только владелец видит отклики (бек 403/404 для остальных).
  if (!canListFormSubmissions(me, form)) notFound();

  const submissions = await getSubmissionsByForm(id);
  if (submissions === null) notFound();

  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">{t("formSubmissionsHeading", { formTitle: form.title ?? "" })}</h1>
      <p className="text-sm text-(--color-fg-muted)">{t("formSubmissionsTotal", { total: submissions.length })}</p>
      <SubmissionList submissions={submissions} />
    </div>
  );
}
