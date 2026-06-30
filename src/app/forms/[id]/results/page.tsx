// src/app/forms/[id]/results/page.tsx
import { forbidden } from "next/navigation";

import {
  getFormById,
  getFormStats,
  loadFormResultsContext,
  FormResultsView,
} from "@/features/forms";
import { getT } from "@/i18n";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function FormResultsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const { form } = await loadFormResultsContext(id, token);

  const stats = await getFormStats(id, token);
  // Видимая форма, но результаты закрыты (бек 403) — страховка от гонки.
  if (!stats) forbidden();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <FormResultsView form={form} stats={stats} {...(token ? { token } : {})} />
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
