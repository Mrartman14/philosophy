// src/app/admin/forms/page.tsx
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  canListAdminForms,
  canAdminDeleteForm,
  getAdminForms,
  FormAdminRow,
} from "@/features/forms";
import type { Form } from "@/features/forms";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Формы — админ" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminFormsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canListAdminForms(me)) forbidden();

  const { offset } = await searchParams;
  const result = await getAdminForms({ offset: parseNonNegativeInt(offset, 0), limit: 20 });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Формы</h1>
        <p className="text-sm text-(--color-description)">Публичные формы. Всего: {result.total}</p>
      </header>

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((f) => (
          <FormAdminRow
            key={f.id}
            form={f}
            canDelete={canAdminDeleteForm(me, { id: f.id, owner_id: "", visibility: f.visibility } as Form)}
          />
        ))}
      </ul>

      <Pagination basePath="/admin/forms" offset={result.offset} limit={result.limit} total={result.total} />
    </section>
  );
}
