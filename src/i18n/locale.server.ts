// src/i18n/locale.server.ts
import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { LOCALE_COOKIE, type Locale, type ResolvedLocale } from "./locales";
import { parseStoredLocale, resolveLocale } from "./resolve";

/** Сырое хранимое предпочтение (system|ru|en) из cookie. Дедуп per-request. */
export const getStoredLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  return parseStoredLocale(store.get(LOCALE_COOKIE)?.value);
});

/** Конкретная UI-локаль (ru|en): cookie, с резолвом `system` через Accept-Language. */
export const getLocale = cache(async (): Promise<ResolvedLocale> => {
  const stored = await getStoredLocale();
  if (stored !== "system") return stored;
  const h = await headers();
  return resolveLocale(stored, h.get("accept-language"));
});
