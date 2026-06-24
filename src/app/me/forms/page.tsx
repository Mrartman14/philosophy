// src/app/me/forms/page.tsx
import { RouterLink } from "@/components/ui";
import { getMyForms, canCreateForm, MyFormsList } from "@/features/forms";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myFormsTitle") };
}

export default async function MyFormsPage() {
  const me = await requireActiveUserOrRedirect("/me/forms");

  const forms = await getMyForms();
  const canCreate = canCreateForm(me);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("myFormsHeading")}</h1>
        {canCreate && (
          <RouterLink
            href="/forms/new"
            className="inline-flex shrink-0 items-center rounded bg-(--color-fg) px-4 py-2 text-sm font-medium text-(--color-surface) hover:opacity-90"
          >
            {t("myFormsCreate")}
          </RouterLink>
        )}
      </header>

      <MyFormsList forms={forms} />
    </div>
  );
}
