// src/app/forms/[id]/fields/[fieldId]/page.tsx
import { forbidden, notFound } from "next/navigation";

import {
  getFormById,
  getFieldAnswers,
  loadFormResultsContext,
  FieldAnswersColumn,
} from "@/features/forms";
import { getT } from "@/i18n";

interface Props {
  params: Promise<{ id: string; fieldId: string }>;
  searchParams: Promise<{ token?: string; p?: string }>;
}

const LIMIT = 20;

export default async function FieldAnswersPage({ params, searchParams }: Props) {
  const { id, fieldId } = await params;
  const { token, p } = await searchParams;
  const { form } = await loadFormResultsContext(id, token);

  const field = (form.fields ?? []).find((f) => f.id === fieldId);
  if (!field) notFound();

  const pageNum = Math.max(0, Number.parseInt(p ?? "0", 10) || 0);
  const page = await getFieldAnswers(id, fieldId, {
    ...(token ? { token } : {}),
    offset: pageNum * LIMIT,
    limit: LIMIT,
  });
  if (!page) forbidden();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">{form.title}</h1>
      <FieldAnswersColumn
        field={field}
        page={page}
        formId={id}
        {...(token ? { token } : {})}
      />
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [form, t] = await Promise.all([getFormById(id, token), getT("forms")]);
  return {
    title: form ? `${form.title} — ${t("results.titleSuffix")}` : t("results.titleSuffix"),
  };
}
