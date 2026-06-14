// src/app/me/forms/page.tsx
import { redirect } from "next/navigation";

import { getMyForms, canCreateForm, MyFormsList, FormCreateForm } from "@/features/forms";
import { getMe } from "@/utils/me";

export const metadata = { title: "Мои формы" };

export default async function MyFormsPage() {
  const me = await getMe();
  if (me?.status !== "active") redirect("/login?next=/me/forms");

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
