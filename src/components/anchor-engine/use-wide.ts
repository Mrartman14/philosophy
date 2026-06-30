"use client";
// src/components/anchor-engine/use-wide.ts
// Единый wide-гейт движка маргиналий: matchMedia(WIDE_MEDIA) с подпиской на смену.
// Дублировался инлайн (annotation-scope, comment-anchor-scope) — извлечён сюда,
// чтобы порог жил в ОДНОЙ константе. SSR → false (рисуем inline-фолбэк под телом
// скоупа), после mount поднимаем при совпадении media. Guard на отсутствие
// matchMedia (jsdom/SSR) → остаётся false, не подписывается, не бросает.
import { useEffect, useState } from "react";

// Порог раскрытия полей-маргиналий. ВАЖНО: значение `80rem` (НЕ `80em`) — это
// сознательное foundation-решение для wide-гейта rail; @container-порог
// marginalia-layout (`80em`) — отдельная ось, синхронить их здесь НЕ нужно.
export const WIDE_MEDIA = "(min-width: 80rem)";

export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE_MEDIA);
    const sync = () => {
      setWide(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, []);
  return wide;
}
