// Единый источник значений оси локали. Client-safe (без server-only / next).
// "en-XA" — псевдолокаль для визуального QA лейаута (генерится из en, см.
// ./pseudo + messages/pseudo). Реальная UI-локаль ей не является: авто-детект по
// Accept-Language её не выбирает (primary-subtag "en"), пикер показывает только в dev.
export const LOCALES = ["system", "ru", "en", "ar", "zh", "en-XA"] as const;
export const RESOLVED_LOCALES = ["ru", "en", "ar", "zh", "en-XA"] as const;

/** Хранимое значение предпочтения (в cookie / preferences). */
export type Locale = (typeof LOCALES)[number];
/** Конкретная UI-локаль после резолва `system`. */
export type ResolvedLocale = (typeof RESOLVED_LOCALES)[number];

export const DEFAULT_LOCALE: ResolvedLocale = "ru";
export const LOCALE_COOKIE = "locale";

/** Псевдолокаль (визуальный QA лейаута). Не персистится на бэк, dev-only в пикере. */
export const PSEUDO_LOCALE = "en-XA" as const;

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
  // split всегда возвращает ≥1 элемент; `?? ""` — лишь для noUncheckedIndexedAccess.
  const primary = locale.toLowerCase().split("-")[0] ?? "";
  return (RTL_LOCALES as readonly string[]).includes(primary) ? "rtl" : "ltr";
}
