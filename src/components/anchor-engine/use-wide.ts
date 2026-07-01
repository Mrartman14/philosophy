"use client";
// src/components/anchor-engine/use-wide.ts
// Единый wide-гейт движка маргиналий: matchMedia(WIDE) с подпиской на смену.
// Дублировался инлайн (annotation-scope, comment-anchor-scope) — извлечён сюда,
// чтобы гейт жил в ОДНОМ хуке. Медиа-порог берём из ЕДИНОЙ константы WIDE
// (breakpoints.ts) — тот же, что у колонки карточек и выносок, иначе rail включался
// бы рассинхронно. SSR → false (рисуем inline-фолбэк под телом скоупа), после mount
// поднимаем при совпадении media. Guard на отсутствие matchMedia (jsdom/SSR) →
// остаётся false, не подписывается, не бросает.
import { useEffect, useState } from "react";

import { WIDE } from "./breakpoints";

export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE);
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
