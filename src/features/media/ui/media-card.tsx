// src/features/media/ui/media-card.tsx
import { cn, FOCUS_RING_CONTROL, RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import type { MediaListItem } from "../types";

interface MediaCardProps {
  media: MediaListItem;
}

/** Карточка медиа в списке «Мои медиа». Ссылка на /media/{id} + бейджи. */
export async function MediaCard({ media }: MediaCardProps) {
  const t = await getT("media");
  const isPublic = media.visibility === "public";
  const typeLabel: Record<string, string> = {
    video: t("typeVideo"),
    audio: t("typeAudio"),
  };

  return (
    <RouterLink
      href={`/media/${media.id}`}
      className={cn(
        "flex flex-col gap-2 rounded border border-(--color-border) p-4 hover:bg-(--color-surface-subtle)",
        FOCUS_RING_CONTROL,
      )}
    >
      <span className="truncate font-semibold" title={media.filename}>
        {media.filename}
      </span>
      <span className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
        <span className="rounded bg-(--color-surface-subtle) px-2 py-0.5">
          {media.type ? (typeLabel[media.type] ?? media.type) : null}
        </span>
        <span
          className={
            isPublic
              ? "rounded px-2 py-0.5 text-(--color-success)"
              : "rounded px-2 py-0.5 text-(--color-fg-muted)"
          }
        >
          {isPublic ? t("statusPublic") : t("statusPrivate")}
        </span>
      </span>
    </RouterLink>
  );
}
