"use client";
// src/features/comments/ui/comment-search.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Button, TextInput } from "@/components/ui";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("cq") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("cq", q);
    else params.delete("cq");
    const qs = params.toString();
    startTransition(() => { router.replace(qs ? `${pathname}?${qs}` : pathname); });
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <TextInput
        name="cq"
        defaultValue={defaultQuery}
        placeholder="Поиск по комментариям…"
        maxLength={200}
        aria-label="Поиск по комментариям лекции"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Найти"}
      </Button>
    </form>
  );
}
