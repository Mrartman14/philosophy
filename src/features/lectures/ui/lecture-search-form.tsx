// src/features/lectures/ui/lecture-search-form.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Button, TextInput } from "@/components/ui";

interface Props {
  basePath: string;
}

export function LectureSearchForm({ basePath }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const initialQ = params.get("q") ?? "";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const next = new URLSearchParams(params.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("offset");
    startTransition(() => {
      router.replace(`${basePath}?${next.toString()}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <TextInput
        name="q"
        defaultValue={initialQ}
        placeholder="Поиск по названию или описанию"
        aria-label="Поиск лекций"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Найти"}
      </Button>
    </form>
  );
}
