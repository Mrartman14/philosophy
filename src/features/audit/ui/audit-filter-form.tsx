"use client";
// src/features/audit/ui/audit-filter-form.tsx
import { useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode } from "react";

import { Button, Form, Label, Select, TextInput } from "@/components/ui";
import { useQueryFormSubmit } from "@/hooks/use-query-form-submit";
import { useT } from "@/i18n/client";

import { AUDIT_TARGET_TYPES } from "../target-types";

/** Sentinel «все типы» для Select — в URL не сериализуется. */
const ALL_TYPES = "all";

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
    <Label className="flex flex-col gap-1">
      <span className="text-xs text-(--color-fg-muted)">{label}</span>
      {children}
    </Label>
  );
}

export function AuditFilterForm() {
  const t = useT("audit");
  const searchParams = useSearchParams();
  const { navigate, pending } = useQueryFormSubmit();

  const TARGET_TYPE_OPTIONS = [
    { value: ALL_TYPES, label: t("filterAllTypes") },
    ...AUDIT_TARGET_TYPES.map((type) => ({ value: type, label: type })),
  ];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    for (const field of FILTER_FIELDS) {
      const rawVal = fd.get(field);
      const value = (typeof rawVal === "string" ? rawVal : "").trim();
      if (value && value !== ALL_TYPES) params.set(field, value);
      else params.delete(field);
    }
    params.delete("offset");
    navigate(params);
  }

  function onReset() {
    navigate(new URLSearchParams());
  }

  return (
    <Form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={t("filterActorLabel")}>
        <TextInput
          name="actor"
          defaultValue={searchParams.get("actor") ?? ""}
          placeholder="550e8400-e29b-…"
        />
      </Field>
      <Field label={t("filterTargetTypeLabel")}>
        <Select
          name="target_type"
          defaultValue={searchParams.get("target_type") ?? ALL_TYPES}
          options={TARGET_TYPE_OPTIONS}
          aria-label={t("filterTargetTypeLabel")}
        />
      </Field>
      <Field label={t("filterTargetIdLabel")}>
        <TextInput
          name="target_id"
          defaultValue={searchParams.get("target_id") ?? ""}
          placeholder={t("filterTargetIdPlaceholder")}
        />
      </Field>
      <Field label={t("filterActionLabel")}>
        <TextInput
          name="action"
          defaultValue={searchParams.get("action") ?? ""}
          placeholder={t("filterActionPlaceholder")}
        />
      </Field>
      <Field label={t("filterFromLabel")}>
        <TextInput
          type="datetime-local"
          name="from"
          defaultValue={searchParams.get("from") ?? ""}
        />
      </Field>
      <Field label={t("filterToLabel")}>
        <TextInput
          type="datetime-local"
          name="to"
          defaultValue={searchParams.get("to") ?? ""}
        />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "…" : t("filterSubmit")}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset} disabled={pending}>
          {t("filterReset")}
        </Button>
      </div>
    </Form>
  );
}
