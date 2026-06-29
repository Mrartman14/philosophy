import { THEME_COLOR } from "@/styles/theme-color.generated";
import { THEMES, CONTRASTS, DENSITIES, FONTS, TEXT_SIZES, MOTIONS, TEXT_ALIGNS,
  type Theme, type Contrast, type Density, type FontChoice, type TextSize, type Motion, type TextAlign } from "@/styles/tokens/enums";
import { TEXT_SCALE } from "@/styles/tokens/scales";

export interface Appearance { theme: Theme; contrast: Contrast; density: Density; font: FontChoice; textSize: TextSize; motion: Motion; textAlign: TextAlign }
export const APPEARANCE_COOKIE = "appearance";
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", contrast: "auto", density: "comfortable", font: "sans", textSize: "md", motion: "system", textAlign: "start" };

const ENUMS = { theme: THEMES, contrast: CONTRASTS, density: DENSITIES, font: FONTS, textSize: TEXT_SIZES, motion: MOTIONS, textAlign: TEXT_ALIGNS } as const;
function pick<K extends keyof Appearance>(key: K, value: unknown): Appearance[K] {
  return (ENUMS[key] as readonly string[]).includes(value as string) ? (value as Appearance[K]) : DEFAULT_APPEARANCE[key];
}
export function parseAppearance(raw: string | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw) as Record<string, unknown>; } catch { return DEFAULT_APPEARANCE; }
  return { theme: pick("theme", o.theme), contrast: pick("contrast", o.contrast), density: pick("density", o.density), font: pick("font", o.font), textSize: pick("textSize", o.textSize), motion: pick("motion", o.motion), textAlign: pick("textAlign", o.textAlign) };
}
export function serializeAppearance(a: Appearance): string { return JSON.stringify(a); }
export function htmlAttrs(a: Appearance) {
  return {
    ...(a.theme !== "system" ? { "data-theme": a.theme } : {}),
    // "auto" → no attribute (OS prefers-contrast applies via :not([data-contrast]));
    // explicit "normal"/"high" → emit the attribute (normal opts out of the OS boost).
    ...(a.contrast !== "auto" ? { "data-contrast": a.contrast } : {}),
    ...(a.density !== "comfortable" ? { "data-density": a.density } : {}),
    ...(a.font !== "sans" ? { "data-font": a.font } : {}),
    // "system" → нет атрибута (правит OS prefers-reduced-motion через CSS-gate);
    // "reduced"/"full" → эмитим (full перебивает OS-запрос в CSS).
    ...(a.motion !== "system" ? { "data-motion": a.motion } : {}),
    // "start" → нет атрибута (дефолтный поток text-align: start); "justify" эмитим
    // → content.css юстирует прозу + включает переносы.
    ...(a.textAlign !== "start" ? { "data-align": a.textAlign } : {}),
    style: { "--text-scale": String(TEXT_SCALE[a.textSize]) } as Record<string, string>,
    colorScheme: a.theme === "system" ? "light dark" : a.theme,
  };
}

/**
 * theme-color (адресная строка/PWA-хром) под РАЗРЕШЁННУЮ тему, не под ОС.
 * Тема в проекте — cookie-выбор, поэтому при явных light/dark цвет хрома
 * фиксирован под surface этой темы (иначе хром бы спорил с ОС-настройкой).
 * Только system отдаёт ОС решать → пара под prefers-color-scheme.
 * Контраст на surface не влияет (light/light-high и dark/dark-high делят bg),
 * поэтому ветвимся лишь по theme.
 */
export type ThemeColorMeta =
  | { type: "fixed"; color: string }
  | { type: "adaptive"; light: string; dark: string };

export function themeColorMeta(a: Appearance): ThemeColorMeta {
  if (a.theme === "light") return { type: "fixed", color: THEME_COLOR.light };
  if (a.theme === "dark") return { type: "fixed", color: THEME_COLOR.dark };
  return { type: "adaptive", light: THEME_COLOR.light, dark: THEME_COLOR.dark };
}
