// src/features/trails/ui/trail-detail.tsx
import Link from "next/link";

import type { TrailWithItems, TrailLectureSummary } from "../types";

interface Props {
  trail: TrailWithItems;
  /** Резолвнутые заголовки лекций в порядке items (см. страница маршрута). */
  lectures: TrailLectureSummary[];
}

export function TrailDetail({ trail, lectures }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {trail.description && (
        <p className="whitespace-pre-line text-sm text-(--color-description)">
          {trail.description}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Лекции маршрута</h2>
        {lectures.length === 0 ? (
          <p className="text-sm text-(--color-description)">В маршруте пока нет лекций.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {lectures.map((lecture, index) => (
              <li key={lecture.id} className="text-sm">
                {index + 1}.{" "}
                <Link href={`/lectures/${lecture.id}`} className="hover:underline">
                  {lecture.title}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
