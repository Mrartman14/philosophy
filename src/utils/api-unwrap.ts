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

/**
 * Снять конверт {"data": ...} (httputil.WriteJSON) с СЫРОГО fetch-`Response` и
 * вернуть payload, типизированный `T`. Только для путей в обход openapi-fetch
 * клиента (multipart-загрузки, auth): там `res.json()` это `any`, поэтому
 * единственная защита от дрейфа со спекой — указать `T` компонентом из схемы
 * (через `@/api/types` / `components["schemas"][...]`), а НЕ рукописным литералом.
 * На типизированном клиенте используй `unwrap`/`unwrapList`.
 *
 * Возвращает `null` на не-JSON теле / пустом конверте — вызывающий решает,
 * как это показать (ошибка загрузки, повтор и т.п.).
 */
export async function parseEnvelope<T>(res: Response): Promise<T | null> {
  let body: { data?: T | null };
  try {
    body = (await res.json()) as { data?: T | null };
  } catch {
    return null;
  }
  return body.data ?? null;
}
