// src/features/glossary/ui/glossary-search-form.tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

interface Props {
  defaultQ: string;
}

export function GlossarySearchForm({ defaultQ }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(defaultQ);
  const [, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (q) params.set("q", q);
        else params.delete("q");
        params.delete("offset");
        startTransition(() => router.replace(`${pathname}?${params.toString()}`));
      }}
      className="flex gap-2"
    >
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по названию"
        className="flex-1 rounded border border-(--color-border) bg-(--color-text-pane) px-3 py-1.5"
      />
      <button
        type="submit"
        className="rounded bg-(--color-foreground) px-3 py-1.5 text-sm text-(--color-background)"
      >
        Найти
      </button>
    </form>
  );
}
