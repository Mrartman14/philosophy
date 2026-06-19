// src/features/media/ui/media-detail.tsx
import { getT } from "@/i18n";

import type { Media, MediaAttachment } from "../types";

import { MediaContainers } from "./media-containers";
import { MediaDeleteButton } from "./media-delete-button";
import { MediaPlayer } from "./media-player";
import { MediaVisibilityForm } from "./media-visibility-form";

interface MediaDetailProps {
  media: Media;
  containers: MediaAttachment[];
  /** canDeleteMedia(me, media) со страницы. */
  canDelete: boolean;
  /** canChangeMediaVisibility(me, media) со страницы. */
  canChangeVisibility: boolean;
  /** true — удаление происходит по admin-капе (не owner). Для текста диалога. */
  isAdminDelete: boolean;
}

/** Композиция страницы просмотра одного медиа. */
export async function MediaDetail({
  media,
  containers,
  canDelete,
  canChangeVisibility,
  isAdminDelete,
}: MediaDetailProps) {
  const t = await getT("media");
  const isPublic = media.visibility === "public";
  const typeLabel: Record<string, string> = {
    video: t("typeVideo"),
    audio: t("typeAudio"),
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold break-words">{media.filename}</h1>
        <div className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
          <span className="rounded bg-(--color-surface-subtle) px-2 py-0.5">
            {typeLabel[media.type] ?? media.type}
          </span>
          <span>{isPublic ? t("statusPublic") : t("statusPrivate")}</span>
        </div>
      </header>

      {media.url ? (
        <MediaPlayer url={media.url} type={media.type} filename={media.filename} />
      ) : (
        <p className="text-sm text-(--color-fg-muted)">
          {t("unavailable")}
        </p>
      )}

      {(canChangeVisibility || canDelete) && (
        <div className="flex items-center gap-3">
          <MediaVisibilityForm id={media.id} canChange={canChangeVisibility} />
          {canDelete && (
            <MediaDeleteButton id={media.id} isAdminDelete={isAdminDelete} />
          )}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("lecturesSection")}</h2>
        <MediaContainers containers={containers} />
      </section>
    </div>
  );
}
