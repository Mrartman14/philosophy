"use client";
// src/features/media/ui/media-player.tsx
import { useCallback, useRef } from "react";

import { useT } from "@/i18n/client";

import type { FileType } from "../types";

import { useMediaSession } from "./use-media-session";
import { useResumePlayback } from "./use-resume-playback";

interface MediaPlayerProps {
  /** Подписанный url с бекенда (GET /api/media/{id} возвращает url). */
  url: string;
  type: FileType;
  filename: string;
  /** id медиа — ключ для возобновления позиции. */
  mediaId: string;
}

/** filename → title без расширения для metadata локскрина. */
function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Нативный плеер без сторонних библиотек: <video> для type=video,
 * <audio> для type=audio. url — подписанная ссылка с бекенда. Подключает
 * navigator.mediaSession и возобновление позиции (прогрессивное улучшение).
 */
export function MediaPlayer({ url, type, filename, mediaId }: MediaPlayerProps) {
  const t = useT("media");
  const ref = useRef<HTMLMediaElement>(null);
  // callback-ref: один ref на <audio>/<video> без cast (контравариантность
  // параметра позволяет (HTMLMediaElement|null) => void там, где ждут <video>).
  const setRef = useCallback((el: HTMLMediaElement | null) => {
    ref.current = el;
  }, []);

  useMediaSession(ref, {
    title: stripExtension(filename),
    artist: t("playerArtist"),
  });
  useResumePlayback(ref, mediaId);

  if (type === "video") {
    return (
      <video
        ref={setRef}
        controls
        preload="metadata"
        className="w-full max-h-[70vh] rounded bg-black"
        aria-label={filename}
      >
        <source src={url} />
        <track kind="captions" />
        {t("videoBrowserFallback")}
      </video>
    );
  }
  return (
    <audio
      ref={setRef}
      controls
      preload="metadata"
      className="w-full"
      aria-label={filename}
    >
      <source src={url} />
      <track kind="captions" />
      {t("audioBrowserFallback")}
    </audio>
  );
}
