// src/features/lectures/ui/lecture-card.tsx
import Link from "next/link";
import type { Lecture, LectureTag } from "../types";

export function LectureCard({
  lecture,
  tags,
}: {
  lecture: Lecture;
  // `| undefined` — для exactOptionalPropertyTypes: LectureList передаёт
  // `tagsByLectureId?.[id]`, который может быть undefined.
  tags?: LectureTag[] | undefined;
}) {
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-4 transition hover:bg-(--color-text-pane)">
      <Link href={`/lectures/${lecture.id}`} className="text-base font-semibold hover:underline">
        {lecture.title}
      </Link>
      <p className="text-xs text-(--color-description)">{lecture.date}</p>
      {lecture.description && (
        <p className="line-clamp-3 text-sm text-(--color-description)">{lecture.description}</p>
      )}
      {tags && tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li key={tag.name}>
              <Link
                href={`/lectures?tag=${encodeURIComponent(tag.name)}`}
                className="rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-description) hover:bg-(--color-text-pane)"
              >
                {tag.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
