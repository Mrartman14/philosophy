"use client";
// src/features/search/ui/search-input.tsx
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type SVGProps,
} from "react";

import { Button, Select, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";
import { useT } from "@/i18n/client";

import { SEARCH_TYPES } from "../types";

// Иконки поиска нет в src/assets (UI-kit — запретная зона). Inline-SVG,
// как делала старая фича.
function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
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
}

/** Полная форма для страницы /search: строка + фильтр типа + кнопка. */
function PageForm() {
  const t = useT("search");
  const params = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();
  const initialQ = params.get("q") ?? "";
  const initialType = params.get("type") ?? "";

  const typeOptions = [
    { value: "", label: t("filterAll") },
    ...SEARCH_TYPES.map((type) => ({
      value: type,
      label: type === "lecture" ? t("filterLectures") : t("filterTerms"),
    })),
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawQ = fd.get("q");
    const rawType = fd.get("type");
    const q = (typeof rawQ === "string" ? rawQ : "").trim();
    const type = (typeof rawType === "string" ? rawType : "").trim();
    // Fresh URLSearchParams — intentionally drops all other params and offset.
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (type) next.set("type", type);
    navigate(next, "/search");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <TextInput
        name="q"
        defaultValue={initialQ}
        placeholder={t("inputPlaceholder")}
        aria-label={t("inputAriaLabel")}
        maxLength={200}
        className="min-w-60 flex-1"
      />
      <Select
        name="type"
        defaultValue={initialType}
        options={typeOptions}
        aria-label={t("filterAriaLabel")}
        className="w-40"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : t("submitButton")}
      </Button>
    </form>
  );
}

/** Компактная сворачиваемая иконка для шапки. */
function HeaderInput() {
  const t = useT("search");
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setValue(initialQ);
  }, [initialQ]);

  function submit() {
    const q = value.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setOpen(false);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setValue(initialQ);
    }
  }

  if (open) {
    return (
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => { setValue(e.target.value); }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!value.trim()) setOpen(false);
          }}
          maxLength={200}
          placeholder={t("headerInputPlaceholder")}
          aria-label={t("inputAriaLabel")}
          className="h-8 w-[140px] border-b border-(--color-border) bg-transparent px-1 text-sm outline-0 focus:border-(--color-accent) sm:w-[200px]"
        />
        <button
          type="submit"
          aria-label={t("headerSubmitAriaLabel")}
          className="text-xl text-(--color-fg-muted) hover:text-(--color-accent)"
        >
          <SearchIcon />
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setOpen(true); }}
      aria-label={t("headerOpenAriaLabel")}
      className="text-xl text-(--color-fg-muted) hover:text-(--color-accent)"
    >
      <SearchIcon />
    </button>
  );
}

interface Props {
  /** "page" — раскрытая форма со строкой/фильтром; "header" — иконка. */
  variant?: "page" | "header";
}

/**
 * useSearchParams требует Suspense-границы (Next: иначе деоптимизация в CSR
 * на бандле всей страницы). Оборачиваем оба варианта.
 */
export function SearchInput({ variant = "page" }: Props) {
  return (
    <Suspense fallback={variant === "header" ? <HeaderFallback /> : null}>
      {variant === "header" ? <HeaderInput /> : <PageForm />}
    </Suspense>
  );
}

function HeaderFallback() {
  const t = useT("search");
  return (
    <button
      type="button"
      aria-label={t("headerOpenAriaLabel")}
      disabled
      className="text-xl text-(--color-fg-muted)"
    >
      <SearchIcon />
    </button>
  );
}
