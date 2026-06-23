// Локале-зависимое форматирование поверх нативного Intl.*. Client-safe.
// НЕ зависит от next-intl: остаётся стабильным при замене i18n-библиотеки.
import { DEFAULT_LOCALE, type ResolvedLocale } from "./locales";

const BCP47: Record<ResolvedLocale, string> = {
  ru: "ru-RU",
  en: "en-US",
  ar: "ar",
  zh: "zh-CN",
  // Псевдолокаль форматирует даты/числа как английский (визуальный тест — про
  // строки UI, не про формат-локаль).
  "en-XA": "en-US",
};

export interface Formatters {
  dateTime(value: string | number | Date, opts?: Intl.DateTimeFormatOptions): string;
  number(value: number, opts?: Intl.NumberFormatOptions): string;
  relativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    opts?: Intl.RelativeTimeFormatOptions,
  ): string;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
const nfCache = new Map<string, Intl.NumberFormat>();
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function keyed<T>(cache: Map<string, T>, tag: string, opts: unknown, make: () => T): T {
  const k = `${tag}|${JSON.stringify(opts ?? {})}`;
  let v = cache.get(k);
  if (!v) {
    v = make();
    cache.set(k, v);
  }
  return v;
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getFmt(
  locale: ResolvedLocale = DEFAULT_LOCALE,
  timeZone?: string,
): Formatters {
  const tag = BCP47[locale];
  return {
    dateTime(value, opts) {
      const d = toDate(value);
      if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
      // timeZone-дефолт подмешивается, но opts.timeZone (если задан) приоритетен.
      const merged = timeZone ? { timeZone, ...opts } : opts;
      return keyed(dtfCache, tag, merged, () => new Intl.DateTimeFormat(tag, merged)).format(d);
    },
    number(value, opts) {
      return keyed(nfCache, tag, opts, () => new Intl.NumberFormat(tag, opts)).format(value);
    },
    relativeTime(value, unit, opts) {
      return keyed(rtfCache, tag, opts, () => new Intl.RelativeTimeFormat(tag, opts)).format(
        value,
        unit,
      );
    },
  };
}
