// src/features/lectures/ui/lecture-detail.tsx
import Link from "next/link";
import type { Lecture, LectureTag } from "../types";
import { lectureCoverUrl } from "../cover-url";

export function LectureDetail({
  lecture,
  tags,
}: {
  lecture: Lecture;
  tags?: LectureTag[];
}) {
  const coverUrl = lectureCoverUrl(lecture.cover_image_key ?? null);
  return (
    <article className="flex flex-col gap-4">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt={lecture.cover_image_alt ?? ""}
          className="max-h-80 w-full rounded-lg object-cover"
        />
      )}
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{lecture.title}</h1>
        <p className="text-sm text-(--color-description)">{lecture.date}</p>
        {tags && tags.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1">
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
      </header>
      {lecture.description && (
        <div className="whitespace-pre-wrap text-base">{lecture.description}</div>
      )}
    </article>
  );
}
