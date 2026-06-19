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
  filterActionPlaceholder: "e.g. lecture.create",
  filterFromLabel: "From",
  filterToLabel: "To",
  filterSubmit: "Filter",
  filterReset: "Reset",

  // --- admin audit page ---
  pageTitle: "Audit",
  pageDescription: "Admin action log. Total records: {total}",
  metaTitle: "Audit — admin",

  // --- audit-table: column headers and empty state ---
  colTime: "Time",
  colActor: "Actor",
  colAction: "Action",
  colTarget: "Target",
  colDetails: "Details",
  detailsToggle: "Show",
  emptyTitle: "No records found",
  emptyDescription: "Try relaxing the filters or expanding the date range.",
};

export default audit;
