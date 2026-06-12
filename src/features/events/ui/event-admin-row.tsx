// src/features/events/ui/event-admin-row.tsx
import Link from "next/link";
import { formatEventDate } from "../calendar";
import type { CalendarEvent } from "../types";
import { EventDeleteButton } from "./event-delete-button";
import { EventExportLinks } from "./event-export-links";

interface Props {
  event: CalendarEvent;
  canEdit: boolean;
  canDelete: boolean;
}

export function EventAdminRow({ event, canEdit, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{event.title}</span>
        <span className="text-xs text-(--color-description)">
          {formatEventDate(event.start_date, event.all_day)}
          {event.end_date
            ? ` — ${formatEventDate(event.end_date, event.all_day)}`
            : ""}
          {event.all_day ? " · весь день" : ""}
          {event.rrule ? " · повторяется" : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {event.id && <EventExportLinks id={event.id} />}
        {canEdit && event.id && (
          <Link
            href={`/admin/events/${event.id}/edit`}
            className="text-sm hover:underline"
          >
            Редактировать
          </Link>
        )}
        {canDelete && event.id && <EventDeleteButton id={event.id} />}
      </div>
    </li>
  );
}
