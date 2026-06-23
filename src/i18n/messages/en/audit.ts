// src/i18n/messages/en/audit.ts
// English translations for the audit (admin log) slice.
const audit = {
  // --- audit-filter-form: field labels and buttons ---
  filterAllTypes: "All types",
  filterActorLabel: "Actor ID (UUID)",
  filterTargetTypeLabel: "Target type",
  filterTargetIdLabel: "Target ID",
  filterTargetIdPlaceholder: "Entity ID",
  filterActionLabel: "Action",
  filterAllActions: "All actions",
  filterFromLabel: "From",
  filterToLabel: "To",
  filterSubmit: "Filter",
  filterReset: "Reset",

  // --- admin audit page ---
  pageTitle: "Audit",
  pageDescription: "Admin action log. Total records: {total}",

  // --- audit-table: column headers and empty state ---
  colTime: "Time",
  colActor: "Actor",
  colAction: "Action",
  colTarget: "Target",
  colDetails: "Details",
  detailsToggle: "Show",
  emptyTitle: "No records found",
  emptyDescription: "Try relaxing the filters or expanding the date range.",

  // --- api.ts: fetch error fallbacks (thrown to React error boundary) ---
  api: {
    loadLogFailed: "Failed to load audit log",
  },
};

export default audit;
