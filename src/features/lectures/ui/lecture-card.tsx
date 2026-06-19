// src/features/lectures/ui/lecture-card.tsx
import { chipClass, RouterLink } from "@/components/ui";

import { lectureCoverUrl } from "../cover-url";
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
  const coverUrl = lectureCoverUrl(lecture.cover_image_key ?? null);
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-4 transition hover:bg-(--color-surface-subtle)">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={lecture.cover_image_alt ?? ""}
          className="mb-2 h-32 w-full rounded object-cover"
        />
      )}
      <RouterLink href={`/lectures/${lecture.id}`} className="text-base font-semibold hover:underline">
        {lecture.title}
      </RouterLink>
      <p className="text-xs text-(--color-fg-muted)">{lecture.date}</p>
      {lecture.description && (
        <p className="line-clamp-3 text-sm text-(--color-fg-muted)">{lecture.description}</p>
      )}
      {tags && tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <li key={tag.name}>
              <RouterLink
                href={`/lectures?tag=${encodeURIComponent(tag.name)}`}
                className={chipClass({ interactive: true })}
              >
                {tag.name}
              </RouterLink>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
