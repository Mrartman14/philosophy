// src/i18n/messages/en/search.ts
const search = {
  // --- Search form (search-input.tsx) ---
  inputPlaceholder: "Search documents and terms",
  inputAriaLabel: "Search query",
  submitButton: "Search",
  headerInputPlaceholder: "Search…",
  headerSubmitAriaLabel: "Search",
  headerOpenAriaLabel: "Open search",

  // --- Search results (search-results.tsx) ---
  typeDocument: "Document",
  typeGlossary: "Term",
  untitled: "Untitled",
  emptyTitle: "Nothing found",
  emptyDescription: "Try rephrasing your query.",
  foundCount: "Found: {count}",

  // --- Loading skeleton (search-results-skeleton.tsx) ---
  loadingAriaLabel: "Loading results…",

  // --- API errors (api.ts) ---
  api: {
    fetchFailed: "Search failed",
  },
};

export default search;
