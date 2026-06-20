// src/i18n/messages/en/glossary.ts
// Mirror of ru/glossary.ts (English literals). Key parity enforced by satisfies Messages.
const glossary = {
  // --- glossary-admin-row ---
  editButton: "Edit",

  // --- glossary-create-form ---
  titleLabel: "Name",
  titlePlaceholder: "For example: «Epistemology»",
  createButton: "Create",
  createTermAction: "creating a term",

  // --- glossary-delete-button ---
  deleteButton: "Delete",
  deleteConfirmTitle: "Delete term?",
  deleteConfirmDescription:
    "This action is irreversible. If other content references blocks of this term, deletion will be rejected.",
  deleteConfirmLabel: "Delete",
  deleteTermAction: "deleting a term",

  // --- glossary-detail ---
  updatedAt: "Updated: {date}",

  // --- glossary-edit-form ---
  blocksLabel: "Term body",
  savedMessage: "Saved.",
  saveButton: "Save",
  updateTermAction: "editing the term",

  // --- glossary-export-links ---
  exportLabel: "Export:",

  // --- glossary-list ---
  emptyState: "No terms found.",
  totalCount: "Total: {count}",

  // --- glossary-revisions ---
  revisionsTitle: "Term revision history",

  // --- glossary-search-form ---
  searchPlaceholder: "Search by name",
  searchButton: "Find",
  searchPending: "…",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load terms",
    loadItemFailed: "Failed to load term",
    loadRevisionsFailed: "Failed to load term revisions",
    loadRevisionFailed: "Failed to load term revision",
  },
};

export default glossary;
