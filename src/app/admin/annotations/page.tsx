// src/app/admin/annotations/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  getAdminAnnotations,
  canModerateAnnotations,
  canAdminDeleteAnnotation,
  AnnotationAdminRow,
  AnnotationAdminFilterForm,
} from "@/features/annotations";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("annotationsMetaTitle") };
}

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

  const t = await getT("admin");

  const paginationLabels = await getPaginationLabels();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("annotationsTitle")}</h1>
      <p className="text-sm text-(--color-fg-muted)">
        {t("annotationsDescription")}
      </p>
      <AnnotationAdminFilterForm />
      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("annotationsEmpty")}</p>
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
      <Pagination basePath="/admin/annotations" offset={offset} limit={LIMIT} total={total} searchParams={sp} labels={paginationLabels} />
    </section>
  );
}
