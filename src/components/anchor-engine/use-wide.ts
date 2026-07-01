"use client";
// src/components/anchor-engine/use-wide.ts
// Реактивный wide-гейт движка маргиналий поверх isMarginaliaWide() (container-детект
// .page-shell, scale-инвариантно — см. breakpoints.ts). Дублировался инлайн
// (annotation-scope, comment-anchor-scope) — извлечён сюда, чтобы гейт жил в ОДНОМ
// хуке, синхронно с колонкой карточек и выносками.
//
// Пересчёт по двум каналам:
//  • ResizeObserver на .page-shell — смена inline-size контейнера (ресайз окна,
//    открытие/закрытие сайдбара) двигает ширину относительно порога;
//  • MutationObserver на <html> — смена `--text-scale`/атрибутов темы меняет
//    font-size контейнера → порог (80em × fontSize) сдвигается БЕЗ смены ширины,
//    поэтому ResizeObserver бы это пропустил;
//  • window.resize — дешёвый фолбэк (нет ResizeObserver / контейнер найден позже).
//
// SSR / нет .page-shell → false (рисуем inline-фолбэк под телом скоупа), после mount
// поднимаем при совпадении. Guards на отсутствие API (jsdom) → остаётся false, не бросает.
import { useEffect, useState } from "react";

import { isMarginaliaWide, PAGE_SHELL_SELECTOR } from "./breakpoints";

export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const sync = () => {
      setWide(isMarginaliaWide());
    };
    sync();

    const shell = document.querySelector<HTMLElement>(PAGE_SHELL_SELECTOR);
    let ro: ResizeObserver | undefined;
    if (shell && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(sync);
      ro.observe(shell);
    }
    let mo: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(sync);
      mo.observe(document.documentElement, { attributes: true });
    }
    window.addEventListener("resize", sync);
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);
  return wide;
}
