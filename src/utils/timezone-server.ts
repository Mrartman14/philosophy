import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getPreferences } from "@/features/preferences";
import { getMe } from "@/utils/me";

import {
  TZ_COOKIE,
  FALLBACK_ZONE,
  DEFAULT_TZ_PREF,
  parseTzCookie,
  normalizeTzPref,
  isValidZone,
  type TzPref,
} from "./timezone";

/** Хранимое предпочтение (system|IANA): cookie-first, backend-seed для залогиненных. */
export const getStoredTzPref = cache(async (): Promise<TzPref> => {
  const store = await cookies();
  const raw = store.get(TZ_COOKIE)?.value;
  if (raw) return parseTzCookie(raw).pref;
  try {
    if (await getMe()) {
      const prefs = await getPreferences();
      return normalizeTzPref(prefs.timezone);
    }
  } catch {
    /* graceful: дефолт */
  }
  return DEFAULT_TZ_PREF;
});

/** Конкретная IANA-зона для форматтера. `system` → фолбэк, пока клиент не уточнил. */
export const getServerTz = cache(async (): Promise<string> => {
  const store = await cookies();
  const raw = store.get(TZ_COOKIE)?.value;
  if (raw) return parseTzCookie(raw).resolved;
  const pref = await getStoredTzPref();
  return pref !== "system" && isValidZone(pref) ? pref : FALLBACK_ZONE;
});
