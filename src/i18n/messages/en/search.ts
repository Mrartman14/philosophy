// src/i18n/messages/en/search.ts
const search = {
  // --- Search form (search-input.tsx) ---
  filterAll: "Everywhere",
  filterLectures: "Lectures",
  filterTerms: "Terms",
  inputPlaceholder: "Search lectures and terms",
  inputAriaLabel: "Search query",
  filterAriaLabel: "Result type",
  submitButton: "Search",
  headerInputPlaceholder: "Search…",
  headerSubmitAriaLabel: "Search",
  headerOpenAriaLabel: "Open search",

  // --- Search results (search-results.tsx) ---
  typeLecture: "Lecture",
  typeGlossary: "Term",
  untitled: "Untitled",
  hitFallbackTitle: "Result",
  emptyTitle: "Nothing found",
  emptyDescription: "Try adjusting your query or removing the type filter.",
  foundCount: "Found: {count}",

  // --- Export (search-export-links.tsx) ---
  exportLabel: "Export:",

  // --- Loading skeleton (search-results-skeleton.tsx) ---
  loadingAriaLabel: "Loading results…",

  // --- API errors (api.ts) ---
  api: {
    fetchFailed: "Search is currently unavailable",
  },
};

export default search;
