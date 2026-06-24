// src/app/forms/new/page.tsx
import { forbidden } from "next/navigation";

import { ChevronIcon } from "@/assets/icons/chevron-icon";
import { RouterLink } from "@/components/ui";
import { canCreateForm, FormCreateForm } from "@/features/forms";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("createFormTitle") };
}

export default async function NewFormPage() {
  // Создание формы — приватная зона: гостя на логин.
  const me = await requireActiveUserOrRedirect("/forms/new");
  if (!canCreateForm(me)) forbidden();

  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("createFormHeading")}</h1>
        <RouterLink href="/me/forms" className="inline-flex items-center gap-1 text-sm text-(--color-link)">
          <ChevronIcon className="rtl-flip rotate-180" />
          {t("createFormBack")}
        </RouterLink>
      </header>

      <FormCreateForm />
    </div>
  );
}
