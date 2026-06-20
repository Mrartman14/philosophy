// src/features/banners/display.ts
// Чистые display-хелперы домена banners. Без "server-only": нужны тестам,
// server-safe UI и client-формам; никаких side effects и зависимостей.
import { getFmt } from "@/i18n/format";
import { DEFAULT_LOCALE, type ResolvedLocale } from "@/i18n/locales";

import type { Banner, BannerTargetAudience } from "./types";

export const AUDIENCE_LABELS: Record<BannerTargetAudience, string> = {
  all: "Всем",
  authenticated: "Авторизованным",
  admin: "Администраторам",
};

/** Опции для <Select> в формах — производная от AUDIENCE_LABELS (DRY). */
export const AUDIENCE_OPTIONS = (
  Object.entries(AUDIENCE_LABELS) as [BannerTargetAudience, string][]
).map(([value, label]) => ({ value, label }));

export function audienceLabel(audience?: BannerTargetAudience): string {
  if (!audience) return "";
  return AUDIENCE_LABELS[audience];
}

const BANNER_DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
};

/** RFC3339 → «1 июля 2026 г., 19:00» (UTC — как и формы). */
export function formatBannerDate(
  value?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return getFmt(locale).dateTime(d, BANNER_DATE_OPTS);
}

/** Период показа: «с X по Y» / «с X» / "". */
export function formatBannerPeriod(
  startAt?: string,
  endAt?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
): string {
  const start = formatBannerDate(startAt, locale);
  if (!start) return "";
  const end = formatBannerDate(endAt, locale);
  return end ? `с ${start} по ${end}` : `с ${start}`;
}

/**
 * Нормализует hex-цвет для <input type="color"> (он понимает только #rrggbb):
 * #abc → #aabbcc, верхний регистр → нижний, не-hex → fallback.
 */
export function toColorInputValue(value?: string, fallback = "#336699"): string {
  if (!value) return fallback;
  const short = /^#([0-9a-fA-F]{3})$/.exec(value);
  if (short?.[1]) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  return fallback;
}

/**
 * Текст-превью баннера для admin-списка (title у баннера нет). Источник —
 * денормализованный block.text (тот же, что у blocksPreview бекенда).
 */
export function bannerPreviewText(
  blocks?: Banner["blocks"],
  maxLen = 120,
): string {
  const text = (blocks ?? [])
    .map((b) => b.text ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
