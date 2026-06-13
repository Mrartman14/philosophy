// src/app/calendar/page.tsx
import {
  getCalendarOccurrences,
  resolveMonthRange,
  CalendarView,
} from "@/features/events";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const { month } = await searchParams;
  const range = resolveMonthRange(month);
  const occurrences = await getCalendarOccurrences(range.from, range.to);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Календарь</h1>
      <CalendarView range={range} occurrences={occurrences} />
    </div>
  );
}

export const metadata = { title: "Календарь" };
