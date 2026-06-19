// src/features/media/ui/media-card.tsx
import { RouterLink } from "@/components/ui";

import type { Media } from "../types";

interface MediaCardProps {
  media: Media;
}

const typeLabel: Record<string, string> = {
  video: "Видео",
  audio: "Аудио",
};

/** Карточка медиа в списке «Мои медиа». Ссылка на /media/{id} + бейджи. */
export function MediaCard({ media }: MediaCardProps) {
  const isPublic = media.visibility === "public";
  return (
    <RouterLink
      href={`/media/${media.id}`}
      className="flex flex-col gap-2 rounded border border-(--color-border) p-4 hover:bg-(--color-surface-subtle) focus:outline-0"
    >
      <span className="truncate font-semibold" title={media.filename}>
        {media.filename}
      </span>
      <span className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
        <span className="rounded bg-(--color-surface-subtle) px-2 py-0.5">
          {typeLabel[media.type] ?? media.type}
        </span>
        <span
          className={
            isPublic
              ? "rounded px-2 py-0.5 text-(--color-success)"
              : "rounded px-2 py-0.5 text-(--color-fg-muted)"
          }
        >
          {isPublic ? "Опубликовано" : "Приватно"}
        </span>
      </span>
    </RouterLink>
  );
}
