// src/features/lectures/ui/lecture-list.tsx
import { EmptyState } from "@/components/ui";
import { getT } from "@/i18n";

import type { Lecture, LectureTag } from "../types";

import { LectureCard } from "./lecture-card";

export async function LectureList({
  items,
  tagsByLectureId,
}: {
  items: Lecture[];
  tagsByLectureId?: Record<string, LectureTag[]>;
}) {
  const tL = await getT("lectures");

  if (items.length === 0) {
    return <EmptyState title={tL("emptyTitle")} description={tL("emptyDescription")} />;
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
