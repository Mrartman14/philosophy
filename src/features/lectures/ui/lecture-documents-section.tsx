import { RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import { getLectureDocuments } from "../api";

interface Props {
  lectureId: string;
}

/**
 * Секция «Документы лекции» на публичной странице (read-only список со
 * ссылками на /documents/{id}). Данные — GET /api/lectures/{id}/documents
 * (по sort_order). Композиция через страницу; рендер тела документа — на его
 * собственной странице.
 */
export async function LectureDocumentsSection({ lectureId }: Props) {
  const tL = await getT("lectures");
  const docs = await getLectureDocuments(lectureId);
  if (docs.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={tL("documentsSectionLabel")}>
      <h2 className="text-lg font-semibold">{tL("documentsSectionHeading")}</h2>
      <ul className="flex flex-col gap-1">
        {docs.map((d) => (
          <li key={d.id}>
            <RouterLink
              href={`/documents/${d.id}`}
              className="text-sm underline hover:no-underline"
            >
              {d.filename ?? d.id}
            </RouterLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
