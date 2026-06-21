"use client";
import { useSyncExternalStore } from "react";

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
 * Резолвит, нужно ли уменьшать движение (JS-сторона).
 *   reduced → true | full → false | system → следует OS prefers-reduced-motion.
 * Реактивен к смене настройки (через useAppearance) и к смене OS-настройки (matchMedia).
 *
 * ВАЖНО: это JS-ЗЕРКАЛО CSS-формулы из globals.css (reduced-motion gate).
 * При правке логики здесь — синхронно правь CSS-gate, и наоборот.
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
  if (appearance.motion === "reduced") return true;
  if (appearance.motion === "full") return false;
  return osReduce;
}
