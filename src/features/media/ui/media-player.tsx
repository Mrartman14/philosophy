"use client";
// src/features/media/ui/media-player.tsx
import { useT } from "@/i18n/client";

import type { FileType } from "../types";

interface MediaPlayerProps {
  /** Подписанный url с бекенда (GET /api/media/{id} возвращает url). */
  url: string;
  type: FileType;
  filename: string;
}

/**
 * Нативный плеер без сторонних библиотек: <video> для type=video,
 * <audio> для type=audio. url — подписанная ссылка с бекенда.
 */
export function MediaPlayer({ url, type, filename }: MediaPlayerProps) {
  const t = useT("media");

  if (type === "video") {
    return (
      <video
        controls
        preload="metadata"
        className="w-full max-h-[70vh] rounded bg-black"
      >
        <source src={url} />
        <track kind="captions" />
        {t("videoBrowserFallback")}
      </video>
    );
  }
  return (
    <audio controls preload="metadata" className="w-full" aria-label={filename}>
      <source src={url} />
      <track kind="captions" />
      {t("audioBrowserFallback")}
    </audio>
  );
}
