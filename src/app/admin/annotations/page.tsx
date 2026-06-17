// src/app/admin/annotations/page.tsx
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  getAdminAnnotations,
  canModerateAnnotations,
  canAdminDeleteAnnotation,
  AnnotationAdminRow,
  AnnotationAdminFilterForm,
} from "@/features/annotations";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export const metadata = { title: "Аннотации — модерация" };

interface Props {
  searchParams: Promise<{
    parent_entity_type?: string;
    offset?: string;
  }>;
}

const LIMIT = 20;

export default async function AdminAnnotationsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateAnnotations(me)) forbidden();

  const sp = await searchParams;
  const offset = parseNonNegativeInt(sp.offset, 0);
  const { items, total } = await getAdminAnnotations({
    offset,
    limit: LIMIT,
    ...(sp.parent_entity_type
      ? { parent_entity_type: sp.parent_entity_type }
      : {}),
  });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Аннотации (публичные)</h1>
      <p className="text-sm text-(--color-description)">
        Видны только публичные аннотации. Удаление доступно для публичных
        (приватные модерации недоступны).
      </p>
      <AnnotationAdminFilterForm />
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Ничего не найдено.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationAdminRow
                annotation={a}
                canAdminDelete={canAdminDeleteAnnotation(me, a)}
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/admin/annotations" offset={offset} limit={LIMIT} total={total} searchParams={sp} />
    </section>
  );
}
