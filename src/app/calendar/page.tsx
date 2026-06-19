// src/app/calendar/page.tsx
import {
  getCalendarOccurrences,
  resolveMonthRange,
  CalendarView,
} from "@/features/events";
import { getT } from "@/i18n";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("calendarTitle") };
}

export default async function CalendarPage({ searchParams }: Props) {
  const { month } = await searchParams;
  const range = resolveMonthRange(month);
  const occurrences = await getCalendarOccurrences(range.from, range.to);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">{t("calendarHeading")}</h1>
      <CalendarView range={range} occurrences={occurrences} />
    </div>
  );
}
