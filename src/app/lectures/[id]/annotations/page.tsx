// src/app/lectures/[id]/annotations/page.tsx
import {
  getLectureAnnotations,
  AnnotationCard,
  AnnotationAnchorContext,
  AnnotationExportLinks,
  AnnotationPagination,
} from "@/features/annotations";

export const metadata = { title: "Аннотации лекции" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offset?: string }>;
}

const LIMIT = 20;

/**
 * Агрегированный ПРОСМОТР аннотаций лекции (document/comment/media). На саму
 * лекцию аннотация не создаётся — только просмотр. Отдельная страница, чтобы
 * не трогать src/app/lectures/[id]/page.tsx (резервирует comments).
 */
export default async function LectureAnnotationsPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { offset: rawOffset } = await searchParams;
  const offset = Math.max(0, Number(rawOffset ?? 0) || 0);
  const { items, total } = await getLectureAnnotations(id, offset, LIMIT);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Аннотации лекции</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">
          К материалам этой лекции пока нет аннотаций.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationCard
                annotation={a}
                anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                actions={a.id ? <AnnotationExportLinks id={a.id} /> : null}
              />
            </li>
          ))}
        </ul>
      )}
      <AnnotationPagination offset={offset} limit={LIMIT} total={total} />
    </main>
  );
}
