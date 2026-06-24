// src/i18n/messages/en/annotations.ts
// Mirror of ru/annotations.ts. Key parity enforced by satisfies Messages in en/index.ts.
const annotations = {
  // --- annotation-card ---
  visibility: {
    private: "private",
    public: "public",
    unknown: "private",
  },
  edited: " · edited",

  // --- annotation-list ---
  empty: "No annotations yet.",

  // --- annotation-create-form ---
  createBodyLabel: "Annotation text",
  createBodyAriaLabel: "Annotation text",
  createSubmit: "Add annotation",
  createForbiddenAction: "creating an annotation",

  // --- annotation-edit-form ---
  editBodyLabel: "Annotation text",
  editBodyAriaLabel: "Annotation text",
  editSuccess: "Saved.",
  editForbiddenAction: "editing an annotation",
  editSubmit: "Save",

  // --- annotation-edit-button ---
  editButton: "Edit",
  editDialogTitle: "Edit annotation",
  editorLoading: "Loading editor…",

  // --- annotation-delete-button ---
  deleteButton: "Delete",
  deleteDialogTitle: "Delete annotation?",
  deleteDialogDescription: "This action is irreversible.",
  deleteDialogConfirm: "Delete",
  deleteAction: "deleting an annotation",

  // --- annotation-visibility-field ---
  visibilityLegend: "Visibility",
  visibilityPrivateLabel: "Private (visible only to me)",
  visibilityPublicLabel: "Public (visible to everyone who can see this entity)",
  visibilityImmutableNote: "Visibility cannot be changed after creation.",

  // --- annotation-admin-filter-form ---
  filterEntityTypeLabel: "Entity type:",
  filterEntityTypeAll: "All",

  // --- annotations-section ---
  sectionLabel: "Annotations",
  sectionHeading: "Annotations",

  // --- annotation-admin-row ---
  adminAuthorLabel: "author",

  // --- actions.ts: internal error when annotation not found ---
  notFound: "Annotation not found.",

  // --- marginalia engine (composer / connector) ---
  marginAddButton: "Annotate",
  marginAddUnanchored: "Add annotation",
  marginComposerTitle: "New annotation",
  marginOrphanLabel: "Fragment not found",
  marginHighlightToggleOn: "Hide highlights",
  marginHighlightToggleOff: "Show highlights",
  marginColumnLabel: "Margin annotations",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadListFailed: "Failed to load annotations",
    loadListFailedStatus: "Failed to load annotations ({status})",
    loadItemFailed: "Failed to load annotation",
    loadMyFailed: "Failed to load my annotations",
    loadLectureFailed: "Failed to load lecture annotations",
    loadAdminFailed: "Failed to load annotation list",
    loadRevisionsFailed: "Failed to load revisions",
    loadRevisionFailed: "Failed to load revision",
  },
};

export default annotations;
