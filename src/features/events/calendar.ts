// src/features/events/calendar.ts
// Чистые date-хелперы домена events. Без "server-only": нужны тестам и
// server-safe UI-компонентам; никаких side effects и зависимостей.
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
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

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
 * на фронте. Даты по возрастанию, внутри даты — по title (ru).
 */
export function groupOccurrencesByDate(
  occurrences: EventOccurrence[],
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
        (a.title ?? "").localeCompare(b.title ?? "", "ru"),
      ),
    }));
}

/**
 * Форматирует дату события для списков. all_day (YYYY-MM-DD) → «1 июля
 * 2026 г.»; timed (RFC3339) → плюс время в UTC (формы тоже подписаны UTC).
 */
export function formatEventDate(value?: string, allDay?: boolean): string {
  if (!value) return "";
  const date = new Date(allDay ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      };
  return new Intl.DateTimeFormat("ru-RU", opts).format(date);
}
