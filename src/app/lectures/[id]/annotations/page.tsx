// src/app/lectures/[id]/annotations/page.tsx
import { Pagination } from "@/components/ui";
import {
  getLectureAnnotations,
  AnnotationCard,
  AnnotationAnchorContext,
  AnnotationExportLinks,
} from "@/features/annotations";
import { getT } from "@/i18n";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("lectureAnnotationsTitle") };
}

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
  const sp = await searchParams;
  const offset = parseNonNegativeInt(sp.offset, 0);
  const { items, total } = await getLectureAnnotations(id, offset, LIMIT);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t("lectureAnnotationsHeading")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">
          {t("lectureAnnotationsEmpty")}
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
      <Pagination basePath={`/lectures/${id}/annotations`} offset={offset} limit={LIMIT} total={total} searchParams={sp} />
    </div>
  );
}
