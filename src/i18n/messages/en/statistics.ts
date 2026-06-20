// src/i18n/messages/en/statistics.ts
// Mirror of ru/statistics.ts (English literals).
const statistics = {
  // --- entity type labels (view-stats, production-stats-table) ---
  entityType: {
    lecture: "Lectures",
    document: "Documents",
    trail: "Trails",
    canvas: "Canvases",
    form: "Forms",
    media: "Media",
    annotation: "Annotations",
    comment: "Comments",
  },

  // --- view-stats ---
  trackingDisabledTitle: "View tracking is disabled",
  trackingDisabledDescription:
    "Enable it in settings to see your view statistics.",
  goToSettings: "Go to settings",
  noViewsTitle: "You haven't viewed anything yet",
  noViewsDescription: "Statistics will appear after your first views.",
  totalViews: "Total views:",
  untitled: "Untitled",
  unavailable: "Unavailable",
  viewCount: "{count} views",

  // --- production-stats-table ---
  noProductionTitle: "You haven't created anything yet",
  noProductionDescription:
    "Statistics for your lectures, documents, and other materials will appear here.",
  colType: "Type",
  colTotal: "Total",
  colPublic: "Public",
  colPrivate: "Private",
  totalsRow: "Total",

  // --- history-tracking-toggle ---
  savedTitle: "Saved",
  trackingEnabledDescription: "View tracking enabled.",
  trackingDisabledAfterPurge: "Tracking disabled, history deleted.",
  trackingEnabledStatus: "View tracking is enabled.",
  trackingDisabledStatus: "View tracking is disabled.",
  disableButton: "Disable",
  enableButton: "Enable",
  disableDialogTitle: "Disable tracking?",
  disableDialogDescription: "All view history will be permanently deleted.",
  disableConfirmLabel: "Delete history",
  // Action phrase for "You don't have permission for {action}."
  manageSettingsAction: "changing settings",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadStatsFailed: "Failed to load statistics",
    loadViewStatsFailed: "Failed to load view statistics",
    loadHistorySettingsFailed: "Failed to load history settings",
  },
};

export default statistics;
