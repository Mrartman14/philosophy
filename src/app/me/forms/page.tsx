// src/app/me/forms/page.tsx
import { getMyForms, canCreateForm, MyFormsList, FormCreateForm } from "@/features/forms";
import { requireActiveUserOrRedirect } from "@/utils/me";

export const metadata = { title: "Мои формы" };

export default async function MyFormsPage() {
  const me = await requireActiveUserOrRedirect("/me/forms");

  const forms = await getMyForms();
  const canCreate = canCreateForm(me);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Мои формы</h1>

      {canCreate && (
        <section>
          <details>
            <summary className="cursor-pointer text-sm font-medium">Создать форму</summary>
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
