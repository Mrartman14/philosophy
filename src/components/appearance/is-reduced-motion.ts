import type { Motion } from "@/styles/tokens/enums";

/**
 * Единая формула приглушения движения (JS-сторона). Источник истины для
 * useReducedMotion (React-стейт) и withViewTransition (DOM dataset).
 * ЗЕРКАЛО CSS-гейта в globals.css — правишь одно, синхронно правь второе.
 *   reduced → true | full → false | system → следует OS prefers-reduced-motion.
 */
export function isReducedMotion(input: { motion: Motion; osReduce: boolean }): boolean {
  if (input.motion === "reduced") return true;
  if (input.motion === "full") return false;
  return input.osReduce;
}
