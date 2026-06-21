// src/features/glossary/ui/glossary-search-form.tsx
"use client";
import { useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Button, Form, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";
import { useT } from "@/i18n/client";

interface Props {
  defaultQ: string;
}

export function GlossarySearchForm({ defaultQ }: Props) {
  const searchParams = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();
  const t = useT("glossary");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawQ = fd.get("q");
    const q = (typeof rawQ === "string" ? rawQ : "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("offset");
    navigate(params);
  }

  return (
    <Form onSubmit={onSubmit} className="flex gap-2">
      <TextInput
        type="search"
        name="q"
        defaultValue={defaultQ}
        placeholder={t("searchPlaceholder")}
        className="flex-1"
      />
      <Button type="submit" disabled={pending}>
        {pending ? t("searchPending") : t("searchButton")}
      </Button>
    </Form>
  );
}
