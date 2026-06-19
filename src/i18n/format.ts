// Локале-зависимое форматирование поверх нативного Intl.*. Client-safe.
// НЕ зависит от next-intl: остаётся стабильным при замене i18n-библиотеки.
import { DEFAULT_LOCALE, type ResolvedLocale } from "./locales";

const BCP47: Record<ResolvedLocale, string> = { ru: "ru-RU", en: "en-US" };

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

export function getFmt(locale: ResolvedLocale = DEFAULT_LOCALE): Formatters {
  const tag = BCP47[locale];
  return {
    dateTime(value, opts) {
      const d = toDate(value);
      if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
      return keyed(dtfCache, tag, opts, () => new Intl.DateTimeFormat(tag, opts)).format(d);
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
