"use client";
// src/features/audit/ui/audit-filter-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";
import { Button, Select, TextInput } from "@/components/ui";
import { AUDIT_TARGET_TYPES } from "../target-types";

/** Sentinel «все типы» для Select — в URL не сериализуется. */
const ALL_TYPES = "all";

const TARGET_TYPE_OPTIONS = [
  { value: ALL_TYPES, label: "Все типы" },
  ...AUDIT_TARGET_TYPES.map((t) => ({ value: t, label: t })),
];

const FILTER_FIELDS = [
  "actor",
  "target_type",
  "target_id",
  "action",
  "from",
  "to",
] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-(--color-description)">{label}</span>
      {children}
    </label>
  );
}

export function AuditFilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const field of FILTER_FIELDS) {
      const value = String(fd.get(field) ?? "").trim();
      if (value && value !== ALL_TYPES) params.set(field, value);
      else params.delete(field);
    }
    params.delete("offset");
    const qs = params.toString();
    startTransition(() => { router.replace(qs ? `${pathname}?${qs}` : pathname); });
  }

  function onReset() {
    startTransition(() => { router.replace(pathname); });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="ID актора (UUID)">
        <TextInput
          name="actor"
          defaultValue={searchParams.get("actor") ?? ""}
          placeholder="550e8400-e29b-…"
        />
      </Field>
      <Field label="Тип цели">
        <Select
          name="target_type"
          defaultValue={searchParams.get("target_type") ?? ALL_TYPES}
          options={TARGET_TYPE_OPTIONS}
          aria-label="Тип цели"
        />
      </Field>
      <Field label="ID цели">
        <TextInput
          name="target_id"
          defaultValue={searchParams.get("target_id") ?? ""}
          placeholder="ID сущности"
        />
      </Field>
      <Field label="Действие">
        <TextInput
          name="action"
          defaultValue={searchParams.get("action") ?? ""}
          placeholder="Например, lecture.create"
        />
      </Field>
      <Field label="С">
        <TextInput
          type="datetime-local"
          name="from"
          defaultValue={searchParams.get("from") ?? ""}
        />
      </Field>
      <Field label="По">
        <TextInput
          type="datetime-local"
          name="to"
          defaultValue={searchParams.get("to") ?? ""}
        />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Фильтровать"}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset} disabled={pending}>
          Сбросить
        </Button>
      </div>
    </form>
  );
}
