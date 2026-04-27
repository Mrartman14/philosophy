// src/features/lectures/ui/lecture-detail.tsx
import type { Lecture } from "../types";

export function LectureDetail({ lecture }: { lecture: Lecture }) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{lecture.title}</h1>
        <p className="text-sm text-(--color-description)">{lecture.date}</p>
      </header>
      {lecture.description && (
        <div className="whitespace-pre-wrap text-base">{lecture.description}</div>
      )}
    </article>
  );
}
