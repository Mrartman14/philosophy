"use client";
// src/features/share-links/ui/share-lookup-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Button, Select, TextInput } from "@/components/ui";
import {
  SHARE_RESOURCE_TYPES,
  ALL_RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from "../types";

interface Props {
  /** admin-инструмент допускает canvas (admin может искать canvas-ссылки). */
  admin?: boolean;
}

/**
 * Форма поиска ссылок по ресурсу. Кладёт resource_type + resource_id в URL
 * (server-side фильтрация — страница перечитает fetcher). Бек не отдаёт
 * глобальный «список всех моих ссылок», поэтому управление — per-resource.
 */
export function ShareLookupForm({ admin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const types = admin ? ALL_RESOURCE_TYPES : SHARE_RESOURCE_TYPES;
  const options = types.map((t) => ({
    value: t,
    label: RESOURCE_TYPE_LABELS[t],
  }));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rt = String(fd.get("resource_type") ?? "").trim();
    const rid = String(fd.get("resource_id") ?? "").trim();
    const params = new URLSearchParams();
    if (rt) params.set("resource_type", rt);
    if (rid) params.set("resource_id", rid);
    const qs = params.toString();
    startTransition(() =>
      { router.replace(qs ? `${pathname}?${qs}` : pathname); },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-(--color-description)">Тип ресурса</span>
        <Select
          name="resource_type"
          defaultValue={searchParams.get("resource_type") ?? types[0]}
          options={options}
          aria-label="Тип ресурса"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-(--color-description)">ID ресурса</span>
        <TextInput
          name="resource_id"
          defaultValue={searchParams.get("resource_id") ?? ""}
          placeholder="UUID ресурса"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Показать ссылки"}
      </Button>
    </form>
  );
}
