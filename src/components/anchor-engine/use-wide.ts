"use client";
// src/components/anchor-engine/use-wide.ts
// Единый wide-гейт движка маргиналий: детектит РАСКРЫТИЕ полей так же, как
// CSS-раскрытие в layout.css. Слайсы (AnnotationScope/CommentAnchorScope) зовут
// useWide() и на narrow текут inline под телом скоупа, на wide — рисуют колонку
// маргиналий (rail). Дублировался инлайн — извлечён сюда, чтобы условие жило в
// ОДНОМ месте.
//
// ── Почему container, а не matchMedia (фикс дрейфа порога 2026-07-01) ──
// Раскрытие полей в layout.css переведено на `@container page-shell
// (min-width: 80em)` на size-контейнере <main.page-shell> (container-type:
// inline-size). `em` в контейнер-квери резолвится от ВЫЧИСЛЕННОГО (уже
// масштабированного осью --text-scale) font-size контейнера, поэтому порог
// масштаб-ИНВАРИАНТЕН: поле открыто ⟺ inline-size контейнера ≥ 80 × его
// font-size(px). Прежний `matchMedia("(min-width: 80rem)")` был ВЬЮПОРТНЫМ и
// scale-ВАРИАНТНЫМ (rem в media считается от исходного кегля браузера, не от
// нашего <html font-size>): при не-дефолтном --text-scale поле CSS-открыто, а
// JS думал wide=false (или наоборот) → карточки уходили inline, хотя маргиналия
// есть. Тот же инвариант, что marginalia-container-coordination.test: всё, что
// координируется с reveal, обязано мерить контейнер-порог, а не вьюпортный.
//
// Реализация: ResizeObserver на .page-shell пересчитывает
// clientWidth ≥ WIDE_EM × getComputedStyle(container).fontSize при resize И при
// смене --text-scale (root font-size меняет rem-хребет/поля → контейнер
// рефлоу­ит → RO файрит; колбэк перечитывает живой font-size). SSR/без
// ResizeObserver/без контейнера → false (безопасный дефолт: рисуем inline-фолбэк).
import { useEffect, useState } from "react";

// Порог раскрытия полей-маргиналий в `em` (единица size-контейнера) — тот же
// «owner» числа 80, что и `@container page-shell (min-width: 80em)` в layout.css
// и токен --container-marginalia. Держать синхронно.
export const WIDE_EM = 80;

// Селектор size-контейнера маргиналий (<main class="page-shell"> в layout.tsx),
// единственный элемент с container-type: inline-size / container-name: page-shell.
const CONTAINER_SELECTOR = ".page-shell";

export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined" || typeof ResizeObserver === "undefined") return;
    const container = document.querySelector<HTMLElement>(CONTAINER_SELECTOR);
    if (!container) return;
    const measure = () => {
      // font-size контейнера уже включает --text-scale (root font-size ×
      // scale) → em-порог едет синхронно с CSS-раскрытием. Фолбэк 16 для
      // пустого computed (jsdom/крайние случаи).
      const fontPx = parseFloat(getComputedStyle(container).fontSize) || 16;
      setWide(container.clientWidth >= WIDE_EM * fontPx);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => {
      ro.disconnect();
    };
  }, []);
  return wide;
}
