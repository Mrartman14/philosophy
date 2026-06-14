"use client";
// src/features/canvas/ui/canvas-search.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { TextInput } from "@/components/ui";

/** Поиск по title через ?q=. Сбрасывает offset при изменении запроса. */
export function CanvasSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = form.get("q");
    const q = (typeof raw === "string" ? raw : "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <TextInput name="q" defaultValue={searchParams.get("q") ?? ""} placeholder="Поиск по названию" />
      <button type="submit" className="rounded border border-(--color-border) px-3 py-1 text-sm hover:bg-(--color-text-pane)">
        Найти
      </button>
    </form>
  );
}
