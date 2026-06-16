// src/features/lectures/ui/lecture-detail.tsx
import { RouterLink } from "@/components/ui";

import { lectureCoverUrl } from "../cover-url";
import type { Lecture, LectureTag } from "../types";

import { LectureDescription } from "./lecture-description";
import { LectureHeaderView } from "./lecture-header-view";

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
      <header className="flex flex-col gap-1">
        <LectureHeaderView
          coverSrc={coverUrl}
          coverAlt={lecture.cover_image_alt ?? ""}
          title={lecture.title}
          date={lecture.date}
        />
        {tags && tags.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <li key={tag.name}>
                <RouterLink
                  href={`/lectures?tag=${encodeURIComponent(tag.name)}`}
                  className="rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-description) hover:bg-(--color-text-pane)"
                >
                  {tag.name}
                </RouterLink>
              </li>
            ))}
          </ul>
        )}
      </header>
      {lecture.description && <LectureDescription description={lecture.description} />}
    </article>
  );
}
