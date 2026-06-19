// src/features/search/index.ts
// Public API слайса search. Снаружи слайс импортируется только отсюда
// (deep-imports запрещены ESLint'ом).

export {
  getSearchResults,
  type SearchFilter,
  type SearchResult,
} from "./api";
export {
  makeSearchQuerySchema,
  makeSearchParamsSchema,
  type SearchParamsInput,
  type SearchQueryInput,
} from "./schemas";
export { SEARCH_TYPES, type SearchType, type SearchHit } from "./types";
export { SearchInput } from "./ui/search-input";
export { SearchResults } from "./ui/search-results";
export { SearchExportLinks } from "./ui/search-export-links";
export { SearchResultsSkeleton } from "./ui/search-results-skeleton";
