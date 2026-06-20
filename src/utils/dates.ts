// src/utils/dates.ts
// Чистые date-хелперы, разделяемые слайсами. Без "server-only" и без i18n:
// только вычисления. Локале-зависимое форматирование — через @/i18n/format
// (fmt.dateTime / fmt.relativeTime); этот модуль лишь готовит данные для них.

/** Unix-СЕКУНДЫ → Date. null, если значения нет (бессрочно/отсутствует). */
export function unixSecToDate(sec?: number | null): Date | null {
  if (sec === undefined || sec === null) return null;
  return new Date(sec * 1000);
}

/**
 * true, если момент уже в прошлом относительно `nowMs` (по умолчанию — сейчас).
 * Невалидную дату трактует как «не в прошлом» (false), чтобы UI не падал.
 */
export function isPast(
  value: Date | number | string,
  nowMs: number = Date.now(),
): boolean {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) return false;
  return ms < nowMs;
}

/**
 * Разбивает интервал (`targetMs − nowMs`) на `{ value, unit }` для
 * `Intl.RelativeTimeFormat` / `fmt.relativeTime`. Знак: будущее > 0, прошлое < 0.
 * Единица — наибольшая подходящая: день (≥ 24 ч), иначе час (≥ 1 ч), иначе минута.
 */
export function relativeTimeParts(
  targetMs: number,
  nowMs: number,
): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const diff = targetMs - nowMs;
  const abs = Math.abs(diff);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (abs >= DAY) return { value: Math.round(diff / DAY), unit: "day" };
  if (abs >= HOUR) return { value: Math.round(diff / HOUR), unit: "hour" };
  return { value: Math.round(diff / MIN), unit: "minute" };
}
