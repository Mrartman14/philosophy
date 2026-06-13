// src/features/media/ui/media-grid.tsx
import { EmptyState } from "@/components/ui";
import type { Media } from "../types";
import { MediaCard } from "./media-card";

interface MediaGridProps {
  items: Media[];
}

/** Грид карточек «Мои медиа» с пустым состоянием. */
export function MediaGrid({ items }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Пока нет медиа"
        description="Загрузите видео или аудио — оно появится здесь."
      />
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => (
        <li key={m.id}>
          <MediaCard media={m} />
        </li>
      ))}
    </ul>
  );
}
