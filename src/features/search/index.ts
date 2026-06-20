// src/features/search/index.ts
// Public API слайса search. Снаружи слайс импортируется только отсюда
// (deep-imports запрещены ESLint'ом).

export {
  SEARCH_RESULT_LIMIT,
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
export { type SearchType, type SearchHit } from "./types";
export { SearchInput } from "./ui/search-input";
export { SearchResults } from "./ui/search-results";
export { SearchResultsSkeleton } from "./ui/search-results-skeleton";
