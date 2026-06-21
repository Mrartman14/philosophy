import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { createApiClient } from "@/api/client";
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

/**
 * Таймзона из бекенд-настроек. Запрос делается локально (а не через
 * `@/features/preferences`), чтобы НЕ создавать цикл импорта
 * `@/i18n` → timezone-server → preferences/api → `@/i18n`: правило
 * `import/no-cycle` в этом проекте следует и за динамическим `import()`
 * (флаг `allowUnsafeDynamicCyclicDependency` не включён), поэтому единственный
 * способ разорвать цикл — убрать статическое ребро на слайс целиком.
 * Семантика сохранена: только поле `timezone`, грейсфул на любой ошибке.
 * Канонический читатель преференсов — `getPreferences` (`@/features/preferences`);
 * здесь намеренный точечный дубль одного поля ради разрыва цикла.
 */
const getBackendTzPref = cache(async (): Promise<string | undefined> => {
  const api = await createApiClient();
  const { data } = await api.GET("/api/me/preferences");
  return data?.data?.timezone;
});

/** Хранимое предпочтение (system|IANA): cookie-first, backend-seed для залогиненных. */
export const getStoredTzPref = cache(async (): Promise<TzPref> => {
  const store = await cookies();
  const raw = store.get(TZ_COOKIE)?.value;
  if (raw) return parseTzCookie(raw).pref;
  try {
    if (await getMe()) {
      return normalizeTzPref(await getBackendTzPref());
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
