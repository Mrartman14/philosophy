// src/features/lectures/ui/lecture-list.tsx
import { EmptyState } from "@/components/ui";
import type { Lecture, LectureTag } from "../types";
import { LectureCard } from "./lecture-card";

export function LectureList({
  items,
  tagsByLectureId,
}: {
  items: Lecture[];
  tagsByLectureId?: Record<string, LectureTag[]>;
}) {
  if (items.length === 0) {
    return <EmptyState title="Лекций не найдено" description="Попробуйте изменить фильтры или поиск." />;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((lecture) => (
        <li key={lecture.id}>
          <LectureCard lecture={lecture} tags={tagsByLectureId?.[lecture.id]} />
        </li>
      ))}
    </ul>
  );
}
