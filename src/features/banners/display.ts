// src/features/banners/display.ts
// Чистые display-хелперы домена banners. Без "server-only": нужны тестам,
// server-safe UI и client-формам; никаких side effects и зависимостей.
import { getFmt } from "@/i18n/format";
import { DEFAULT_LOCALE, type ResolvedLocale } from "@/i18n/locales";

import type { Banner, BannerTargetAudience } from "./types";

// ИЗОМОРФНЫЙ КОНТРАКТ: display.ts чистый (server + client + display.test.ts), без
// хуков. Переводимые строки приходят через ключ-резолверы (callers переводят);
// дефолты — русские литералы из каталога banners.* (offline/test fallback).

/** Источник истины: значения enum аудитории + их catalog-ключи (banners.audience*). */
export const AUDIENCE_VALUES: readonly BannerTargetAudience[] = ["all", "authenticated", "admin"];

const AUDIENCE_KEYS = {
  all: "audienceAll",
  authenticated: "audienceAuthenticated",
  admin: "audienceAdmin",
} as const satisfies Record<BannerTargetAudience, string>;

/** Русские дефолты меток аудитории (offline/test fallback; зеркало banners.audience*). */
export const AUDIENCE_LABELS: Record<BannerTargetAudience, string> = {
  all: "Всем",
  authenticated: "Авторизованным",
  admin: "Администраторам",
};

/** Переводчик метки аудитории по catalog-ключу (для caller'ов с useT/getT). */
export type AudienceLabelT = (key: (typeof AUDIENCE_KEYS)[BannerTargetAudience]) => string;

/**
 * Метка аудитории. Без `t` — русский дефолт (offline/test). Caller-онлайн
 * (server/client с переводчиком banners) передаёт `t` → catalog-перевод.
 */
export function audienceLabel(audience?: BannerTargetAudience, t?: AudienceLabelT): string {
  if (!audience) return "";
  return t ? t(AUDIENCE_KEYS[audience]) : AUDIENCE_LABELS[audience];
}

/**
 * Опции для <Select> в формах. Без `t` — русские дефолты; caller с useT("banners")
 * передаёт `t` для перевода. (Заменяет прежнюю статическую AUDIENCE_OPTIONS.)
 */
export function audienceOptions(t?: AudienceLabelT): { value: BannerTargetAudience; label: string }[] {
  return AUDIENCE_VALUES.map((value) => ({ value, label: audienceLabel(value, t) }));
}

const BANNER_DATE_OPTS: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** RFC3339 → «1 июля 2026 г., 19:00» в зоне `tz` (как и формы). */
export function formatBannerDate(
  value?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
  tz = "UTC",
): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return getFmt(locale).dateTime(d, { ...BANNER_DATE_OPTS, timeZone: tz });
}

/**
 * Резолвер шаблона периода: `t("periodFrom"|"periodFromTo", {start, end})`.
 * Caller-онлайн (banner-admin-row — server с getT) передаёт переводчик banners;
 * без него — русский дефолт (offline/test).
 */
export type BannerPeriodT = (
  key: "periodFrom" | "periodFromTo",
  params: { start: string; end?: string },
) => string;

/** Период показа: «с X по Y» / «с X» / "". */
export function formatBannerPeriod(
  startAt?: string,
  endAt?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
  t?: BannerPeriodT,
  tz = "UTC",
): string {
  const start = formatBannerDate(startAt, locale, tz);
  if (!start) return "";
  const end = formatBannerDate(endAt, locale, tz);
  if (t) {
    return end ? t("periodFromTo", { start, end }) : t("periodFrom", { start });
  }
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
