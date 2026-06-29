// src/features/media/ui/media-admin-row.tsx
import { UserView } from "@/components/shared/user-view";
import { getServerFmt, getT } from "@/i18n";

import type { AdminMediaItem } from "../types";

import { MediaDeleteButton } from "./media-delete-button";

interface Props {
  media: AdminMediaItem;
}

/**
 * Строка admin-списка медиа (модерация). Показывает владельца, имя файла, тип,
 * видимость и дату создания, плюс admin-удаление через переиспользуемый
 * MediaDeleteButton (isAdminDelete → admin-текст подтверждения, action
 * deleteMedia owner-or-media.delete_any). На этой странице актор всегда админ с
 * media.delete_any, листинг неприватный → кнопка показывается для каждого id.
 */
export async function MediaAdminRow({ media }: Props) {
  const [t, fmt] = await Promise.all([getT("media"), getServerFmt()]);
  const typeLabel: Record<string, string> = {
    video: t("typeVideo"),
    audio: t("typeAudio"),
  };
  const isPublic = media.visibility === "public";

  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-fg-muted)">
        <span className="truncate font-semibold text-(--color-fg)" title={media.filename}>
          {media.filename}
        </span>
        <span>{fmt.dateTime(media.created_at, { dateStyle: "short", timeStyle: "short" })}</span>
      </header>
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-fg-muted)">
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
          {isPublic ? t("statusPublic") : t("statusPrivate")}
        </span>
        <UserView username={media.owner_username} id={media.owner_id} />
      </div>
      <div>
        <MediaDeleteButton id={media.id} isAdminDelete />
      </div>
    </article>
  );
}
