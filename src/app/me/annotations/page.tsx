// src/app/me/annotations/page.tsx
import { redirect } from "next/navigation";

import {
  getMyAnnotations,
  AnnotationCard,
  AnnotationAnchorContext,
  AnnotationExportLinks,
  AnnotationDeleteButton,
  AnnotationPagination,
} from "@/features/annotations";
import { getMe } from "@/utils/me";

export const metadata = { title: "Мои аннотации" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

const LIMIT = 20;

export default async function MyAnnotationsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me) redirect("/login?next=/me/annotations");

  const { offset: rawOffset } = await searchParams;
  const offset = Math.max(0, Number(rawOffset ?? 0) || 0);
  const { items, total } = await getMyAnnotations(offset, LIMIT);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Мои аннотации</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">
          У вас пока нет аннотаций.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationCard
                annotation={a}
                anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                actions={
                  <>
                    {a.id && <AnnotationExportLinks id={a.id} />}
                    {a.id && <AnnotationDeleteButton annotationId={a.id} />}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <AnnotationPagination offset={offset} limit={LIMIT} total={total} />
    </div>
  );
}
