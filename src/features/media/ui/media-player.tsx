"use client";
// src/features/media/ui/media-player.tsx
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
  if (type === "video") {
    return (
      <video
        controls
        preload="metadata"
        className="w-full max-h-[70vh] rounded bg-black"
      >
        <source src={url} />
        Ваш браузер не поддерживает воспроизведение видео.
      </video>
    );
  }
  return (
    <audio controls preload="metadata" className="w-full" aria-label={filename}>
      <source src={url} />
      Ваш браузер не поддерживает воспроизведение аудио.
    </audio>
  );
}
