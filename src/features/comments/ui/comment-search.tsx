"use client";
// src/features/comments/ui/comment-search.tsx
import { useSearchParams } from "next/navigation";
import { type FormEvent } from "react";

import { Button, Form, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";
import { useT } from "@/i18n/client";

interface Props {
  /** Текущее значение из searchParams (?cq=). */
  defaultQuery?: string;
}

/**
 * Поиск по комментариям лекции. Кладёт q в URL (?cq=), страница лекции
 * читает его, дёргает searchComments на сервере и рендерит результаты.
 * Показывается только залогиненным (бек: requiredAuth) — гейт на странице.
 */
export function CommentSearch({ defaultQuery = "" }: Props) {
  const t = useT("comments");
  const searchParams = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawCq = fd.get("cq");
    const q = (typeof rawCq === "string" ? rawCq : "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("cq", q);
    else params.delete("cq");
    // Deliberately does NOT delete offset — comment-search policy.
    navigate(params);
  }

  return (
    <Form onSubmit={onSubmit} className="flex items-end gap-2">
      <TextInput
        name="cq"
        defaultValue={defaultQuery}
        placeholder={t("searchPlaceholder")}
        maxLength={200}
        aria-label={t("searchAriaLabel")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? t("searchPending") : t("searchButton")}
      </Button>
    </Form>
  );
}
