"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncStatus = "loading" | "error" | "empty" | "ready";

export type AsyncFetcher<T> = (
  q: string,
  offset: number,
  limit: number,
) => Promise<{ data: T[]; total: number | null }>;

export interface UseAsyncComboboxItems<T> {
  items: T[];
  total: number | null;
  status: AsyncStatus;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  loadMore: () => void;
  canLoadMore: boolean;
  reload: () => void;
}

interface State<T> {
  items: T[];
  total: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Хук состояния асинхронного комбобокса (поиск + пагинация + дебаунс).
 *
 * ВАЖНО — операционный контракт `fetcher`: передавайте СТАБИЛЬНУЮ ссылку
 * (`useCallback` либо константа уровня модуля). Эффект загрузки завязан на
 * идентичность `fetcher` (он в зависимостях `load` → в зависимостях `useEffect`),
 * поэтому свежее замыкание на каждый рендер ре-триггерит загрузку каждый рендер →
 * бесконечный цикл фетча. Смена идентичности — это ОСОЗНАННЫЙ триггер рефетча
 * (например, для замыканий, зависящих от фильтров), а не побочный эффект.
 */
export function useAsyncComboboxItems<T>(
  /**
   * СТАБИЛЬНАЯ ссылка (`useCallback`/константа модуля). Новое замыкание на
   * каждый рендер → бесконечный цикл фетча. Смена идентичности = намеренный рефетч.
   */
  fetcher: AsyncFetcher<T>,
  pageSize = 20,
): UseAsyncComboboxItems<T> {
  const [query, setQueryState] = useState("");
  const [s, setS] = useState<State<T>>({ items: [], total: null, loading: false, error: null });
  const seqRef = useRef(0);

  const debouncedQ = useDebounced(query, 200);

  const load = useCallback(
    async (qNow: string, offset: number) => {
      const seq = ++seqRef.current;
      setS((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, total } = await fetcher(qNow, offset, pageSize);
        if (seq !== seqRef.current) return;
        setS((prev) => ({
          items: offset === 0 ? data : prev.items.concat(data),
          total,
          loading: false,
          error: null,
        }));
      } catch (e) {
        if (seq !== seqRef.current) return;
        setS((prev) => ({ ...prev, loading: false, error: e instanceof Error ? e.message : "error" }));
      }
    },
    [fetcher, pageSize],
  );

  useEffect(() => { void load(debouncedQ, 0); }, [debouncedQ, load]);

  const loadMore = useCallback(() => { void load(debouncedQ, s.items.length); }, [load, debouncedQ, s.items.length]);
  const reload = useCallback(() => { void load(debouncedQ, 0); }, [load, debouncedQ]);

  const status: AsyncStatus = s.loading
    ? "loading"
    : s.error
      ? "error"
      : s.items.length === 0
        ? "empty"
        : "ready";

  const canLoadMore = s.total !== null && s.items.length < s.total && !s.loading;

  return {
    items: s.items,
    total: s.total,
    status,
    error: s.error,
    query,
    setQuery: setQueryState,
    loadMore,
    canLoadMore,
    reload,
  };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => { setV(value); }, ms);
    return () => { clearTimeout(t); };
  }, [value, ms]);
  return v;
}
