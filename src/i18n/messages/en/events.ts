// src/i18n/messages/en/events.ts
// Mirror of ru/events.ts (English literals). Key parity enforced by satisfies Messages.
const events = {
  // --- calendar navigation ---
  prevMonth: "← Previous",
  nextMonth: "Next →",
  monthNavLabel: "Month navigation",
  noEvents: "No events this month.",
  recurringEvent: "Recurring event",

  // --- event-admin-row ---
  allDayBadge: " · all day",
  recurringBadge: " · recurring",
  editLink: "Edit",

  // --- event-edit-form / event-create-form labels ---
  fieldTitle: "Title",
  fieldAllDay: "All day",
  fieldStartDate: "Start date",
  fieldStartDateTime: "Start date and time (UTC)",
  fieldEndDate: "End date (optional)",
  fieldEndDateTime: "End date and time (UTC, optional)",
  fieldRrule: "Recurrence (RRULE, optional)",
  fieldBlocks: "Event description",
  titlePlaceholder: "E.g.: «Kant seminar»",
  clearLimitation:
    "Already saved End date and Recurrence cannot be cleared — the backend ignores empty values for these fields.",

  // --- event-edit-form status ---
  savedSuccess: "Saved.",
  // Case 3: per-feature action phrase for forbiddenAction.
  editAction: "editing the event",

  // --- submit buttons ---
  btnSave: "Save",
  btnCreate: "Create",

  // Case 3: per-feature action phrase for create form forbiddenAction
  createAction: "creating an event",

  // --- event-delete-button ---
  btnDelete: "Delete",
  deleteDialogTitle: "Delete event?",
  deleteDialogDescription:
    "This action is irreversible. The event will disappear from the public calendar.",
  deleteConfirmLabel: "Delete",
  deleteAction: "deleting the event",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load events",
    loadItemFailed: "Failed to load event",
    loadRevisionsFailed: "Failed to load revisions",
    loadRevisionFailed: "Failed to load revision",
    loadCalendarFailed: "Failed to load calendar",
  },
};

export default events;
