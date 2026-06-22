// src/features/events/calendar.ts
// Чистые date-хелперы домена events. Без "server-only": нужны тестам и
// server-safe UI-компонентам; никаких side effects и зависимостей.
import { getFmt, type Formatters } from "@/i18n/format";
import { DEFAULT_LOCALE, type ResolvedLocale } from "@/i18n/locales";

import type { EventOccurrence } from "./types";

export interface MonthRange {
  /** Нормализованный месяц "YYYY-MM". */
  month: string;
  /** Первый день месяца, YYYY-MM-DD — параметр from для GET /api/calendar. */
  from: string;
  /** Последний день месяца, YYYY-MM-DD — параметр to. */
  to: string;
  /** "YYYY-MM" предыдущего месяца. */
  prevMonth: string;
  /** "YYYY-MM" следующего месяца. */
  nextMonth: string;
  /** Человекочитаемая метка, например «июль 2026 г.». */
  label: string;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Разрешает параметр ?month=YYYY-MM в диапазон [from, to] для GET
 * /api/calendar. Невалидный/отсутствующий параметр → текущий месяц (UTC).
 * Диапазон месяца ≤ 31 дня — лимит бекенда (366 дней) недостижим.
 */
export function resolveMonthRange(
  monthParam?: string,
  now: Date = new Date(),
  locale: ResolvedLocale = "ru",
): MonthRange {
  let year: number;
  let month: number; // 1–12
  if (monthParam && MONTH_RE.test(monthParam)) {
    year = Number(monthParam.slice(0, 4));
    month = Number(monthParam.slice(5, 7));
  } else {
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }
  // День 0 следующего месяца = последний день текущего.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const fmt = getFmt(locale);
  const label = fmt.dateTime(new Date(Date.UTC(year, month - 1, 1)), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    month: `${year}-${pad2(month)}`,
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    prevMonth: `${prev.y}-${pad2(prev.m)}`,
    nextMonth: `${next.y}-${pad2(next.m)}`,
    label,
  };
}

export interface OccurrenceGroup {
  /** YYYY-MM-DD */
  date: string;
  items: EventOccurrence[];
}

/**
 * GET /api/calendar отдаёт ПЛОСКИЙ список occurrences — группируем по дате
 * на фронте. Даты по возрастанию, внутри даты — по title (locale).
 */
export function groupOccurrencesByDate(
  occurrences: EventOccurrence[],
  locale: ResolvedLocale = DEFAULT_LOCALE,
): OccurrenceGroup[] {
  const byDate = new Map<string, EventOccurrence[]>();
  for (const occ of occurrences) {
    if (!occ.date) continue;
    const list = byDate.get(occ.date) ?? [];
    list.push(occ);
    byDate.set(occ.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) =>
        (a.title ?? "").localeCompare(b.title ?? "", locale),
      ),
    }));
}

/**
 * Форматирует дату события для списков. all_day (YYYY-MM-DD) → «1 июля
 * 2026 г.»; timed (RFC3339) → плюс время в UTC (формы тоже подписаны UTC).
 */
export function formatEventDate(
  value?: string,
  allDay?: boolean,
  locale: ResolvedLocale = "ru",
  tz = "UTC",
): string {
  if (!value) return "";
  const date = new Date(allDay ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  const fmt = getFmt(locale);
  const opts: Intl.DateTimeFormatOptions = allDay
    ? // all_day — date-only: локализация под зону сдвинула бы день, держим UTC.
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      };
  return fmt.dateTime(date, opts);
}

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

/**
 * Время occurrence в зоне ЗРИТЕЛЯ: «19:00» или «19:00 – 21:00».
 * `start_at`/`end_at` — абсолютные инстанты (RFC3339 с офсетом), бек локализует
 * их под каждого зрителя. `fmt` уже привязан к зоне юзера (getServerFmt), поэтому
 * timeZone в опции НЕ передаём. all_day / нет start_at → пустая строка.
 */
export function formatOccurrenceTime(
  occ: Pick<EventOccurrence, "all_day" | "start_at" | "end_at">,
  fmt: Formatters,
): string {
  if (occ.all_day || !occ.start_at) return "";
  const start = new Date(occ.start_at);
  if (Number.isNaN(start.getTime())) return "";
  const startText = fmt.dateTime(start, TIME_OPTS);
  if (occ.end_at) {
    const end = new Date(occ.end_at);
    if (!Number.isNaN(end.getTime())) {
      return `${startText} – ${fmt.dateTime(end, TIME_OPTS)}`;
    }
  }
  return startText;
}
