"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type SVGProps,
} from "react";

const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M21 21L15.5 15.5M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchInputInner: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setOpen(false);
  }, [router, value]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setValue(initialQuery);
    }
  };

  return (
    <div className="flex items-center">
      {open ? (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!value.trim()) setOpen(false);
            }}
            placeholder="Поиск..."
            aria-label="Поисковый запрос"
            className="h-8 w-[140px] sm:w-[200px] bg-transparent border-b border-(--color-border) focus:border-(--color-primary) outline-0 text-sm px-1"
          />
          <button
            type="submit"
            aria-label="Искать"
            className="text-xl text-(--color-description) hover:text-(--color-primary)"
          >
            <SearchIcon />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть поиск"
          className="text-xl text-(--color-description) hover:text-(--color-primary)"
        >
          <SearchIcon />
        </button>
      )}
    </div>
  );
};

const SearchInputFallback: React.FC = () => (
  <div className="flex items-center">
    <button
      type="button"
      aria-label="Открыть поиск"
      disabled
      className="text-xl text-(--color-description)"
    >
      <SearchIcon />
    </button>
  </div>
);

export const SearchInput: React.FC = () => (
  <Suspense fallback={<SearchInputFallback />}>
    <SearchInputInner />
  </Suspense>
);
