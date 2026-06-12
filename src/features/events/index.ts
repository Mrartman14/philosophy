// src/features/events/index.ts
export {
  getAdminEvents,
  getAdminEventById,
  getEventRevisions,
  getEventRevision,
  getCalendarOccurrences,
} from "./api";
export type { EventListFilter, EventListResult } from "./api";
export { createEvent, updateEvent, deleteEvent } from "./actions";
export {
  canReadEvents,
  canCreateEvent,
  canUpdateEvent,
  canDeleteEvent,
} from "./permissions";
export {
  resolveMonthRange,
  groupOccurrencesByDate,
  formatEventDate,
} from "./calendar";
export type { MonthRange, OccurrenceGroup } from "./calendar";
export { EventCreateForm } from "./ui/event-create-form";
export { EventEditForm } from "./ui/event-edit-form";
export { EventDeleteButton } from "./ui/event-delete-button";
export { EventAdminRow } from "./ui/event-admin-row";
export { EventExportLinks } from "./ui/event-export-links";
export { EventRevisions } from "./ui/event-revisions";
export { CalendarView } from "./ui/calendar-view";
export type {
  CalendarEvent,
  EventOccurrence,
  EventRevision,
  EventRevisionMeta,
} from "./types";
