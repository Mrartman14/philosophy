// src/features/trails/ui/trail-detail.tsx
import { RouterLink } from "@/components/ui";

import type { TrailWithItems, TrailDocumentSummary } from "../types";

interface Props {
  trail: TrailWithItems;
  /** Резолвнутые метаданные документов в порядке items (см. страница маршрута). */
  documents: TrailDocumentSummary[];
}

export function TrailDetail({ trail, documents }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {trail.description && (
        <p className="whitespace-pre-line text-sm text-(--color-fg-muted)">
          {trail.description}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Документы маршрута</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-(--color-fg-muted)">В маршруте пока нет документов.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {documents.map((doc, index) => (
              <li key={doc.id} className="text-sm">
                {index + 1}.{" "}
                <RouterLink href={`/documents/${doc.id}`} className="hover:underline">
                  {doc.filename}
                </RouterLink>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
