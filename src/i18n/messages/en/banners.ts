// src/i18n/messages/en/banners.ts
// Mirror of ru/banners.ts. Key parity enforced by satisfies Messages.
const banners = {
  // --- Form field labels (create + edit) ---
  fieldColor: "Background color",
  fieldAudience: "Audience",
  fieldAudienceAriaLabel: "Audience",
  fieldDismissible: "User can dismiss the banner",
  fieldStartAt: "Show start (your timezone)",
  fieldEndAt: "Show end (your timezone, optional)",
  fieldEventId: "Event ID (optional)",
  fieldBlocks: "Banner text",
  eventIdPlaceholder: "Event ID (see Admin → Events)",

  // --- Hints ---
  hintEndAt:
    "A saved “Show until” can’t be cleared — keep the current value or set a new one.",
  hintEventId: "To unlink the event — clear the field and save.",

  // --- Buttons / submit ---
  createButton: "Create",
  saveButton: "Save",
  deleteButton: "Delete",
  editButton: "Edit",

  // --- Status ---
  saved: "Saved.",

  // --- Forbidden inline (Case 3: banner-edit-form only) ---
  editAction: "editing the banner",

  // --- Delete confirmation ---
  deleteTitle: "Delete banner?",
  deleteDescription: "This action is irreversible. The banner will disappear from all pages.",

  // --- Toast actions (for toastActionError) ---
  deleteAction: "deleting the banner",
  dismissAction: "dismissing the banner",
  dismissFailTitle: "Failed to dismiss the banner",

  // --- Dismiss button ---
  dismissAriaLabel: "Dismiss banner",

  // --- admin-row ---
  noText: "Banner without text",
  notDismissible: " · not dismissible",
  hasEvent: " · linked to event",

  // --- active-banners aria ---
  sectionLabel: "Announcements",

  // --- Audience labels ---
  audienceAll: "Everyone",
  audienceAuthenticated: "Authenticated users",
  audienceAdmin: "Administrators",

  // --- Display period (formatBannerPeriod) ---
  periodFrom: "from {start}",
  periodFromTo: "from {start} to {end}",

  // --- create-form: forbiddenAction (Case 3) ---
  createAction: "creating the banner",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load banners",
    loadItemFailed: "Failed to load banner",
    loadRevisionsFailed: "Failed to load revisions",
    loadRevisionFailed: "Failed to load revision",
  },
};

export default banners;
