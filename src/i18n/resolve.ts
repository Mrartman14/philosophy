// Чистые функции резолва локали. Client-safe, без next/server зависимостей.
import {
  DEFAULT_LOCALE,
  isLocale,
  isResolvedLocale,
  type Locale,
  type ResolvedLocale,
} from "./locales";

/** Сырое значение cookie → Locale (невалидное → "system"). */
export function parseStoredLocale(raw: string | undefined): Locale {
  return isLocale(raw) ? raw : "system";
}

/** Первый поддерживаемый язык из Accept-Language; иначе DEFAULT_LOCALE. */
export function detectFromAcceptLanguage(
  header: string | null | undefined,
): ResolvedLocale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split("-")[0];
    if (isResolvedLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** Хранимое предпочтение (+подсказки запроса) → конкретная UI-локаль. */
export function resolveLocale(
  stored: Locale,
  acceptLanguage?: string | null,
): ResolvedLocale {
  return stored === "system" ? detectFromAcceptLanguage(acceptLanguage) : stored;
}
