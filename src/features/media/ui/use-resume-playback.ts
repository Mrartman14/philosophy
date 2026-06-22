"use client";
// src/features/media/ui/use-resume-playback.ts
import { useEffect, type RefObject } from "react";

const KEY_PREFIX = "media-resume:";
/** Не возобновляем, если сохранённая позиция меньше — почти начало. */
const MIN_RESUME = 5;
/** Не возобновляем, если позиция ближе к концу, чем (duration − END_GUARD). */
const END_GUARD = 5;
/** Минимальный интервал между записями позиции, мс. */
const SAVE_THROTTLE_MS = 5000;

function readPos(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function writePos(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // приватный режим / квота / хранилище выключено — тихо
  }
}
function removePos(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Возобновление позиции воспроизведения через localStorage. Временный стопгап —
 * бек не хранит позицию (см. бек-аски в спеке). Без визуального UI.
 */
export function useResumePlayback(
  ref: RefObject<HTMLMediaElement | null>,
  mediaId: string,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = `${KEY_PREFIX}${mediaId}`;

    const onLoaded = (): void => {
      const saved = readPos(key);
      if (saved == null) return;
      const duration = el.duration;
      const upper = Number.isFinite(duration) ? duration - END_GUARD : Infinity;
      if (saved > MIN_RESUME && saved < upper) {
        el.currentTime = saved;
      }
    };

    let lastSaved = -Infinity;
    const onTimeUpdate = (): void => {
      const now = Date.now();
      if (now - lastSaved < SAVE_THROTTLE_MS) return;
      lastSaved = now;
      writePos(key, el.currentTime);
    };

    const onEnded = (): void => {
      removePos(key);
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [ref, mediaId]);
}
