// src/features/events/ui/calendar-view.tsx
import { AstRender } from "@/components/ast-render";
import { RouterLink } from "@/components/ui";
import { getT, getServerFmt } from "@/i18n";

import { groupOccurrencesByDate, type MonthRange } from "../calendar";
import type { EventOccurrence } from "../types";

interface Props {
  range: MonthRange;
  occurrences: EventOccurrence[];
}

export async function CalendarView({ range, occurrences }: Props) {
  const t = await getT("events");
  const fmt = await getServerFmt();
  const groups = groupOccurrencesByDate(occurrences);

  const formatDay = (date: string): string => {
    const d = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return date;
    return fmt.dateTime(d, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <nav
        aria-label={t("monthNavLabel")}
        className="flex items-center justify-between"
      >
        <RouterLink
          href={`/calendar?month=${range.prevMonth}`}
          className="text-sm hover:underline"
        >
          {t("prevMonth")}
        </RouterLink>
        <h2 className="text-xl font-semibold capitalize">{range.label}</h2>
        <RouterLink
          href={`/calendar?month=${range.nextMonth}`}
          className="text-sm hover:underline"
        >
          {t("nextMonth")}
        </RouterLink>
      </nav>

      {groups.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">
          {t("noEvents")}
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {groups.map((group) => (
            <li key={group.date} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold capitalize text-(--color-fg-muted)">
                {formatDay(group.date)}
              </h3>
              <ul className="flex flex-col gap-3">
                {group.items.map((occ, i) => (
                  <li
                    key={`${occ.event_id ?? "occ"}-${i}`}
                    className="rounded border border-(--color-border) p-3"
                  >
                    <p className="font-medium">{occ.title}</p>
                    {occ.is_recurring && (
                      <p className="text-xs text-(--color-fg-muted)">
                        {t("recurringEvent")}
                      </p>
                    )}
                    {(occ.blocks?.length ?? 0) > 0 && (
                      <div className="content mt-2">
                        <AstRender blocks={occ.blocks ?? []} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
