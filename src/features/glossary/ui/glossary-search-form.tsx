// src/features/glossary/ui/glossary-search-form.tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";

import { Button, TextInput } from "@/components/ui";

interface Props {
  defaultQ: string;
}

export function GlossarySearchForm({ defaultQ }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawQ = fd.get("q");
    const q = (typeof rawQ === "string" ? rawQ : "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("offset");
    startTransition(() => { router.replace(`${pathname}?${params.toString()}`); });
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <TextInput
        type="search"
        name="q"
        defaultValue={defaultQ}
        placeholder="Поиск по названию"
        className="flex-1"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Найти"}
      </Button>
    </form>
  );
}
