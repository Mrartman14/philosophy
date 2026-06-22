// Единый источник значений оси локали. Client-safe (без server-only / next).
export const LOCALES = ["system", "ru", "en"] as const;
export const RESOLVED_LOCALES = ["ru", "en"] as const;

/** Хранимое значение предпочтения (в cookie / preferences). */
export type Locale = (typeof LOCALES)[number];
/** Конкретная UI-локаль после резолва `system`. */
export type ResolvedLocale = (typeof RESOLVED_LOCALES)[number];

export const DEFAULT_LOCALE: ResolvedLocale = "ru";
export const LOCALE_COOKIE = "locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
export function isResolvedLocale(v: unknown): v is ResolvedLocale {
  return typeof v === "string" && (RESOLVED_LOCALES as readonly string[]).includes(v);
}

/** Языки с письмом справа налево (как данные — не обязаны быть в RESOLVED_LOCALES). */
export const RTL_LOCALES = ["ar", "fa", "he", "ur"] as const;

/** Направление письма для <html dir> и Base UI DirectionProvider. */
export type Direction = "ltr" | "rtl";

/** Направление по локали/BCP-47 тегу. Неизвестное → "ltr". */
export function dirForLocale(locale: string): Direction {
  const primary = locale.toLowerCase().split("-")[0];
  return (RTL_LOCALES as readonly string[]).includes(primary) ? "rtl" : "ltr";
}
