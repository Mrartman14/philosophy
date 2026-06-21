// Client-safe модель оси таймзоны (без server-only / next). Зеркало locales.ts +
// appearance-cookie.ts. Cookie хранит JSON { pref, resolved }: pref — выбор
// пользователя (system|IANA, зеркалит бэк, рулит Select); resolved — конкретная
// IANA-зона для форматтера.

export const TZ_COOKIE = "tz";
/** Серверный фолбэк для `system`, пока клиент не определил браузерную зону. */
export const FALLBACK_ZONE = "Europe/Moscow";
export const DEFAULT_TZ_PREF: TzPref = "system";

/** Хранимое предпочтение: "system" либо валидная IANA-зона. */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- литерал "system" документирует особое значение оси (зеркалит бэк-контракт system|IANA), хотя по типу поглощается string
export type TzPref = "system" | string;

export interface TzCookie {
  pref: TzPref;
  /** Всегда валидная IANA-зона — то, что уходит в Intl.DateTimeFormat. */
  resolved: string;
}

/** Принимает ли среда зону (валидная IANA). Работает и на сервере, и в браузере. */
export function isValidZone(z: unknown): z is string {
  if (typeof z !== "string" || z.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

/** Сырое значение → TzPref: валидная зона остаётся, всё прочее → "system". */
export function normalizeTzPref(raw: unknown): TzPref {
  if (raw === "system") return "system";
  return isValidZone(raw) ? raw : "system";
}

export function serializeTzCookie(v: TzCookie): string {
  return JSON.stringify(v);
}

/** Сырое cookie → нормализованный TzCookie (никогда не бросает). */
export function parseTzCookie(raw: string | undefined): TzCookie {
  if (!raw) return { pref: "system", resolved: FALLBACK_ZONE };
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { pref: "system", resolved: FALLBACK_ZONE };
  }
  const pref = normalizeTzPref(o.pref);
  if (pref !== "system") {
    // Конкретная зона — resolved всегда совпадает с pref.
    return { pref, resolved: pref };
  }
  const resolved = isValidZone(o.resolved) ? o.resolved : FALLBACK_ZONE;
  return { pref: "system", resolved };
}
