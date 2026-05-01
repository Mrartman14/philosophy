"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface AsyncComboboxProps<T> {
  /**
   * Stable reference recommended (`useCallback`). Component refetches when
   * the fetcher identity changes — useful for filter-driven closures, but
   * a fresh closure on every render will trigger a fetch loop.
   */
  fetcher: (q: string, offset: number, limit: number) => Promise<{ data: T[]; total: number | null }>;
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  /** Called when the user presses Esc inside the combobox. */
  onClose?: () => void;
  placeholder?: string;
  pageSize?: number;
  copy?: { empty?: string; error?: string; loading?: string };
}

interface State<T> {
  items: T[];
  total: number | null;
  loading: boolean;
  error: string | null;
}

export function AsyncCombobox<T>(props: AsyncComboboxProps<T>) {
  const pageSize = props.pageSize ?? 20;
  const empty = props.copy?.empty ?? "Ничего не найдено";
  const errorCopy = props.copy?.error ?? "Ошибка загрузки";
  const loadingCopy = props.copy?.loading ?? "Загрузка…";

  const listboxId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [s, setS] = useState<State<T>>({ items: [], total: null, loading: false, error: null });
  const inputRef = useRef<HTMLInputElement>(null);

  // Sequence token: each load() bumps the counter; only the latest result
  // is allowed to commit. Drops stale responses when q-debounce, fetcher
  // identity or pagination overlap.
  const seqRef = useRef(0);

  const debouncedQ = useDebounced(q, 200);

  const fetcher = props.fetcher;
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
        setS((prev) => ({ ...prev, loading: false, error: e instanceof Error ? e.message : errorCopy }));
      }
    },
    [fetcher, pageSize, errorCopy],
  );

  useEffect(() => {
    setActive(0);
    void load(debouncedQ, 0);
  }, [debouncedQ, load]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, s.items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = s.items[active];
      if (item) props.onSelect(item);
    } else if (e.key === "Escape" && props.onClose) {
      e.preventDefault();
      props.onClose();
    }
  };

  const canLoadMore = s.total !== null && s.items.length < s.total && !s.loading;

  return (
    <div className="async-combobox">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded
        aria-controls={listboxId}
        type="text"
        value={q}
        placeholder={props.placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
      />
      <ul id={listboxId} role="listbox">
        {s.items.map((item, i) => (
          <li
            key={props.getKey(item)}
            role="option"
            aria-selected={active === i}
            onMouseDown={(e) => { e.preventDefault(); props.onSelect(item); }}
            onMouseEnter={() => setActive(i)}
          >
            {props.renderItem(item, active === i)}
          </li>
        ))}
        {!s.loading && s.items.length === 0 && !s.error && <li role="presentation">{empty}</li>}
        {s.loading && <li role="presentation">{loadingCopy}</li>}
        {s.error && (
          <li role="presentation">
            {errorCopy}
            <button type="button" onClick={() => void load(debouncedQ, 0)}>Повторить</button>
          </li>
        )}
        {canLoadMore && (
          <li role="presentation">
            <button type="button" onClick={() => void load(debouncedQ, s.items.length)}>
              Загрузить ещё
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
