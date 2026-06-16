// src/features/lectures/ui/lecture-search-form.tsx
"use client";
import { useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Button, Select, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";

interface Props {
  basePath: string;
  /** Имена тегов для фильтра (бек фильтрует по имени: ?tag=<name>). */
  tagOptions?: string[];
}

export function LectureSearchForm({ basePath, tagOptions }: Props) {
  const params = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();
  const initialQ = params.get("q") ?? "";
  const initialTag = params.get("tag") ?? "";
  const hasTagFilter = !!tagOptions && tagOptions.length > 0;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawQ = fd.get("q");
    const q = (typeof rawQ === "string" ? rawQ : "").trim();
    const next = new URLSearchParams(params.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    if (hasTagFilter) {
      const rawTag = fd.get("tag");
      const tag = (typeof rawTag === "string" ? rawTag : "").trim();
      if (tag) next.set("tag", tag);
      else next.delete("tag");
    }
    next.delete("offset");
    navigate(next, basePath);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
      <TextInput
        name="q"
        defaultValue={initialQ}
        placeholder="Поиск по названию или описанию"
        aria-label="Поиск лекций"
        className="min-w-60 flex-1"
      />
      {hasTagFilter && (
        <Select
          name="tag"
          defaultValue={initialTag}
          aria-label="Фильтр по тегу"
          className="w-48"
          options={[
            { value: "", label: "Все теги" },
            ...tagOptions.map((name) => ({ value: name, label: name })),
          ]}
        />
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Найти"}
      </Button>
    </form>
  );
}
