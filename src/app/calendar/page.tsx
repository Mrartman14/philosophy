// src/app/calendar/page.tsx
import {
  getCalendarOccurrences,
  resolveMonthRange,
  CalendarView,
} from "@/features/events";
import { getT, getLocale } from "@/i18n";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("calendarTitle") };
}

export default async function CalendarPage({ searchParams }: Props) {
  const { month } = await searchParams;
  const [locale, t] = await Promise.all([getLocale(), getT("pages")]);
  const range = resolveMonthRange(month, undefined, locale);
  const occurrences = await getCalendarOccurrences(range.from, range.to);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">{t("calendarHeading")}</h1>
      <CalendarView range={range} occurrences={occurrences} />
    </div>
  );
}
