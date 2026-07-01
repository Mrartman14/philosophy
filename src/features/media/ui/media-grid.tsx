// src/features/media/ui/media-grid.tsx
import { EmptyState } from "@/components/ui";
import { getT } from "@/i18n";

import type { MediaListItem } from "../types";

import { MediaCard } from "./media-card";

interface MediaGridProps {
  items: MediaListItem[];
}

/** Грид карточек «Мои медиа» с пустым состоянием. */
export async function MediaGrid({ items }: MediaGridProps) {
  const t = await getT("media");

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
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
