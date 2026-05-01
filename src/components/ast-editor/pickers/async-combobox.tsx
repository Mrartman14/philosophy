"use client";
import { useEffect, useRef, useState } from "react";

export interface AsyncComboboxProps<T> {
  fetcher: (q: string, offset: number, limit: number) => Promise<{ data: T[]; total: number | null }>;
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
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

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [s, setS] = useState<State<T>>({ items: [], total: null, loading: false, error: null });
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQ = useDebounced(q, 200);

  const load = async (qNow: string, offset: number) => {
    setS((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, total } = await props.fetcher(qNow, offset, pageSize);
      setS((prev) => ({
        items: offset === 0 ? data : prev.items.concat(data),
        total,
        loading: false,
        error: null,
      }));
    } catch (e) {
      setS((prev) => ({ ...prev, loading: false, error: e instanceof Error ? e.message : errorCopy }));
    }
  };

  useEffect(() => {
    setActive(0);
    void load(debouncedQ, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, s.items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = s.items[active];
      if (item) props.onSelect(item);
    }
  };

  const canLoadMore = s.total !== null && s.items.length < s.total && !s.loading;

  return (
    <div className="async-combobox">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded
        aria-controls="async-combobox-list"
        type="text"
        value={q}
        placeholder={props.placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
      />
      <ul id="async-combobox-list" role="listbox">
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
