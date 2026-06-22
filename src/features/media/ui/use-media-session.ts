"use client";
// src/features/media/ui/use-media-session.ts
import { useEffect, type RefObject } from "react";

export interface MediaSessionMeta {
  title: string;
  artist: string;
}

/** Шаг перемотки по умолчанию (сек), если ОС не прислала seekOffset. */
const SEEK_STEP = 10;

/** Обложка для локскрина — иконки приложения из манифеста. */
const ARTWORK = [
  { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
];

/**
 * Привязывает navigator.mediaSession к media-элементу: метаданные, обработчики
 * действий (play/pause/seek/seekto), playbackState и setPositionState.
 * Прогрессивное улучшение — no-op без поддержки. Все хендлеры/слушатели
 * снимаются на unmount.
 */
export function useMediaSession(
  ref: RefObject<HTMLMediaElement | null>,
  meta: MediaSessionMeta,
): void {
  const { title, artist } = meta;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }
    const ms = navigator.mediaSession;

    ms.metadata = new MediaMetadata({ title, artist, artwork: [...ARTWORK] });

    const updatePosition = (): void => {
      const duration = el.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const position = Math.min(Math.max(el.currentTime, 0), duration);
      try {
        ms.setPositionState({
          duration,
          position,
          playbackRate: el.playbackRate || 1,
        });
      } catch {
        // некоторые браузеры бросают на невалидном state — игнорируем
      }
    };

    const onPlay = (): void => {
      ms.playbackState = "playing";
      updatePosition();
    };
    const onPause = (): void => {
      ms.playbackState = "paused";
    };

    el.addEventListener("loadedmetadata", updatePosition);
    el.addEventListener("timeupdate", updatePosition);
    el.addEventListener("ratechange", updatePosition);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        "play",
        () => {
          // play() из обработчика ОС может отклониться (autoplay-политика,
          // прерванный load) — гасим, чтобы не было unhandled rejection.
          el.play().catch(() => {
            /* ignore */
          });
        },
      ],
      [
        "pause",
        () => {
          el.pause();
        },
      ],
      [
        "seekbackward",
        (d) => {
          const offset = d.seekOffset ?? SEEK_STEP;
          el.currentTime = Math.max(0, el.currentTime - offset);
        },
      ],
      [
        "seekforward",
        (d) => {
          const offset = d.seekOffset ?? SEEK_STEP;
          const max = Number.isFinite(el.duration) ? el.duration : Infinity;
          el.currentTime = Math.min(max, el.currentTime + offset);
        },
      ],
      [
        "seekto",
        (d) => {
          if (d.seekTime == null) return;
          if (d.fastSeek && "fastSeek" in el) {
            el.fastSeek(d.seekTime);
            return;
          }
          el.currentTime = d.seekTime;
        },
      ],
    ];
    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // действие не поддерживается этим браузером — пропускаем
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
      el.removeEventListener("loadedmetadata", updatePosition);
      el.removeEventListener("timeupdate", updatePosition);
      el.removeEventListener("ratechange", updatePosition);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      ms.metadata = null;
      ms.playbackState = "none";
    };
  }, [ref, title, artist]);
}
