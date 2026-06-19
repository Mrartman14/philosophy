// src/app/me/forms/page.tsx
import { getMyForms, canCreateForm, MyFormsList, FormCreateForm } from "@/features/forms";
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
      <h1 className="text-2xl font-bold">{t("myFormsHeading")}</h1>

      {canCreate && (
        <section>
          <details>
            <summary className="cursor-pointer text-sm font-medium">{t("myFormsCreate")}</summary>
            <div className="mt-3">
              <FormCreateForm />
            </div>
          </details>
        </section>
      )}

      <MyFormsList forms={forms} />
    </div>
  );
}
