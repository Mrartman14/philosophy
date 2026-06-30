// src/i18n/messages/en/lectures.ts
// Mirror of ru/lectures.ts. Key parity enforced by satisfies Messages.
const lectures = {
  // --- UI-labels ---
  titleLabel: "Title",
  dateLabel: "Date",
  dateDescription: "Format YYYY-MM-DD",
  descriptionLabel: "Description",
  visibilityLabel: "Visibility",
  visibilityPrivate: "Private",
  visibilityPublic: "Public",
  allTags: "All tags",

  // --- buttons / actions ---
  saveButton: "Save",
  createButton: "Create",
  deleteButton: "Delete",
  editLink: "Edit",
  searchButton: "Find",
  searchPending: "…",
  replaceCover: "Replace cover",
  uploadCover: "Upload cover",
  deleteCover: "Delete cover",

  // --- cover form ---
  coverSectionLabel: "Lecture cover",
  coverHeading: "Cover",
  coverAlt: "Lecture cover",
  coverEmpty: "No cover set.",
  coverAltLabel: "Alt text (for accessibility)",

  // --- delete dialog ---
  deleteDialogTitle: "Delete lecture?",
  deleteDialogDescription: "This action is irreversible.",

  // --- search form ---
  searchPlaceholder: "Search by title or description",
  searchAriaLabel: "Search lectures",
  tagFilterAriaLabel: "Filter by tag",

  // --- list empty state ---
  emptyTitle: "No lectures found",
  emptyDescription: "Try changing the filters or search query.",

  // --- edit form status ---
  savedMessage: "Saved.",

  // --- document tabs (lecture card) ---
  documentTabsAriaLabel: "Lecture documents",
  docTabLoading: "Loading document…",
  docTabError: "Failed to load the document.",
  docTabEmpty: "Empty document.",

  // --- attachments manager ---
  detachForbidden: "You don't have permission to detach.",
  reorderForbidden: "You don't have permission to reorder.",
  attachForbidden: "You don't have permission to attach.",
  searchDocumentPlaceholder: "Search document…",
  searchMediaPlaceholder: "Search media…",
  searchFormPlaceholder: "Search form…",
  attachmentsEmpty: "Nothing attached yet.",

  // --- attach docs on create (Variant A) ---
  attachDocsLabel: "Attach documents",
  attachDocsHint: "Optional. Pick existing documents — they’ll be attached to the lecture once it’s created.",
  attachDocsRemove: "Remove {label}",

  // --- forbidden actions (Case 3 — action phrase) ---
  coverForbiddenAction: "changing the cover",
  visibilityForbiddenAction: "changing visibility",
  editForbiddenAction: "editing",
  createAction: "creating a lecture",
  deleteAction: "deleting the lecture",

  // --- server throws (api.ts fallback messages) ---
  api: {
    loadListFailed: "Failed to load lectures",
    loadItemFailed: "Failed to load lecture",
    loadDocumentsFailed: "Failed to load lecture documents",
    loadMediaFailed: "Failed to load lecture media",
    loadCanvasesFailed: "Failed to load lecture canvases",
    loadFormsFailed: "Failed to load lecture forms",
  },
};

export default lectures;
