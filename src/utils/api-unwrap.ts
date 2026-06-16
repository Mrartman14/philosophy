// src/utils/api-unwrap.ts

/**
 * Unwrap a list envelope from the openapi-fetch response object into
 * { items, total, offset, limit }. Generic over the element type T,
 * which is inferred from the caller's `data` without any explicit cast.
 *
 * The schema pattern is:
 *   components["schemas"]["httputil.ListResponse"] & { data?: T[] }
 * i.e. { data?: T[] | null; pagination?: { total?: number; offset?: number; limit?: number } | null }
 */
export function unwrapList<T>(
  resp: {
    data?: T[] | null;
    pagination?: { total?: number; offset?: number; limit?: number } | null;
  },
  fallback: { offset: number; limit: number },
): { items: T[]; total: number; offset: number; limit: number } {
  return {
    items: resp.data ?? [],
    total: resp.pagination?.total ?? 0,
    offset: resp.pagination?.offset ?? fallback.offset,
    limit: resp.pagination?.limit ?? fallback.limit,
  };
}

/**
 * Unwrap a single-object envelope to T | null. Generic over T, inferred
 * from the caller's `data` without any explicit cast.
 *
 * The schema pattern is:
 *   components["schemas"]["httputil.Response"] & { data?: T }
 * i.e. { data?: T | null }
 */
export function unwrap<T>(resp: { data?: T | null }): T | null {
  return resp.data ?? null;
}
