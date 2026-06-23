"use client";
import { useSyncExternalStore } from "react";

import { isReducedMotion } from "@/utils/is-reduced-motion";

import { useAppearance } from "./appearance-provider";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => { mq.removeEventListener("change", cb); };
}
function getOSReduce(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * Резолвит, нужно ли уменьшать движение (JS-сторона) — реактивная обёртка над
 * чистым предикатом `isReducedMotion`. Сама формула живёт в `is-reduced-motion.ts`
 * (общий источник истины для этого хука и `withViewTransition`); хук лишь
 * добавляет реактивность к смене настройки (через useAppearance) и к смене
 * OS-настройки (matchMedia).
 *
 * ВАЖНО: `isReducedMotion` — это JS-ЗЕРКАЛО CSS-формулы из globals.css
 * (reduced-motion gate). При правке логики там — синхронно правь CSS-gate,
 * и наоборот.
 *
 * ОБЛАСТЬ ПРИМЕНЕНИЯ: только клиент — `dynamic(ssr:false)`-поддеревья и
 * рантайм-поведение/эффекты (напр. Three OrbitControls damping). НЕ использовать
 * для условной SSR-разметки: getServerSnapshot возвращает false, поэтому при
 * наличии OS-настройки reduce клиентский гидрейт разойдётся с серверным (hydration
 * mismatch). Для SSR-безопасного статического подавления движения полагайся на
 * CSS-gate (`data-motion` + `@media`) — он работает без FOUC.
 *
 * (Здесь намеренно НЕТ `typeof window`-гарда: он триггерит ESLint
 * `no-unnecessary-condition`, поэтому был удалён.)
 */
export function useReducedMotion(): boolean {
  const { appearance } = useAppearance();
  const osReduce = useSyncExternalStore(subscribe, getOSReduce, () => false);
  return isReducedMotion({ motion: appearance.motion, osReduce });
}
