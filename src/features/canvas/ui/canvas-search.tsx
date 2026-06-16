"use client";
// src/features/canvas/ui/canvas-search.tsx
import { useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Button, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";

/** Поиск по title через ?q=. Сбрасывает offset при изменении запроса. */
export function CanvasSearch() {
  const searchParams = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = form.get("q");
    const q = (typeof raw === "string" ? raw : "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("offset");
    navigate(params);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <TextInput name="q" defaultValue={searchParams.get("q") ?? ""} placeholder="Поиск по названию" />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Найти"}
      </Button>
    </form>
  );
}
