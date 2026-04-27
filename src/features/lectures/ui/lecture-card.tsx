// src/features/lectures/ui/lecture-card.tsx
import Link from "next/link";
import type { Lecture } from "../types";

export function LectureCard({ lecture }: { lecture: Lecture }) {
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-4 transition hover:bg-(--color-text-pane)">
      <Link href={`/lectures/${lecture.id}`} className="text-base font-semibold hover:underline">
        {lecture.title}
      </Link>
      <p className="text-xs text-(--color-description)">{lecture.date}</p>
      {lecture.description && (
        <p className="line-clamp-3 text-sm text-(--color-description)">{lecture.description}</p>
      )}
    </article>
  );
}
