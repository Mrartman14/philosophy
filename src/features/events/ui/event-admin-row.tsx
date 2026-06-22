// src/features/events/ui/event-admin-row.tsx
import { RouterLink } from "@/components/ui";
import { getT, getLocale } from "@/i18n";
import { getServerTz } from "@/utils/timezone-server";

import { formatEventDate } from "../calendar";
import type { CalendarEvent } from "../types";

import { EventDeleteButton } from "./event-delete-button";
import { EventExportLinks } from "./event-export-links";

interface Props {
  event: CalendarEvent;
  canEdit: boolean;
  canDelete: boolean;
}

export async function EventAdminRow({ event, canEdit, canDelete }: Props) {
  const [t, locale, tz] = await Promise.all([
    getT("events"),
    getLocale(),
    getServerTz(),
  ]);

  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{event.title}</span>
        <span className="text-xs text-(--color-fg-muted)">
          {formatEventDate(event.start_date, event.all_day, locale, tz)}
          {event.end_date
            ? ` — ${formatEventDate(event.end_date, event.all_day, locale, tz)}`
            : ""}
          {event.all_day ? t("allDayBadge") : ""}
          {event.rrule ? t("recurringBadge") : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {event.id && <EventExportLinks id={event.id} />}
        {canEdit && event.id && (
          <RouterLink
            href={`/admin/events/${event.id}/edit`}
            className="text-sm hover:underline"
          >
            {t("editLink")}
          </RouterLink>
        )}
        {canDelete && event.id && <EventDeleteButton id={event.id} />}
      </div>
    </li>
  );
}
